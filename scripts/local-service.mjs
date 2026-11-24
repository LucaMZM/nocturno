// Líder del grupo privado del servicio. El cierre del IPC también cubre una
// caída abrupta del supervisor. Nunca reutilizamos PID guardados en disco.
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

if (!process.send) throw Error('Se requiere el supervisor local.');
const group = execFileSync('/bin/ps', ['-o', 'pgid=', '-p', String(process.pid)], { encoding: 'utf8' });
if (Number(group.trim()) !== process.pid) throw Error('Se requiere un grupo de procesos privado.');
let closing = false;
async function closeGroup() {
  if (closing) return;
  closing = true;
  // El líder permanece vivo durante todo el apagado, incluso si la CLI sale
  // antes que sus descendientes. El manejador ignora nuestro propio SIGTERM.
  process.kill(0, 'SIGTERM');
  for (let i = 0; i < 30; i++) {
    await sleep(100);
    const rows = execFileSync('/bin/ps', ['-axo', 'pid=,ppid=,pgid=,stat=,comm='], { encoding: 'utf8' });
    const members = rows.trim().split('\n').some(row => {
      const [pid, parent, group, status, cmd] = row.trim().split(/\s+/);
      return +group === process.pid && +pid !== process.pid && !status.startsWith('Z') && !(+parent === process.pid && cmd?.split('/').at(-1) === 'ps');
    });
    if (!members) process.exit(0);
  }
  process.kill(0, 'SIGKILL');
}
process.on('disconnect', closeGroup);
process.on('SIGTERM', closeGroup);
process.on('SIGINT', closeGroup);
const [exe, ...args] = process.argv.slice(2);
const child = spawn(exe, args, { stdio: 'inherit' });
child.on('spawn', () => process.connected && process.send({ pid: child.pid }, () => {}));
child.on('error', error => { console.error(error.message); void closeGroup(); });
child.on('exit', (code, signal) => {
  if (!closing) console.error('Proceso finalizado:', signal ?? code);
  void closeGroup();
});
