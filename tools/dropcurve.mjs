/**
 * Drop-index response probe.
 *
 * The droptest scenario reported "bottom of target" landing one slot short.
 * Before changing any layout code, this measures HOW the library maps a drop
 * pixel to a resulting index: it drags one card to a series of aim points
 * down the last card of a target list and prints the index the server ends up
 * with. A smooth, monotonic curve means the drop maths is healthy and the
 * scenario simply aims too high. An erratic or clamped curve points at the
 * nested-scroll-container corruption the library warns about.
 *
 * Usage: node tools/dropcurve.mjs
 * Env: BASE, APP_URL, CDP_PORT, QA_TOKEN, QA_BOARD_ID, QA_OUT
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const BASE = process.env.BASE ?? 'http://localhost:8080';
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
const CDP_PORT = Number(process.env.CDP_PORT ?? 9222);
const BOARD = process.env.QA_BOARD_ID;
const TOKEN = process.env.QA_TOKEN;
const OUT_DIR = resolve(process.env.QA_OUT ?? '.uiqa');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const seed = JSON.parse(readFileSync(resolve('.uiqa/seed.json'), 'utf8').replace(/^\uFEFF/, ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpEndpoint() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* browser not up yet */ }
    await sleep(250);
  }
  throw new Error('no CDP page target in time');
}

const bin = CHROME_CANDIDATES.find((p) => existsSync(p));
const child = spawn(bin, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--hide-scrollbars', '--window-size=1440,900',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${join(OUT_DIR, 'chrome-profile')}`,
  'about:blank',
], { detached: true, stdio: 'ignore' });
child.unref();

const wsUrl = await cdpEndpoint();
const ws = new WebSocket(wsUrl);
await new Promise((ok, bad) => {
  ws.addEventListener('open', ok);
  setTimeout(() => bad(new Error('ws open timeout')), 8000);
});

let msgId = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++msgId;
  pending.set(id, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', {
  type, x: Math.round(x), y: Math.round(y), button: 'left',
  buttons: type === 'mouseReleased' ? 0 : 1,
  clickCount: type === 'mouseMoved' ? 0 : 1, pointerType: 'mouse',
});
const navigate = async (url, wait = 2500) => { await send('Page.navigate', { url }); await sleep(wait); };
const json = async (path) => (await fetch(`${BASE}/api${path}`, {
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
})).json();

await send('Page.enable');
await send('Runtime.enable');
await navigate(`${APP_URL}/login`, 1500);
await evaluate(`localStorage.setItem('taskboard.auth', ${JSON.stringify(JSON.stringify({ token: TOKEN, user: seed.user }))}); 'ok'`);
await navigate(`${APP_URL}/boards/${BOARD}`, 4000);

const FRACTIONS = [0.25, 0.4, 0.5, 0.6, 0.75, 0.9];
const results = [];

for (const frac of FRACTIONS) {
  const lists = (await json(`/boards/${BOARD}`)).lists;
  const source = lists.find((l) => l.cards.length > 0);
  const target = lists.find((l) => l.id !== source.id && l.cards.length > 1);
  if (!source || !target) { console.log('need two lists with cards'); break; }
  const n = target.cards.length;

  const g = JSON.parse(await evaluate(`(() => {
    const drops = [...document.querySelectorAll('[data-rfd-droppable-id]')]
      .filter((d) => d.getAttribute('data-rfd-droppable-id') !== 'board');
    const t = drops.find((d) => d.getAttribute('data-rfd-droppable-id') === ${JSON.stringify(target.id)});
    if (!t) return JSON.stringify({ error: 'target droppable missing' });
    const cards = [...t.querySelectorAll('[data-rfd-draggable-id]')];
    if (!cards.length) return JSON.stringify({ error: 'no cards in target' });
    const last = cards[cards.length - 1].getBoundingClientRect();
    const tb = t.getBoundingClientRect();
    const s = drops.find((d) => d.getAttribute('data-rfd-droppable-id') === ${JSON.stringify(source.id)});
    const sc = s.querySelector('[data-rfd-draggable-id]');
    sc.scrollIntoView({ block: 'nearest' });
    const sb = sc.getBoundingClientRect();
    return JSON.stringify({
      card: sc.innerText.split('\\n')[0].slice(0, 32),
      from: { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 },
      to: { x: tb.x + tb.width / 2, y: last.y + last.height * ${frac} },
    });
  })()`));
  if (g.error) { console.log(g.error); break; }

  await mouse('mousePressed', g.from.x, g.from.y);
  await sleep(120);
  for (let i = 1; i <= 20; i++) {
    const t2 = i / 20;
    await mouse('mouseMoved', g.from.x + (g.to.x - g.from.x) * t2, g.from.y + (g.to.y - g.from.y) * t2);
    await sleep(22);
  }
  await sleep(150);
  await mouse('mouseReleased', g.to.x, g.to.y);
  await sleep(1800);

  const after = (await json(`/boards/${BOARD}`)).lists.find((l) => l.id === target.id);
  const idx = after ? after.cards.findIndex((c) => c.title === g.card) : -1;
  results.push({ frac, n, idx });
  console.log(`aim ${(frac * 100).toFixed(0).padStart(3)}% down last card (n=${n}) -> index ${idx}${idx === n ? ' OK' : ''}`);
}

console.log('\naim%   n   landed   hit-end?');
for (const r of results) {
  console.log(`${(r.frac * 100).toFixed(0).padStart(4)}  ${String(r.n).padStart(2)}   ${String(r.idx).padStart(6)}   ${r.idx === r.n ? 'yes' : 'no'}`);
}

ws.close();
child.kill();

