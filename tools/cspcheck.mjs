/**
 * Does the Content-Security-Policy actually break the app?
 *
 * A CSP that blocks the bundle, the API or the WebSocket is worse than no CSP
 * at all, because the app silently stops working. This serves the production
 * build over the built-in preview server (which sends the policy as a header),
 * drives a real login and board load through Chrome, and reports every
 * CSP violation the browser logged.
 *
 * Usage: node tools/cspcheck.mjs
 * Env: APP_URL (default http://localhost:4173), CDP_PORT, QA_TOKEN, QA_BOARD_ID
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const APP_URL = process.env.APP_URL ?? 'http://localhost:4173';
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
const bin = CHROME_CANDIDATES.find((p) => existsSync(p));

const child = spawn(bin, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--hide-scrollbars', '--window-size=1440,900',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${join(OUT_DIR, 'chrome-profile-csp')}`,
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
if (!wsUrl) throw new Error('no CDP page target');

const ws = new WebSocket(wsUrl);
await new Promise((ok) => ws.addEventListener('open', ok));

let msgId = 0;
const pending = new Map();
const violations = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Log.entryAdded') {
    const e = m.params.entry;
    if (/Content Security Policy|Refused to/i.test(e.text)) {
      violations.push({ level: e.level, text: e.text, url: e.url });
    }
  }
  if (m.method === 'Runtime.exceptionThrown') {
    violations.push({ level: 'exception', text: m.params.exceptionDetails?.text ?? 'exception' });
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    const text = (m.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ');
    if (/error|fail|refus|cannot|blocked/i.test(text)) {
      consoleErrors.push(text);
    }
  }
});

const consoleErrors = [];
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++msgId;
  pending.set(id, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

const resp = await fetch(APP_URL);
const cspHeader = resp.headers.get('content-security-policy');
console.log(`CSP header from ${APP_URL}: ${cspHeader ? 'present' : 'ABSENT'}`);
if (cspHeader) console.log(`  ${cspHeader}`);

await send('Page.navigate', { url: `${APP_URL}/login` });
await sleep(2500);
await evaluate(`localStorage.setItem('taskboard.token', ${JSON.stringify(TOKEN)}); localStorage.setItem('taskboard.user', ${JSON.stringify(JSON.stringify(seed.user))}); 'ok'`);
await send('Page.navigate', { url: `${APP_URL}/boards/${BOARD}` });
await sleep(5000);

const rendered = await evaluate(`(() => ({
  rootChildren: document.getElementById('root')?.childElementCount ?? 0,
  text: (document.body.innerText || '').slice(0, 160).replace(/\\s+/g, ' '),
  lists: document.querySelectorAll('[data-rfd-droppable-id]').length,
  cards: document.querySelectorAll('[data-rfd-draggable-id]').length,
}))()`);

console.log(`\nrendered: root children=${rendered?.rootChildren} droppables=${rendered?.lists} cards=${rendered?.cards}`);
console.log(`visible text: "${rendered?.text}"`);

console.log(`\nCSP violations logged: ${violations.length}`);
for (const v of violations.slice(0, 12)) console.log(`  [${v.level}] ${v.text.slice(0, 200)}`);

console.log(`\nconsole errors: ${consoleErrors.length}`);
for (const e of consoleErrors.slice(0, 10)) console.log(`  ${e.slice(0, 200)}`);

ws.close();
child.kill();
process.exitCode = violations.length === 0 && rendered?.rootChildren > 0 ? 0 : 1;
