/**
 * Verifies the MEMBER_UPDATED WebSocket event: does a board member's client
 * actually receive a live frame when the owner changes somebody's role?
 *
 * Usage: BASE=http://localhost:8081 node tools/wsmemberupd.mjs
 * Env: BASE, STATE (.verify-state.json), BOARD
 *
 * The role endpoint's REST behaviour is covered by the backend unit tests, but
 * those cannot show whether the event is published to /topic/board/{boardId}
 * at all. This subscribes as a real member and checks the frame.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:8081';
const NUL = '\0';
const state = JSON.parse(
  readFileSync(resolve(process.env.STATE ?? '.verify-state.json'), 'utf8').replace(/^\uFEFF/, '')
);
const BOARD = process.env.BOARD ?? state.board2;
const OWNER = state.owner;
const OBSERVER = state.mem;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const frame = (cmd, headers) =>
  cmd + '\n' + Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n') + '\n\n' + NUL;

const events = [];
const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws-board/websocket`);

ws.addEventListener('message', (ev) => {
  const raw = typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8');
  for (const chunk of raw.split(NUL)) {
    if (!chunk.trim()) continue;
    const lines = chunk.split('\n');
    const command = lines[0];
    const blankAt = lines.indexOf('');
    const headerLines = blankAt === -1 ? lines.slice(1) : lines.slice(1, blankAt);
    const body = blankAt === -1 ? '' : lines.slice(blankAt + 1).join('\n');
    const headers = Object.fromEntries(
      headerLines.filter((l) => l.includes(':')).map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()])
    );
    if (command === 'MESSAGE') {
      events.push({ destination: headers.destination, body });
      console.log(`  << MESSAGE ${headers.destination}`);
      console.log(`     ${body.slice(0, 260)}`);
    }
    if (command === 'ERROR') {
      console.log(`  << ERROR frame: ${(headers.message ?? '').slice(0, 160)}`);
    }
  }
});

await new Promise((ok, bad) => {
  ws.addEventListener('open', ok);
  ws.addEventListener('error', () => bad(new Error('socket error')));
  setTimeout(() => bad(new Error('socket open timeout')), 8000);
});

ws.send(frame('CONNECT', {
  'accept-version': '1.2', 'heart-beat': '0,0', host: 'localhost',
  Authorization: `Bearer ${OBSERVER}`,
}));
await sleep(1200);
ws.send(frame('SUBSCRIBE', { id: 'sub-0', destination: `/topic/board/${BOARD}`, ack: 'auto' }));
await sleep(600);

const target = process.env.TARGET_USER;
const newRole = process.env.NEW_ROLE ?? 'MEMBER';
console.log(`owner promotes ${target} -> ${newRole} while a member watches the topic`);

const updated = await api(`/boards/${BOARD}/members/${target}/role`, {
  method: 'PATCH', token: OWNER, body: { role: newRole },
});
console.log(`role endpoint -> ${updated.role}`);

await sleep(2500);
ws.close();

const memberUpdated = events.filter((e) => e.body.includes('MEMBER_UPDATED'));
console.log(`\nframes received: ${events.length}, of which MEMBER_UPDATED: ${memberUpdated.length}`);
if (memberUpdated.length > 0) {
  console.log('RESULT: OK - role change broadcast to the board topic');
} else {
  console.log('RESULT: MISSING - no MEMBER_UPDATED frame reached the member');
  process.exitCode = 1;
}