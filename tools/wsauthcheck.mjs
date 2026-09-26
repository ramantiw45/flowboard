/**
 * WebSocket authorization probe: can a NON-member read another board's live
 * event stream by subscribing to /topic/board/{boardId}?
 *
 * Usage: node tools/wsauthcheck.mjs
 * Env: BASE (default http://localhost:8080), QA_SEED (.uiqa/seed.json)
 *
 * The backend only authenticates STOMP CONNECT frames (JwtChannelInterceptor);
 * SUBSCRIBE destinations are handed to the simple broker unchecked. This
 * script signs up a brand-new user that is NOT a member of the QA board, opens
 * a SockJS raw-WebSocket, subscribes to that board's topic and then makes a
 * real member mutate the board. If the outsider receives card or activity
 * frames, board data leaks to non-members.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:8080';
const NUL = '\0';
const seed = JSON.parse(
  readFileSync(resolve(process.env.QA_SEED ?? '.uiqa/seed.json'), 'utf8').replace(/^\uFEFF/, '')
);
const BOARD = seed.boardId;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = Date.now();

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : null;
}

const frame = (cmd, headers) =>
  cmd + '\n' + Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n') + '\n\n' + NUL;

const outsider = await api('/auth/signup', {
  method: 'POST',
  body: { email: `qa.wsoutsider.${stamp}@example.com`, displayName: 'WS Outsider', password: 'Passw0rd!23' },
});
console.log(`outsider signed up: ${outsider.user.email} (NOT a member of board ${BOARD})`);

// Sanity: REST access to that board must be denied.
const restStatus = await fetch(`${BASE}/api/boards/${BOARD}`, {
  headers: { Authorization: `Bearer ${outsider.token}` },
}).then((r) => r.status);
console.log(`REST  GET /api/boards/${BOARD} as outsider -> ${restStatus} (expected 403)`);

const received = [];
const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws-board/websocket`);

ws.addEventListener('message', (ev) => {
  const raw = typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8');
  for (const chunk of raw.split(NUL)) {
    if (!chunk.trim()) continue;
    const lines = chunk.split('\n');
    const command = lines[0];
    const blankAt = lines.indexOf('');
    const headerLines = (blankAt === -1 ? lines.slice(1) : lines.slice(1, blankAt));
    const body = blankAt === -1 ? '' : lines.slice(blankAt + 1).join('\n');
    const headers = Object.fromEntries(
      headerLines.filter((l) => l.includes(':')).map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()])
    );
    console.log(`  << ${command}${headers.subscription ? ` (sub ${headers.subscription})` : ''}`);
    if (command === 'MESSAGE') {
      received.push(body);
      console.log(`     LEAK -> ${headers.destination}\n     body: ${body.slice(0, 300)}`);
    }
    if (command === 'ERROR') {
      console.log(`     ERROR frame: ${(headers.message ?? '').slice(0, 120)}`);
    }
  }
});

await new Promise((ok, bad) => {
  ws.addEventListener('open', ok);
  ws.addEventListener('error', () => bad(new Error('socket error')));
  setTimeout(() => bad(new Error('socket open timeout')), 8000);
});

ws.send(frame('CONNECT', {
  'accept-version': '1.2',
  'heart-beat': '0,0',
  host: 'localhost',
  Authorization: `Bearer ${outsider.token}`,
}));
await sleep(1200);

ws.send(frame('SUBSCRIBE', { id: 'sub-0', destination: `/topic/board/${BOARD}`, ack: 'auto' }));
await sleep(600);

// A real member mutates the board -> an event is published to that topic.
const detail = await api(`/boards/${BOARD}`, { token: seed.token });
const listId = detail.lists[0].id;
const created = await api(`/boards/${BOARD}/lists/${listId}/cards`, {
  method: 'POST',
  token: seed.token,
  body: { title: `WS AUTHZ PROBE ${stamp}`, priority: 'URGENT', description: 'sensitive text' },
});
console.log(`member created card ${created.id} in "${detail.lists[0].name}"`);

await sleep(2500);
ws.close();

console.log(`\nframes delivered to the non-member outsider: ${received.length}`);
if (received.length > 0) {
  console.log('RESULT: VULNERABLE - non-member received live board events on /topic/board/{id}');
  process.exitCode = 1;
} else {
  console.log('RESULT: OK - outsider received no board events');
}
