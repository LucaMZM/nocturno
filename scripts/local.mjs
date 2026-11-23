// Supervisor local. El socket privado identifica esta copia del proyecto.
import { spawn, execFileSync } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';

process.umask(0o077);
const script = fileURLToPath(import.meta.url);
const root = path.dirname(path.dirname(script));
const state = path.join(root, '.nocturno-local');
fs.mkdirSync(state, { recursive: true, mode: 0o700 });
const socket = path.join(state, 'control.sock');
const gateway = Number(process.env.GATEWAY_PORT ?? 4000);
const children = new Map();
const messages = [];
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
  return fs.openSync(path.join(state, name + '.log'), 'a', 0o600);
}

function start(name, exe, args, cwd, env, quiet = false) {
  if (phase === 'Deteniendo') throw Error('Arranque cancelado.');
  const fd = fileLog(name);
  const child = spawn(exe, args, {
    cwd: path.join(root, cwd),
    env,
    detached: true,
    stdio: ['ignore', quiet ? 'ignore' : fd, quiet ? 'ignore' : fd],
  });
  fs.closeSync(fd);
  children.set(name, child);
  child.on('error', () => notify(name + ': no se pudo iniciar.'));
  child.on('exit', () => {
    // Un lanzador (por ejemplo Stripe CLI) puede tener descendientes.
    if (phase !== 'Deteniendo') {
      try {
        signalGroup(child, 'SIGTERM');
      } catch (e) {
        notify(name + ': ' + e.code);
      }
      notify(name + ': proceso detenido.');
    }
  });
  return child;
}
function signalGroup(child, signal) {
  if (child.pid)
    try {
      process.kill(-child.pid, signal);
    } catch (e) {
      if (e.code !== 'ESRCH') throw e;
    }
}
function active(child) {
  return child?.pid && child.exitCode === null && child.signalCode === null;
}
async function stop() {
  phase = 'Deteniendo';
  const owned = [...children.values()].filter(active).reverse();
  for (const child of owned) signalGroup(child, 'SIGTERM');
  for (let i = 0; i < 35 && owned.some(active); i++) await sleep(100);
  for (const child of owned.filter(active)) signalGroup(child, 'SIGKILL');
}
async function reachable(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1200) })).ok;
  } catch {
    return false;
  }
}
async function ready(name, url) {
  for (let i = 0; i < 160; i++) {
    if (!active(children.get(name))) break;
    if (await reachable(url)) return;
    await sleep(300);
  }
  throw Error(name + ' no responde. Consulta npm run logs.');
}
async function free(port) {
  const probe = createServer();
  await new Promise((ok, fail) =>
    probe
      .once('error', () =>
        fail(
          Error(
            'Puerto ' +
              port +
              ' ocupado o no válido. Usa npm run status y comprueba lsof -i :' +
              port,
          ),
        ),
      )
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
  } catch {
    throw Error(
      'No se puede conectar a PostgreSQL. Abre Postgres.app, inicia PostgreSQL 18 y revisa DATABASE_URL en backend/.env.',
    );
  } finally {
    await db.end();
  }
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
  const proxy = path.join(state, 'proxy.json');
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
  await ready('angular', 'http://127.0.0.1:4200/api/config/events');
  if (await reachable('http://127.0.0.1:11434/api/tags'))
    notify('Ollama externo disponible.');
  else if (installed('ollama')) {
    start('ollama', 'ollama', ['serve'], '.', cleanEnv);
    try {
      await ready('ollama', 'http://127.0.0.1:11434/api/tags');
    } catch {
      notify('Ollama no responde en 11434. Consulta el log de Ollama.');
    }
  } else notify('Ollama ausente. Yomogan dispone de búsqueda.');
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
      const secret = execFileSync('stripe', [...args, '--print-secret'], {
        env,
        encoding: 'utf8',
        timeout: 12000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (secret.startsWith('whsec_') && secret === core.STRIPE_WEBHOOK_SECRET)
        start('stripe', 'stripe', args, '.', env, true);
      else
        notify(
          'Stripe desactivado. Comprueba stripe listen --print-secret en tu Sandbox, actualiza STRIPE_WEBHOOK_SECRET en backend/.env y ejecuta npm run restart.',
        );
    } catch {
      notify(
        'Stripe opcional no disponible. Revisa la CLI y las claves Sandbox.',
      );
    }
  } else notify('Stripe opcional desactivado.');
  if (phase === 'Deteniendo') throw Error('Arranque cancelado.');
  phase = 'Disponible';
}
function report() {
  const degraded =
    phase === 'Disponible' &&
    ['angular', 'gateway', 'core', 'ai'].some((n) => !active(children.get(n)));
  return [
    degraded ? 'Servicio detenido. Ejecuta npm run restart.' : phase,
    ...messages,
    ...[...children].map(
      ([name, c]) => name + ' ' + (active(c) ? 'PID ' + c.pid : 'detenido'),
    ),
  ].join('\n');
}
async function daemon() {
  const server = createServer((conn) => {
    conn.on('error', () => conn.destroy());
    conn.once('data', async (data) => {
      if (data.toString().trim() === 'down') {
        if (phase === 'Deteniendo') return conn.end('Deteniendo');
        await stop();
        conn.end('Servicios propios detenidos');
        server.close();
      } else conn.end(report());
    });
  });
  await new Promise((ok, fail) =>
    server.once('error', fail).listen(socket, ok),
  );
  fs.writeFileSync(path.join(state, 'supervisor.pid'), String(process.pid));
  const shutdown = async () => {
    if (phase !== 'Deteniendo') {
      await stop();
      server.close();
    }
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  server.once('close', () =>
    fs.rmSync(path.join(state, 'supervisor.pid'), { force: true }),
  );
  try {
    await services();
  } catch (e) {
    console.error(e.message);
    await shutdown();
    process.exitCode = 1;
  }
}
// Solo este supervisor conoce y señala sus grupos de procesos. El cliente nunca
// usa el PID del archivo para detener procesos.
function request(command) {
  return new Promise((ok, fail) => {
    const c = createConnection(socket);
    let data = '';
    c.on('connect', () => c.write(command));
    c.on('data', (v) => (data += v));
    c.on('end', () => ok(data));
    c.on('error', fail);
  });
}
async function current() {
  try {
    return await request('status');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    if (e.code !== 'ECONNREFUSED') throw e;
  }
  // Un cierre abrupto puede dejar un socket sin servidor. Serializar la
  // recuperación impide borrar el socket que otro arranque acaba de crear.
  const lock = path.join(state, 'recover.lock');
  try {
    fs.mkdirSync(lock);
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    await sleep(100);
    return request('status');
  }
  try {
    try {
      return await request('status');
    } catch (e) {
      if (!['ECONNREFUSED', 'ENOENT'].includes(e.code)) throw e;
    }
    fs.rmSync(socket, { force: true });
    return null;
  } finally {
    fs.rmdirSync(lock);
  }
}
async function up() {
  let status = await current();
  if (!status) {
    const fd = fileLog('supervisor');
    const child = spawn(process.execPath, [script, 'supervise'], {
      detached: true,
      stdio: ['ignore', fd, fd],
    });
    fs.closeSync(fd);
    child.unref();
    for (let i = 0; i < 80 && !status; i++) {
      await sleep(100);
      status = await current();
      if (child.exitCode !== null && !status) break;
    }
  }
  for (let i = 0; i < 180 && status?.startsWith('Arrancando'); i++) {
    await sleep(500);
    status = await current();
  }
  if (status && !status.startsWith('Disponible')) throw Error(status);
  if (!status)
    throw Error(
      'Arranque incompleto. ' +
        fs
          .readFileSync(path.join(state, 'supervisor.log'), 'utf8')
          .trim()
          .split('\n')
          .at(-1),
    );
  console.log(status + '\nhttp://localhost:4200');
}
async function down() {
  if (await current()) {
    const result = await request('down');
    if (!result)
      throw Error(
        'Supervisor desconectado durante el apagado. Consulta npm run status.',
      );
    console.log(result);
    for (let i = 0; i < 40 && fs.existsSync(socket); i++) await sleep(100);
  } else console.log('Supervisor detenido.');
}
try {
  switch (process.argv[2]) {
    case 'supervise':
      await daemon();
      break;
    case 'up':
      await up();
      break;
    case 'down':
      await down();
      break;
    case 'restart':
      await down();
      await up();
      break;
    case 'status':
      console.log((await current()) ?? 'Supervisor detenido.');
      break;
    case 'logs':
      for (const name of fs
        .readdirSync(state)
        .filter((n) => n.endsWith('.log'))) {
        console.log(name);
        const fd = fs.openSync(path.join(state, name), 'r');
        const size = fs.fstatSync(fd).size;
        const buf = Buffer.alloc(Math.min(size, 8192));
        fs.readSync(fd, buf, 0, buf.length, size - buf.length);
        fs.closeSync(fd);
        console.log(buf.toString().split('\n').slice(-20).join('\n'));
      }
      break;
    default:
      throw Error('Acción desconocida');
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
