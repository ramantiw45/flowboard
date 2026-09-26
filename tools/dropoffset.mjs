/**
 * Debug: reproduce the uicheck "bottom of target" aim point and report what
 * the droppable geometry and the resulting index actually were, so the
 * off-by-one is measured rather than guessed at.
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
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const seed = JSON.parse(readFileSync(resolve('.uiqa/seed.json'), 'utf8').replace(/^\uFEFF/, ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
  '--hide-scrollbars', '--window-size=1440,900',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${join(OUT_DIR, 'chrome-profile')}`,
  'about:blank',
], { detached: true, stdio: 'ignore' });
child.unref();

let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) {
  try {
    const t = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    wsUrl = t.find((x) => x.type === 'page')?.webSocketDebuggerUrl ?? null;
  } catch { /* not up */ }
  if (!wsUrl) await sleep(250);
}
const ws = new WebSocket(wsUrl);
await new Promise((ok) => ws.addEventListener('open', ok));
let id = 0;
const pend = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pend.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', {
  type, x: Math.round(x), y: Math.round(y), button: 'left',
  buttons: type === 'mouseReleased' ? 0 : 1, clickCount: type === 'mouseMoved' ? 0 : 1, pointerType: 'mouse',
});
const json = async (p) => (await fetch(`${BASE}/api${p}`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: `${APP_URL}/login` });
await sleep(1500);
await evaluate(`localStorage.setItem('taskboard.auth', ${JSON.stringify(JSON.stringify({ token: TOKEN, user: seed.user }))}); 'ok'`);
await send('Page.navigate', { url: `${APP_URL}/boards/${BOARD}` });
await sleep(4000);

// The board renders asynchronously from the API, so wait for a droppable that
// actually has cards before measuring anything.
for (let i = 0; i < 40; i++) {
  const ready = await evaluate(
    `[...document.querySelectorAll('[data-rfd-droppable-id]')].some((d) => d.querySelector('[data-rfd-draggable-id]'))`
  );
  if (ready) break;
  await sleep(500);
}

for (const offset of [4, 10, 20, 40, 80, 140]) {
  const lists = (await json(`/boards/${BOARD}`)).lists;
  const source = lists.find((l) => l.cards.length > 0);
  const target = lists.find((l) => l.id !== source.id);
  const n = target.cards.length;

  const g = JSON.parse(await evaluate(`(() => {
    const drops = [...document.querySelectorAll('[data-rfd-droppable-id]')]
      .filter((d) => d.getAttribute('data-rfd-droppable-id') !== 'board');
    const t = drops.find((d) => d.getAttribute('data-rfd-droppable-id') === ${JSON.stringify(target.id)});
    const tb = t.getBoundingClientRect();
    let cards = [...t.querySelectorAll('[data-rfd-draggable-id]')];
    const l = cards[cards.length - 1].getBoundingClientRect();
    const s = drops.find((d) => d.getAttribute('data-rfd-droppable-id') === ${JSON.stringify(source.id)});
    const sc = s.querySelector('[data-rfd-draggable-id]');
    sc.scrollIntoView({ block: 'nearest' });
    const sb = sc.getBoundingClientRect();
    return JSON.stringify({
      card: sc.innerText.split('\\n')[0].slice(0, 30),
      gap: Math.round(tb.bottom - (l.y + l.height)),
      aimY: Math.round(tb.bottom - ${offset}),
      dropBottom: Math.round(tb.bottom),
      from: { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 },
      to: { x: tb.x + tb.width / 2, y: tb.bottom - ${offset} },
    });
  })()`));

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
  const idx = after.cards.findIndex((c) => c.title === g.card);
  console.log(`offset +${String(offset).padStart(2)}px  gap=${g.gap}  aimY=${g.aimY} dropBottom=${g.dropBottom}  n=${n} -> idx ${idx} ${idx === n ? 'END OK' : ''}`);
}

ws.close();
child.kill();
