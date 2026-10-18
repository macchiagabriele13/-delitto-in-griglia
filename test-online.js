'use strict';
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const port = 32000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(path, data, status = 200) {
  const res = await fetch(base + path, { method: data ? 'POST' : 'GET', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
  assert.equal(res.status, status, `${path}: unexpected HTTP status`);
  return res.json();
}
(async () => {
  try {
    for (let i = 0; i < 100; i++) {
      try { await api('/health'); break; } catch (error) { if (i === 99) throw error; await pause(40); }
    }
    const host = await api('/api/rooms', {name: 'Alice'}, 201);
    const code = host.state.code;
    assert.equal(host.state.phase, 'waiting');
    assert.equal(host.state.puzzle, null);
    assert.equal(code.length, 6);
    const guest = await api(`/api/rooms/${code}/join`, {name: 'Bob'});
    assert.equal(guest.state.phase, 'playing');
    assert.equal(guest.state.players.length, 2);
    assert.equal(guest.state.puzzle.size, 6);
    assert.equal(guest.state.puzzle.characters.length, 6);
    assert.equal(guest.state.puzzle.solution, undefined);
    assert.equal(guest.state.puzzle.killer, undefined);
    const hostState = await api(`/api/rooms/${code}?token=${encodeURIComponent(host.token)}`);
    assert.deepEqual(hostState.state.puzzle, guest.state.puzzle);
    assert.equal(hostState.state.players.find(p=>p.me).name, 'Alice');
    await api(`/api/rooms/${code}/action`, { token: host.token, action: 'progress', count: 3 });
    const progress = await api(`/api/rooms/${code}?token=${encodeURIComponent(guest.token)}`);
    assert.equal(progress.state.players.find(p=>p.name==='Alice').progress, 3);
    const bad = await api(`/api/rooms/${code}/action`, { token: host.token, action: 'submit', board: {}, accused: 'A' }, 422);
    assert.equal(bad.ok, false);
    const cooldown = await api(`/api/rooms/${code}/action`, { token: host.token, action: 'submit', board: {}, accused: 'B' }, 429);
    assert.equal(cooldown.ok, false);
    const unknown = await api(`/api/rooms/${code}?token=wrong-token`, undefined, 403);
    assert.equal(unknown.ok, false);
    console.log('Online integration test: room, private puzzle, progress, wrong solution, cooldown, auth OK.');
  } finally {
    child.kill('SIGTERM');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
