/**
 * Why index n (the very end of a list) may be unreachable by dragging.
 *
 * The response curve in dropcurve.mjs is monotonic and lands at n-1 for every
 * aim point inside the last card, which is correct: dropping inside a card
 * means "above it". Reaching n needs a drop below the last card, and that
 * region is where the column footer lives. This measures the actual geometry
 * so the fix targets the real gap rather than a guess.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

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
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    wsUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? null;
  } catch { /* not up */ }
  if (!wsUrl) await sleep(250);
}
if (!wsUrl) throw new Error('no CDP target');

const ws = new WebSocket(wsUrl);
await new Promise((ok) => ws.addEventListener('open', ok));
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
const evaluate = async (e) => (await send('Runtime.evaluate', {
  expression: e, returnByValue: true, awaitPromise: true,
})).result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: `${APP_URL}/login` });
await sleep(1500);
await evaluate(`localStorage.setItem('taskboard.auth', ${JSON.stringify(JSON.stringify({ token: TOKEN, user: seed.user }))}); 'ok'`);
await send('Page.navigate', { url: `${APP_URL}/boards/${BOARD}` });
await sleep(4000);

const out = await evaluate(`(() => {
  const drops = [...document.querySelectorAll('[data-rfd-droppable-id]')]
    .filter((d) => d.getAttribute('data-rfd-droppable-id') !== 'board');
  return JSON.stringify(drops.map((t) => {
    const tb = t.getBoundingClientRect();
    const cards = [...t.querySelectorAll('[data-rfd-draggable-id]')];
    const last = cards.length ? cards[cards.length - 1].getBoundingClientRect() : null;
    const cs = getComputedStyle(t);
    const footer = t.nextElementSibling;
    const fb = footer ? footer.getBoundingClientRect() : null;
    return {
      list: t.getAttribute('data-rfd-droppable-id').slice(0, 8),
      cards: cards.length,
      droppableTop: Math.round(tb.top), droppableBottom: Math.round(tb.bottom),
      lastCardBottom: last ? Math.round(last.bottom) : null,
      gapBelowLastCard: last ? Math.round(tb.bottom - last.bottom) : null,
      paddingBottom: cs.paddingBottom,
      clientH: t.clientHeight, scrollH: t.scrollHeight,
      scrolls: t.scrollHeight > t.clientHeight + 1,
      footerTop: fb ? Math.round(fb.top) : null,
      footerIsSibling: !!footer,
      footerInsideDroppable: footer ? !!footer.closest('[data-rfd-droppable-id]') : null,
    };
  }), null, 2);
})()`);

console.log(out);
ws.close();
child.kill();
