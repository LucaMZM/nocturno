// macOS puede conservar la entrada del archivo en Finder sin conservar su contenido.
// Leer los placeholders antes de lanzar Node separa la espera de iCloud del timeout HTTP.
import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

export async function prepareLocalFiles(root, signal, progress) {
  if (process.platform !== 'darwin') return;
  const paths = [
    'backend/.env', 'backend/package.json', 'backend/src', 'backend/ai',
    'backend/gateway', 'backend/node_modules', 'frontend/node_modules',
    'frontend/src', 'frontend/public', 'frontend/.angular/cache',
    'frontend/angular.json', 'frontend/package.json', 'frontend/tsconfig.app.json',
    'frontend/tsconfig.json', 'frontend/proxy.conf.json', 'scripts/local-service.mjs',
  ].filter(name => fs.existsSync(path.join(root, name)));
  const { stdout } = await promisify(execFile)('/usr/bin/find',
    ['-H', ...paths, '-type', 'f', '-flags', '+dataless', '-print0'],
    { cwd: root, signal, maxBuffer: 32 * 1024 * 1024 });
  const files = stdout.split('\0').filter(Boolean);
  if (!files.length) return;

  const cancel = new AbortController();
  const reading = AbortSignal.any([signal, cancel.signal, AbortSignal.timeout(300000)]);
  let next = 0;
  let completed = 0;
  progress('Descargando archivos de iCloud (0/' + files.length + ')');
  async function worker() {
    while (next < files.length) {
      reading.throwIfAborted();
      const file = files[next++];
      try {
        await new Promise((resolve, reject) => {
          const child = spawn('/bin/cat', [file], { cwd: root, stdio: 'ignore', signal: reading });
          child.once('error', reject);
          child.once('exit', code => code === 0 ? resolve() : reject(Error('lectura interrumpida')));
        });
      } catch (error) {
        if (signal.aborted) throw Error('Arranque cancelado.');
        throw Error('iCloud no ha entregado ' + file + '. Comprueba la conexión y selecciona Mantener descargado en Finder. ' + error.message);
      }
      completed++;
      if (completed % 50 === 0) progress('Descargando archivos de iCloud (' + completed + '/' + files.length + ')');
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(12, files.length) }, worker));
  } finally { cancel.abort(); }
}
