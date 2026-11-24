// Supervisor local. El socket privado identifica esta copia del proyecto.
import { DatabaseSync } from 'node:sqlite';
import { spawn, execFileSync, execFile } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createServer, createConnection } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv, promisify } from 'node:util';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';

process.umask(0o077);
const script = fileURLToPath(import.meta.url);
const root = path.dirname(path.dirname(script));
const state = path.join(root, '.nocturno-local');
fs.mkdirSync(state, { recursive: true, mode: 0o700 });
// Un nombre relativo cabe también en sockaddr_un bajo rutas largas de macOS.
process.chdir(state);
const socket = 'control.sock';
const gateway = Number(process.env.GATEWAY_PORT ?? 4000);
const latest = path.join(state, 'latest');
let run;
const endpoints = new Map();
const children = new Map();
const messages = [];
const stopping = new AbortController();
let phase = 'Arrancando';
const cleanEnv = Object.fromEntries(
  ['PATH', 'HOME', 'USER', 'LANG', 'TMPDIR']
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);
function notify(message) {
  messages.push(message);
  console.log(message);
}
function fileLog(name) {
  return fs.openSync(path.join(run, name + '.log'), 'a', 0o600);
}

function start(name, exe, args, cwd, env, redactOutput = false) {
  if (phase === 'Deteniendo') throw Error('Arranque cancelado.');
  const fd = fileLog(name);
  const child = spawn(process.execPath, [path.join(root, 'scripts/local-service.mjs'), exe, ...args], {
    cwd: path.join(root, cwd), env, detached: true,
    stdio: ['ignore', redactOutput ? 'pipe' : fd, redactOutput ? 'pipe' : fd, 'ipc'],
  });
  if (redactOutput) {
    for (const stream of [child.stdout, child.stderr]) {
      createInterface({ input: stream }).on('line', line => {
        fs.appendFileSync(path.join(run, name + '.log'), redact(line) + '\n');
      });
    }
  }
  fs.closeSync(fd);
  children.set(name, child);
  child.on('message', ({ pid }) => { child.servicePid = pid; });
  child.on('error', error => notify(name + ': ' + error.message));
  child.on('exit', (code, signal) => {
    if (phase !== 'Deteniendo') notify(name + ': detenido (' + (signal ?? code) + '). ' + tail(name));
  });
  return child;
}
function redact(text) {
  return text.replace(/(?:(?:sk|rk|pk)_(?:test|live)_|whsec_)[a-zA-Z0-9]+|postgres(?:ql)?:\/\/[^\s]+/gi, '[oculto]');
}
function tail(name) {
  const file = path.join(run, name + '.log');
  if (!fs.existsSync(file)) return '';
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const buf = Buffer.alloc(Math.min(size, 8192));
    fs.readSync(fd, buf, 0, buf.length, size - buf.length);
    return redact(buf.toString().trim().split('\n').slice(-12).join('\n'));
  } finally { fs.closeSync(fd); }
}
function active(child) {
  return child?.pid && child.exitCode === null && child.signalCode === null;
}
async function stop() {
  phase = 'Deteniendo';
  stopping.abort();
  await Promise.all([...children.values()].filter(active).map(child => new Promise(resolve => {
    child.once('exit', resolve);
    child.once('error', resolve);
    if (child.connected) child.disconnect();
  })));
}
async function probe(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) {
      await response.body?.cancel();
      return 'HTTP ' + response.status;
    }
    const body = await response.json();
    if (url.endsWith('/health')) return body.status === 'ok' ? null : 'estado inesperado';
    if (url.endsWith('/api/tags')) return Array.isArray(body.models) ? null : 'respuesta de Ollama inesperada';
    return body.data != null ? null : 'respuesta de API inesperada';
  } catch (error) { return error.cause?.code ?? error.message; }
}
async function reachable(url) { return (await probe(url)) === null; }
async function ready(name, url) {
  endpoints.set(name, url);
  const deadline = Date.now() + (name === 'angular' ? 120000 : name === 'ollama' ? 8000 : 60000);
  let reason = 'proceso detenido';
  while (phase === 'Arrancando' && active(children.get(name)) && Date.now() < deadline) {
    reason = await probe(url);
    if (!reason) return;
    await sleep(200);
  }
  throw Error(`${name}: ${url} — ${reason}.\n${tail(name)}`);
}
async function free(port) {
  const probe = createServer();
  await new Promise((ok, fail) =>
    probe
      .once('error', error => fail(Error(`Puerto ${port}: ${error.code}. Comprueba lsof -nP -iTCP:${port} -sTCP:LISTEN.`)))
      .listen(port, '127.0.0.1', ok),
  );
  await new Promise((ok) => probe.close(ok));
}
function installed(cmd) {
  try {
    execFileSync('/usr/bin/which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
async function prepareStripe(core) {
  if (
    installed('stripe') &&
    core.STRIPE_SECRET_KEY?.startsWith('sk_test_') &&
    core.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')
  ) {
    const args = [
      'listen',
      '--events',
      'payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,charge.refunded',
      '--forward-to',
      `localhost:${gateway}/api/stripe/webhook`,
    ];
    const env = { ...cleanEnv, STRIPE_API_KEY: core.STRIPE_SECRET_KEY };
    try {
      const { stdout } = await promisify(execFile)('stripe', [...args, '--print-secret'], {
        env,
        encoding: 'utf8',
        timeout: 12000,
        signal: stopping.signal,
      });
      const secret = stdout.trim();
      if (/^whsec_[a-zA-Z0-9]+$/.test(secret)) {
        if (process.env.NOCTURNO_STRIPE_CLI === '1' && core.NODE_ENV !== 'production')
          core.STRIPE_WEBHOOK_SECRET = secret;
        if (secret === core.STRIPE_WEBHOOK_SECRET) return {args, env};
      }
      notify(
          'Stripe desactivado. Comprueba stripe listen --print-secret en tu Sandbox, actualiza STRIPE_WEBHOOK_SECRET en backend/.env y ejecuta npm run restart.',
        );
    } catch {
      notify(
        'Stripe opcional no disponible. Revisa la CLI y las claves Sandbox.',
      );
    }
  } else notify('Stripe opcional desactivado.');
}
async function services() {
  if (
    !Number.isInteger(gateway) ||
    gateway < 1 ||
    gateway > 65535 ||
    [3000, 3001, 4200, 11434, 5432].includes(gateway)
  )
    throw Error('GATEWAY_PORT no es válido o coincide con otro servicio.');
  for (const port of [3000, 3001, gateway, 4200]) await free(port);
  const coreFile = path.join(root, 'backend/.env');
  const core = {
    ...(fs.existsSync(coreFile)
      ? parseEnv(fs.readFileSync(coreFile, 'utf8'))
      : {}),
    ...process.env,
  };
  if (!core.DATABASE_URL)
    throw Error('Configura DATABASE_URL en backend/.env.');
  const { Client } = createRequire(path.join(root, 'backend/package.json'))(
    'pg',
  );
  const db = new Client({
    connectionString: core.DATABASE_URL,
    connectionTimeoutMillis: 2500,
  });
  try {
    await db.connect();
    await db.query('SELECT 1');
  } catch (error) {
    throw Error(
      'PostgreSQL (' + (error.code ?? error.message) + '). Abre Postgres.app, inicia PostgreSQL 18 y revisa DATABASE_URL en backend/.env.',
    );
  } finally {
    await db.end();
  }
  const listener = await prepareStripe(core);
  start('core', process.execPath, ['src/server.js'], 'backend', {
    ...core,
    PORT: '3000',
    CORE_HOST: '127.0.0.1',
  });
  await ready('core', 'http://127.0.0.1:3000/health');
  start('ai', process.execPath, ['ai/server.js'], 'backend', {
    ...cleanEnv,
    AI_PORT: '3001',
    AI_HOST: '127.0.0.1',
  });
  await ready('ai', 'http://127.0.0.1:3001/api/yomogan/config');
  start('gateway', process.execPath, ['gateway/server.js'], 'backend', {
    ...cleanEnv,
    GATEWAY_PORT: String(gateway),
  });
  await ready('gateway', `http://127.0.0.1:${gateway}/api/config/events`);
  const proxy = path.join(run, 'proxy.json');
  const config = JSON.parse(
    fs.readFileSync(path.join(root, 'frontend/proxy.conf.json')),
  );
  config['/api'].target = `http://127.0.0.1:${gateway}`;
  fs.writeFileSync(proxy, JSON.stringify(config));
  start(
    'angular',
    process.execPath,
    [
      'node_modules/@angular/cli/bin/ng.js',
      'serve',
      '--proxy-config',
      proxy,
      '--host',
      '127.0.0.1',
      '--port',
      '4200',
    ],
    'frontend',
    cleanEnv,
  );
  await ready('angular', 'http://127.0.0.1:4200/api/shop/events?limit=1');
  if (await reachable('http://127.0.0.1:11434/api/tags'))
    endpoints.set('ollama-externo', 'http://127.0.0.1:11434/api/tags');
  else if (installed('ollama')) {
    start('ollama', 'ollama', ['serve'], '.', cleanEnv);
    try {
      await ready('ollama', 'http://127.0.0.1:11434/api/tags');
    } catch (error) {
      notify('Ollama opcional: ' + error.message);
    }
  } else notify('Ollama ausente. Yomogan dispone de búsqueda.');
  if (listener) start('stripe', 'stripe', listener.args, '.', listener.env, true);
  if (phase === 'Deteniendo') throw Error('Arranque cancelado.');
  phase = 'Disponible';
}
async function report() {
  let degraded = false;
  const lines = await Promise.all([...children].map(async ([name, child]) => {
    const error = !active(child) ? 'detenido' :
      phase === 'Disponible' && endpoints.has(name) && await probe(endpoints.get(name));
    if (error && ['core', 'ai', 'gateway', 'angular'].includes(name)) degraded = true;
    return name + (error ? ': ' + error : ' PID ' + (child.servicePid ?? child.pid));
  }));
  if (endpoints.has('ollama-externo')) {
    const error = await probe(endpoints.get('ollama-externo'));
    lines.push(error ? 'Ollama externo: ' + error : 'Ollama externo disponible.');
  }
  return [degraded && phase === 'Disponible' ? 'Degradado' : phase, ...lines, ...messages].join('\n');
}
async function daemon() {
  run = process.argv[3];
  let shutdown;
  const server = createServer(conn => {
    conn.on('error', () => conn.destroy());
    conn.once('data', async data => {
      if (data.toString() === 'down') {
        await finish();
        conn.end('Servicios propios detenidos');
      } else conn.end(await report());
    });
  });
  function finish() {
    return shutdown ??= stop().then(() => { server.close(); });
  }
  await new Promise((resolve, reject) => server.once('error', reject).listen(socket, resolve));
  process.on('disconnect', () => { if (phase === 'Arrancando') void finish(); });
  process.channel?.unref();
  process.on('SIGTERM', finish);
  process.on('SIGINT', finish);
  try { await services(); }
  catch (error) {
    if (!shutdown) {
      const failure = redact(error.message);
      fs.writeFileSync(path.join(run, 'error.txt'), failure);
      console.error(failure);
    }
    await finish();
    process.exitCode = 1;
  }
}
function request(command) {
  return new Promise((resolve, reject) => {
    const conn = createConnection(socket);
    let data = '';
    conn.setTimeout(15000, () => conn.destroy(Error('El supervisor no responde por su socket.')));
    conn.on('connect', () => conn.write(command));
    conn.on('data', chunk => { data += chunk; });
    conn.on('end', () => resolve(data));
    conn.on('error', reject);
  });
}
async function current() {
  try { return await request('status'); }
  catch (error) {
    if (['ENOENT', 'ECONNREFUSED'].includes(error.code)) return null;
    throw error;
  }
}
// Esta transacción local serializa elección, reemplazo de socket y restart.
// El SO libera el bloqueo si el cliente termina abruptamente.
function commandLock() {
  const db = new DatabaseSync(path.join(state, 'launcher.sqlite'));
  db.exec('PRAGMA busy_timeout=30000');
  db.exec('BEGIN IMMEDIATE');
  return db;
}
async function down(status) {
  if (!status) return console.log('Supervisor detenido.');
  const reply = await request('down');
  if (!reply) throw Error('Se perdió la conexión durante el apagado.');
  console.log(reply);
  const deadline = Date.now() + 10000;
  while (fs.existsSync(socket) && Date.now() < deadline) await sleep(50);
  if (fs.existsSync(socket)) throw Error('El supervisor anterior aún tiene su socket.');
}
async function command(action) {
  let daemonChild;
  let cancelled = false;
  const cancel = () => { cancelled = true; if (active(daemonChild)) daemonChild.kill('SIGTERM'); };
  process.on('SIGINT', cancel);
  process.on('SIGTERM', cancel);
  process.on('SIGHUP', cancel);
  let status;
  const lock = commandLock();
  try {
    status = await current();
    if (action !== 'up' || status?.startsWith('Degradado')) {
      await down(status);
      status = null;
    }
    if (action === 'down' || cancelled) return;
    if (!status) {
      if (fs.existsSync(socket)) {
        if (!fs.lstatSync(socket).isSocket()) throw Error('control.sock no es un socket.');
        fs.unlinkSync(socket);
      }
      run = fs.mkdtempSync(path.join(state, 'run-' + new Date().toISOString().replaceAll(':', '-') + '-'));
      fs.writeFileSync(latest + '.tmp', path.basename(run));
      fs.renameSync(latest + '.tmp', latest);
      const fd = fileLog('supervisor');
      daemonChild = spawn(process.execPath, [script, 'supervise', run], {
        detached: true, stdio: ['ignore', fd, fd, 'ipc'],
      });
      fs.closeSync(fd);
      daemonChild.unref();
      daemonChild.channel.unref();
      for (let i = 0; i < 100 && !status && active(daemonChild); i++) {
        await sleep(100);
        status = await current();
      }
      if (!status && active(daemonChild)) cancel();
    }
  } finally { lock.close(); }
  const deadline = Date.now() + 300000;
  while ((status?.startsWith('Arrancando') || status?.startsWith('Deteniendo')) && Date.now() < deadline && !cancelled) {
    await sleep(300);
    status = await current();
  }
  if (cancelled) {
    while (active(daemonChild)) await sleep(100);
    throw Error('Arranque cancelado.');
  }
  if (!status?.startsWith('Disponible')) {
    if (status?.startsWith('Arrancando')) cancel();
    run ??= path.join(state, fs.readFileSync(latest, 'utf8'));
    const failure = path.join(run, 'error.txt');
    throw Error([status, 'Arranque incompleto.', fs.existsSync(failure)
      ? fs.readFileSync(failure, 'utf8') : tail('supervisor')].filter(Boolean).join('\n'));
  }
  console.log(status + '\nhttp://localhost:4200');
}
try {
  const action = process.argv[2];
  if (action === 'supervise') await daemon();
  else if (['up', 'down', 'restart'].includes(action)) await command(action);
  else if (action === 'status') console.log(await current() ?? 'Supervisor detenido.');
  else if (action === 'logs') {
    if (fs.existsSync(latest)) {
      run = path.join(state, fs.readFileSync(latest, 'utf8'));
      console.log(run);
      for (const file of fs.readdirSync(run).filter(name => name.endsWith('.log')))
        console.log(file, tail(path.basename(file, '.log')));
    } else console.log('Sin ejecuciones registradas.');
  } else throw Error('Acción desconocida');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
