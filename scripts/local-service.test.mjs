import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';

test('el cierre del supervisor alcanza a los descendientes que ignoran SIGTERM', { timeout: 15000 }, async () => {
  const fixture = `
    const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); console.log('listo'); setInterval(() => {}, 1000)"]);
    child.stdout.once('data', () => console.log('listo'));
  `;
  const worker = fork(new URL('./local-service.mjs', import.meta.url), [process.execPath, '-e', fixture], {
    detached: true, silent: true,
  });
  const exited = once(worker, 'exit');
  try {
    await once(worker.stdout, 'data');
    worker.disconnect();
    const [, signal] = await exited;
    assert.equal(signal, 'SIGKILL');
    // Linux puede conservar brevemente un zombi pendiente de recolección.
    for (let i = 0; i < 30; i++) {
      try { process.kill(-worker.pid, 0); } catch (error) {
        assert.ok(['ESRCH', 'EPERM'].includes(error.code));
        return;
      }
      await sleep(100);
    }
    const { execFileSync } = await import('node:child_process');
    const rows = execFileSync('ps', ['-axo', 'pgid=,stat='], { encoding: 'utf8' });
    assert.ok(!rows.trim().split('\n').some(row => {
      const [group, status] = row.trim().split(/\s+/);
      return Number(group) === worker.pid && !status.startsWith('Z');
    }));
  } finally { if (worker.connected) worker.disconnect(); }
});
