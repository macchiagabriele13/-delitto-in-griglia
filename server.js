'use strict';
/** Zero-dependency Node server. Online rooms are kept in memory while the server is running. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { generatePuzzle, publicView, validateSolution } = require('./public/puzzle.js');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DIR = path.join(__dirname, 'public');
const rooms = new Map();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function token() { return crypto.randomBytes(24).toString('base64url'); }
function code() {
  let value;
  do { value = Array.from(crypto.randomBytes(6), n => ALPHABET[n % ALPHABET.length]).join(''); }
  while (rooms.has(value));
  return value;
}
function randomCase() {
  const puzzle = generatePuzzle(crypto.randomBytes(4).readUInt32LE(0) || 42);
  // The public case identifier must not disclose the generation seed in a duel.
  puzzle.id = `CASE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  return puzzle;
}
function cleanName(raw) { return String(raw || 'Detective').replace(/[<>\r\n\t]/g, '').trim().slice(0, 22) || 'Detective'; }
function playerWithToken(room, bearer) { return room.players.find(p => p.token === bearer); }
function snapshot(room, bearer) {
  const me = playerWithToken(room, bearer);
  return {
    code: room.code, phase: room.phase, round: room.round,
    players: room.players.map(p => ({ id: p.id, name: p.name, progress: p.progress,
      online: p.streams.size > 0, ready: p.ready, wins: p.wins, me: p === me })),
    startedAt: room.startedAt, finishedAt: room.finishedAt,
    result: room.result, puzzle: room.puzzle ? publicView(room.puzzle) : null,
    cooldownUntil: me ? me.cooldownUntil : 0
  };
}
function notify(room) {
  for (const player of room.players) {
    const payload = `event: state\ndata: ${JSON.stringify(snapshot(room, player.token))}\n\n`;
    for (const response of [...player.streams]) {
      try { response.write(payload); } catch (_) { player.streams.delete(response); }
    }
  }
}
function startRound(room) {
  room.phase = 'playing'; room.round += 1;
  room.puzzle = randomCase(); room.startedAt = Date.now(); room.finishedAt = null; room.result = null;
  for (const p of room.players) { p.progress = 0; p.ready = false; p.cooldownUntil = 0; }
  notify(room);
}
function send(res, status, obj) {
  const raw = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(raw), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(raw);
}
function fail(res, code, message) { return send(res, code, { ok: false, error: message }); }
async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString('utf8');
    if (raw.length > 12000) throw new Error('Richiesta troppo grande.');
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error('JSON non valido.'); }
}
function handleStatic(req, res, pathname) {
  let file = pathname === '/' ? '/index.html' : pathname;
  if (!['/index.html', '/app.js', '/styles.css', '/puzzle.js', '/favicon.svg'].includes(file)) return fail(res, 404, 'Pagina non trovata.');
  const mimetypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  const filepath = path.join(DIR, file);
  fs.readFile(filepath, (err, data) => {
    if (err) return fail(res, 404, 'File non trovato.');
    res.writeHead(200, { 'Content-Type': (mimetypes[path.extname(file)] || 'text/plain') + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname;
  try {
    if (route === '/health') return send(res, 200, { ok: true, activeRooms: rooms.size });
    if (route === '/api/rooms' && req.method === 'POST') {
      const payload = await body(req);
      const room = { code: code(), phase: 'waiting', round: 0, players: [], puzzle: null, result: null,
        startedAt: null, finishedAt: null, lastActivity: Date.now() };
      const person = { id: 'P1', name: cleanName(payload.name), token: token(), streams: new Set(), progress: 0, ready: false, wins: 0, cooldownUntil: 0 };
      room.players.push(person);
      rooms.set(room.code, room);
      return send(res, 201, { ok: true, token: person.token, state: snapshot(room, person.token) });
    }
    const match = route.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|events|action))?$/);
    if (match) {
      const room = rooms.get(match[1]);
      if (!room) return fail(res, 404, 'Stanza non trovata o scaduta.');
      const operation = match[2] || '';
      room.lastActivity = Date.now();
      if (operation === 'join' && req.method === 'POST') {
        const payload = await body(req);
        let person = payload.token ? playerWithToken(room, payload.token) : null;
        if (!person && room.players.length >= 2) return fail(res, 409, 'La stanza ha già due giocatori.');
        if (!person) {
          person = { id: 'P2', name: cleanName(payload.name), token: token(), streams: new Set(), progress: 0, ready: false, wins: 0, cooldownUntil: 0 };
          room.players.push(person);
          startRound(room);
        }
        const data = { ok: true, token: person.token, state: snapshot(room, person.token) };
        notify(room);
        return send(res, 200, data);
      }
      let bearer = url.searchParams.get('token');
      let payload = {};
      if (req.method === 'POST' && operation === 'action') {
        payload = await body(req); bearer = payload.token;
      }
      const me = playerWithToken(room, bearer);
      if (!me) return fail(res, 403, 'Non sei autorizzato ad accedere alla stanza.');
      if (!operation && req.method === 'GET') return send(res, 200, { ok: true, state: snapshot(room, bearer) });
      if (operation === 'events' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        me.streams.add(res);
        res.write(`event: state\ndata: ${JSON.stringify(snapshot(room, bearer))}\n\n`);
        notify(room);
        const keepalive = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) {} }, 18000);
        req.on('close', () => { clearInterval(keepalive); me.streams.delete(res); notify(room); });
        return;
      }
      if (operation === 'action' && req.method === 'POST') {
        if (payload.action === 'progress') {
          if (room.phase !== 'playing') return send(res, 200, { ok: true });
          me.progress = Math.max(0, Math.min(6, Math.floor(Number(payload.count) || 0)));
          notify(room);
          return send(res, 200, { ok: true });
        }
        if (payload.action === 'submit') {
          if (room.phase !== 'playing') return fail(res, 409, 'Questa partita non è in corso.');
          if (Date.now() < me.cooldownUntil) return fail(res, 429, 'Attendi alcuni secondi prima di un nuovo tentativo.');
          if (!validateSolution(room.puzzle, payload.board, payload.accused)) {
            me.cooldownUntil = Date.now() + 8000;
            notify(room);
            return fail(res, 422, 'La ricostruzione o l’accusa non è corretta. Rileggi gli indizi.');
          }
          room.phase = 'finished'; room.finishedAt = Date.now();
          room.result = { winnerId: me.id, winnerName: me.name, elapsedMs: room.finishedAt - room.startedAt,
            killer: room.puzzle.killer, killerName: room.puzzle.characters.find(p => p.id === room.puzzle.killer).name };
          me.progress = 6;
          me.wins += 1;
          notify(room);
          return send(res, 200, { ok: true, success: true, state: snapshot(room, bearer) });
        }
        if (payload.action === 'rematch') {
          if (room.phase !== 'finished') return fail(res, 409, 'Attendi la conclusione della sfida.');
          me.ready = true;
          if (room.players.length === 2 && room.players.every(p => p.ready)) startRound(room);
          else notify(room);
          return send(res, 200, { ok: true });
        }
        return fail(res, 400, 'Azione non supportata.');
      }
      return fail(res, 405, 'Metodo non consentito.');
    }
    if (route.startsWith('/api/')) return fail(res, 404, 'Endpoint inesistente.');
    if (req.method === 'GET' || req.method === 'HEAD') return handleStatic(req, res, route);
    return fail(res, 405, 'Metodo non consentito.');
  } catch (error) {
    console.error('Request error:', error.message);
    return fail(res, 400, error.message || 'Si è verificato un errore.');
  }
});
server.listen(PORT, HOST, () => console.log(`Delitto in Griglia disponibile su http://localhost:${PORT}`));
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > 6 * 60 * 60 * 1000 && room.players.every(p => p.streams.size === 0)) rooms.delete(code);
  }
}, 15 * 60 * 1000).unref();
