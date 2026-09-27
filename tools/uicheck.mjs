/**
 * Zero-dependency browser QA harness (Chrome DevTools Protocol over WebSocket).
 *
 * Usage: node tools/uicheck.mjs <scenario>
 * Scenarios: login | register | dashboard | board
 *
 * Env: APP_URL (default http://localhost:5173), CDP_PORT (9222),
 *      QA_TOKEN, QA_USER (JSON), QA_BOARD_ID, QA_OUT (default .uiqa)
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
const CDP_PORT = Number(process.env.CDP_PORT ?? 9222);
const OUT_DIR = resolve(process.env.QA_OUT ?? '.uiqa');
const TOKEN = process.env.QA_TOKEN ?? '';
const USER_JSON = process.env.QA_USER ?? '{}';
const BOARD_ID = process.env.QA_BOARD_ID ?? '';

/**
 * Backend base, for the in-page login.
 *
 * Defaults to a same-origin '/api' so the request goes through the Vite dev or
 * preview proxy. That is not just convenience: a `SameSite=Lax` cookie is
 * withheld from cross-site XHR, so a cross-origin login would store the session
 * cookie and then never send it. Override with QA_API to talk to a backend
 * directly (the QA scripts that are not browser-based still do this).
 */
const API_BASE = process.env.QA_API ?? '/api';
/** QA account credentials, from .uiqa/seed.json. */
const QA_EMAIL = process.env.QA_EMAIL ?? 'qa.raman@example.com';
const QA_PASSWORD = process.env.QA_PASSWORD ?? 'Passw0rd!23';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpEndpoint() {
  try {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const targets = await res.json();
    const page = targets.find((t) => t.type === 'page');
    if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
  } catch {
    /* browser not up yet */
  }
  return null;
}

async function launchBrowser() {
  const bin = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!bin) throw new Error('No Chrome/Edge binary found');
  const profile = join(OUT_DIR, 'chrome-profile');
  const child = spawn(
    bin,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--hide-scrollbars',
      '--window-size=1440,900',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const url = await cdpEndpoint();
    if (url) return url;
  }
  throw new Error('Browser did not expose a CDP page target in time');
}

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.problems = [];
    this.wsFrames = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: ok, reject: bad } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) bad(new Error(JSON.stringify(msg.error)));
        else ok(msg.result);
        return;
      }
      this.onEvent(msg);
    });
  }

  onEvent(msg) {
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      this.problems.push(`[exception] ${d.exception?.description ?? d.text}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      const text = msg.params.args
        .map((a) => {
          if ('value' in a) return typeof a.value === 'string' ? a.value : JSON.stringify(a.value);
          if (a.preview?.properties) {
            return a.preview.properties.map((p) => `${p.name}:${p.value}`).join(',');
          }
          if (a.description) return a.description;
          return `<${a.className || a.subtype || a.type}>`;
        })
        .join(' | ');
      this.problems.push(`[console.${msg.params.type}] ${text}`);
    }
    if (msg.method === 'Log.entryAdded' && ['error', 'warning'].includes(msg.params.entry.level)) {
      const e = msg.params.entry;
      this.problems.push(`[log.${e.level}] ${e.text} ${e.url ?? ''}`.trim());
    }
    if (msg.method === 'Network.webSocketFrameReceived') {
      const payload = msg.params.response?.payloadData ?? '';
      if (payload.includes('"ACTIVITY"') && this.wsFrames.length < 4) {
        this.wsFrames.push(payload.slice(0, 420));
      }
    }
    if (msg.method === 'Network.loadingFailed' && !msg.params.canceled) {
      this.problems.push(`[net-fail] ${msg.params.errorText} (${msg.params.type})`);
    }
    if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) {
      this.problems.push(`[http-${msg.params.response.status}] ${msg.params.response.url}`);
    }
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, bad) => this.pending.set(id, { resolve: ok, reject: bad }));
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`eval failed: ${res.exceptionDetails.exception?.description ?? 'unknown'}`);
    }
    return res.result?.value;
  }

  async ready() {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Log.enable');
    await this.send('Network.enable');
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  async goto(path, settle = 1500) {
    // Let any in-flight page load finish first. Navigating twice in quick
    // succession aborts the command that is waiting on the first, which surfaces
    // as CDP's "Inspected target navigated or closed".
    await sleep(300);
    await this.send('Page.navigate', { url: `${APP_URL}${path}` });
    await sleep(settle);
  }

  async shot(name) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    mkdirSync(OUT_DIR, { recursive: true });
    const file = join(OUT_DIR, `${name}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(`shot -> ${file}`);
  }

  /**
   * Signs in through the real API, from inside the page.
   *
   * The session is an HttpOnly cookie, so it cannot be injected from script -
   * writing localStorage would do nothing (and that is the point of the change).
   * Calling /auth/login with credentials:'include' lets the browser store the
   * cookie exactly as a real user's browser would, which is what makes this a
   * genuine end-to-end check rather than a shortcut.
   */
  async setSession() {
    // A page must be loaded before fetch can run, and it must be one the app
    // will not immediately redirect away from. `/login` renders for everyone,
    // signed in or not, so it is the safe place to hold a session.
    await this.goto('/login', 1200);
    // Ask Chrome directly why a Set-Cookie was not stored. Without this the
    // only signal is "the board will not load", which does not distinguish a
    // rejected cookie from a rejected request.
    await this.send('Network.enable');
    const rejected = [];
    const onExtra = (msg) => {
      if (msg.method !== 'Network.responseReceivedExtraInfo') return;
      const cookies = msg.params.headers?.['set-cookie'] ?? msg.params.headers?.['Set-Cookie'];
      if (Array.isArray(cookies)) {
        for (const c of cookies) {
          if (c.startsWith('taskboard.')) {
            rejected.push({ cookie: c.slice(0, 60), blocked: msg.params.blockedReasons });
          }
        }
      }
    };
    this.ws.addEventListener('message', (ev) => {
      try {
        onExtra(JSON.parse(ev.data));
      } catch {
        /* ignore malformed frame */
      }
    });

    const login = await this.evaluate(
      `fetch(${JSON.stringify(API_BASE + '/auth/login')}, {
         method: 'POST',
         credentials: 'include',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(${JSON.stringify({ email: QA_EMAIL, password: QA_PASSWORD })}),
       }).then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 120) }))
        .catch((e) => ({ status: 0, body: String(e) }))`
    );
    await sleep(400);
    if (login?.status !== 200) {
      this.problems.push(`setSession: login failed (${login?.status}) ${login?.body}`);
    }
    // Query the app origin: the session cookies are scoped to /api, and
    // getCookies matches by URL, so the API path has to be included.
    const { cookies } = await this.send('Network.getCookies', {
      urls: [`${APP_URL}/`, `${APP_URL}/api/auth/me`],
    });
    const summary = cookies
      .map((c) => `${c.name}(httpOnly=${c.httpOnly},sameSite=${c.sameSite},path=${c.path})`)
      .join(' ');
    console.log(`setSession: login ${login?.status}; stored -> ${summary || '(none)'}`);
    for (const r of rejected) {
      console.log(`setSession: cookie ${r.cookie}... blockedReasons=${JSON.stringify(r.blocked)}`);
    }
    if (!cookies.some((c) => c.name.startsWith('taskboard'))) {
      this.problems.push('setSession: login returned 200 but no taskboard.* cookie was stored');
      return login;
    }

    // The decisive check: a GET that carries nothing but the cookie must
    // authenticate. If the browser is withholding the cookie (SameSite on a
    // cross-site request), this answers 401 even though the cookie is stored -
    // which is precisely the failure this harness exists to catch.
    const me = await this.evaluate(
      `fetch(${JSON.stringify(API_BASE + '/auth/me')}, { credentials: 'include' })
         .then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 80) }))
         .catch((e) => ({ status: 0, body: String(e) }))`
    );
    console.log(`setSession: cookie-only GET /auth/me -> ${me?.status}`);
    if (me?.status !== 200) {
      this.problems.push(
        `setSession: cookies are stored but NOT sent: /auth/me returned ${me?.status}`
      );
    }
    return login;
  }

  /** React-safe input fill (bypasses the controlled-input value tracker). */
  async fill(selector, value) {
    return this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return 'no-element';
      const proto = el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return 'filled';
    })()`);
  }

  async clickText(selector, text) {
    return this.evaluate(`(() => {
      const wanted = ${JSON.stringify(text.toLowerCase())};
      const hit = [...document.querySelectorAll(${JSON.stringify(selector)})].find((n) =>
        (n.textContent || '').trim().toLowerCase().includes(wanted)
      );
      if (!hit) return 'not-found';
      hit.click();
      return 'clicked';
    })()`);
  }

  async escape() {
    await this.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); 'ok'`);
  }

  /**
   * A real key press through the input pipeline.
   *
   * The synthetic window events used elsewhere are not enough for the keyboard
   * work: focus only moves in response to a trusted key event, and the dialog's
   * own focus trap is a capture-phase listener that the sensor stack also sees.
   * Both need the browser to believe a person pressed the key.
   */
  async key(name, { shift = false } = {}) {
    const KEYS = {
      Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
      Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
      Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
      ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 },
      ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 },
      Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' },
    };
    const k = KEYS[name];
    if (!k) throw new Error(`unmapped key: ${name}`);
    const base = { ...k, modifiers: shift ? 8 : 0 };
    // A printable key needs keyDown (not rawKeyDown) so the browser also emits
    // the character; navigation keys must not carry text or they insert it.
    const type = k.text ? 'keyDown' : 'rawKeyDown';
    await this.send('Input.dispatchKeyEvent', { type, ...base });
    if (k.text) await this.send('Input.dispatchKeyEvent', { type: 'char', ...base });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    await sleep(120);
  }

  /** Raw mouse input so @hello-pangea/dnd sees a genuine pointer drag. */
  async mouse(type, x, y, extra = {}) {
    await this.send('Input.dispatchMouseEvent', {
      type,
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      buttons: type === 'mouseReleased' ? 0 : 1,
      clickCount: type === 'mouseMoved' ? 0 : 1,
      pointerType: 'mouse',
      ...extra,
    });
  }

  /** Press -> N interpolated moves -> release, like a human drag. */
  async dragTo(from, to, steps = 18) {
    await this.mouse('mousePressed', from.x, from.y);
    await sleep(120);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await this.mouse('mouseMoved', from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      await sleep(22);
    }
    await sleep(120);
    await this.mouse('mouseReleased', to.x, to.y);
  }

  report() {
    console.log(`problems: ${this.problems.length}`);
    this.problems.forEach((p) => console.log('  ' + p));
  }
}

async function connect() {
  let url = await cdpEndpoint();
  if (!url) url = await launchBrowser();
  const ws = new WebSocket(url);
  await new Promise((ok, bad) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => bad(new Error('CDP socket error')), { once: true });
  });
  const session = new Session(ws);
  await session.ready();
  return session;
}

async function runLogin(s) {
  await s.goto('/login', 2500);
  await s.shot('01-login');
  await s.fill('input[type="email"]', 'nobody@example.com');
  await s.fill('input[type="password"]', 'wrong-password');
  await s.evaluate(`document.querySelector('form').requestSubmit(); 'submitted'`);
  await sleep(2500);
  await s.shot('02-login-error-toast');
}

async function runRegister(s) {
  await s.goto('/register', 2500);
  await s.shot('03-register');
}

async function runDashboard(s) {
  await s.setSession();
  await s.goto('/boards', 3000);
  await s.shot('04-dashboard');
  await s.goto('/boards?new=1', 1800);
  await s.shot('05-create-board-modal');
  await s.escape();
  await sleep(700);
  await s.goto('/boards', 2000);
  await s.fill('input[placeholder="Search boards…"]', 'zzz');
  await sleep(900);
  await s.shot('06-dashboard-no-match');
}

async function runBoard(s) {
  // Sign in BEFORE the first navigation to a protected route. The session is an
  // HttpOnly cookie, so it has to be in the browser's store before the app
  // mounts and asks /auth/me; a page loaded first would render the signed-out
  // shell and then redirect.
  await s.setSession();
  await s.goto(`/boards/${BOARD_ID}`, 3500);
  await s.shot('07-board');

  console.log('toggle feed:', await s.clickText('button', 'Activity'));
  await sleep(900);
  await s.shot('08-board-feed-hidden');
  await s.clickText('button', 'Activity');
  await sleep(900);

  const card = await s.evaluate(`(() => {
    const el = [...document.querySelectorAll('div.group')].find((d) => d.querySelector('p'));
    if (!el) return 'no-card';
    el.click();
    return 'clicked';
  })()`);
  console.log('card click:', card);
  await sleep(1600);
  await s.shot('09-card-details-modal');
  await s.escape();
  await sleep(800);

  console.log('invite:', await s.clickText('button', 'Invite'));
  await sleep(1300);
  await s.shot('10-invite-modal');
  await s.escape();
  await sleep(800);

  // List overflow menu -> rename editor -> delete confirmation dialog (then cancel).
  const menu = await s.evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      (b.getAttribute('aria-label') || '').startsWith('Actions for')
    );
    if (!btn) return 'no-menu-button';
    btn.click();
    return 'opened';
  })()`);
  console.log('list menu:', menu);
  await sleep(900);
  await s.shot('11-list-menu');
  console.log('delete item:', await s.clickText('button', 'Delete list'));
  await sleep(1200);
  await s.shot('12-confirm-dialog');
  await s.escape();
  await sleep(700);
}

/**
 * Keyboard and dialog-focus check.
 *
 * Everything here is driven with real key events rather than synthetic window
 * ones, because the behaviour under test *is* the browser's own: trusted keys
 * move focus, the dnd keyboard sensor listens for Space, and the dialog's
 * capture-phase Escape/Tab handler has to win over both.
 *
 * Checks, in order:
 *   1. a card is a single tab stop and Enter opens it;
 *   2. the dialog takes focus and keeps it (Tab never escapes to the page);
 *   3. Escape closes the innermost dialog only - the delete confirmation goes
 *      first and the card details behind it stays open;
 *   4. focus returns to the card the dialog was opened from;
 *   5. Space on a card still belongs to the dnd sensor (no dialog, no scroll);
 *   6. the board switcher is operable end to end from the keyboard.
 */
async function runKeyboard(s) {
  await s.setSession();
  await sleep(400);
  await s.goto(`/boards/${BOARD_ID}`, 3500);

  const fail = (m) => s.problems.push(`keyboard: ${m}`);

  /** Where focus is, in a form that is readable in the log. */
  const focusInfo = () =>
    s.evaluate(`(() => {
      const el = document.activeElement;
      if (!el) return 'none';
      return JSON.stringify({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        name: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 34),
        inDialog: !!el.closest('[role="dialog"]'),
        dialogs: document.querySelectorAll('[role="dialog"]').length,
      });
    })()`);

  /**
   * Focus the first *card*.
   *
   * A card is both a draggable and a drag handle; the list header grip is only
   * a handle, so requiring both attributes is what separates the two. Matching
   * on the handle alone silently picked the grip, whose Enter does nothing.
   */
  const focusFirstCard = () =>
    s.evaluate(`(() => {
      const card = document.querySelector('[data-rfd-draggable-id][data-rfd-drag-handle-draggable-id]');
      if (!card) return 'no-card';
      card.focus();
      return JSON.stringify({
        tabIndex: card.getAttribute('tabindex'),
        role: card.getAttribute('role') || '',
        name: (card.getAttribute('aria-label') || '').slice(0, 48),
      });
    })()`);

  // --- 1. a card is one tab stop, and Enter opens it -------------------
  const raw = await focusFirstCard();
  if (raw === 'no-card') {
    fail('no draggable card on the board');
    s.report();
    return;
  }
  const card = JSON.parse(raw);
  console.log(`card: role=${card.role} tabIndex=${card.tabIndex} name="${card.name}"`);
  await s.key('Enter');
  await sleep(1200);
  let f = JSON.parse(await focusInfo());
  console.log(`after Enter: ${JSON.stringify(f)}`);
  if (f.dialogs !== 1) fail(`Enter on a card did not open the details dialog (dialogs=${f.dialogs})`);
  if (!f.inDialog) fail(`dialog opened but focus stayed outside it (on ${f.tag})`);
  await s.shot('26-keyboard-card-open');

  // --- 2. focus is trapped in the dialog -------------------------------
  let escaped = 0;
  const trail = [];
  for (let i = 0; i < 14; i++) {
    await s.key('Tab', { shift: i % 7 === 6 });
    const t = JSON.parse(await focusInfo());
    trail.push(`${t.tag}${t.role ? `[${t.role}]` : ''}:${t.name}`);
    if (!t.inDialog) escaped++;
  }
  console.log(`tab trail: ${trail.join(' -> ')}`);
  if (escaped > 0) fail(`Tab left the dialog ${escaped}/14 times`);
  await s.shot('27-keyboard-trap');

  // --- 3. Escape unwinds one dialog at a time --------------------------
  const openedConfirm = await s.evaluate(`(() => {
    const btn = [...document.querySelectorAll('[role="dialog"] button')]
      .find((b) => /delete/i.test(b.textContent || ''));
    if (!btn) return 'no-delete-button';
    btn.click();
    return 'clicked';
  })()`);
  await sleep(1000);
  let stacked = JSON.parse(await focusInfo());
  console.log(`delete confirm (${openedConfirm}): dialogs=${stacked.dialogs}`);
  if (stacked.dialogs !== 2) fail(`expected 2 stacked dialogs, found ${stacked.dialogs}`);

  await s.key('Escape');
  await sleep(800);
  stacked = JSON.parse(await focusInfo());
  console.log(`after 1st Escape: dialogs=${stacked.dialogs} inDialog=${stacked.inDialog}`);
  if (stacked.dialogs !== 1) fail(`Escape closed down to ${stacked.dialogs} dialogs, expected the innermost only`);
  if (!stacked.inDialog) fail('after dismissing the confirmation focus left the card details dialog');
  await s.shot('28-keyboard-one-escape');

  await s.key('Escape');
  await sleep(800);
  f = JSON.parse(await focusInfo());
  console.log(`after 2nd Escape: dialogs=${f.dialogs} focus=${f.tag}:${f.name}`);
  if (f.dialogs !== 0) fail(`the card details dialog survived Escape (dialogs=${f.dialogs})`);
  if (f.name !== card.name.slice(0, 34)) fail(`focus was not returned to the card (on ${f.tag} "${f.name}")`);

  // --- 4. Space belongs to the drag sensor, not to "open" --------------
  await focusFirstCard();
  const scrollBefore = await s.evaluate(`window.scrollY`);
  await s.key('Space');
  await sleep(500);
  f = JSON.parse(await focusInfo());
  const scrollAfter = await s.evaluate(`window.scrollY`);
  console.log(`after Space: dialogs=${f.dialogs} scrollY ${scrollBefore} -> ${scrollAfter}`);
  if (f.dialogs !== 0) fail('Space on a card opened the dialog, fighting the dnd keyboard sensor');
  if (scrollAfter !== scrollBefore) fail(`Space scrolled the board (${scrollBefore} -> ${scrollAfter})`);
  await s.key('Escape');
  await sleep(400);

  // --- 5. board switcher, keyboard only -------------------------------
  const trigger = await s.evaluate(`(() => {
    const b = [...document.querySelectorAll('button')]
      .find((n) => /^Switch board/.test(n.getAttribute('aria-label') || ''));
    if (!b) return 'no-trigger';
    b.focus();
    return (b.getAttribute('aria-label') || '').slice(0, 44);
  })()`);
  console.log(`switcher trigger: ${trigger}`);
  if (trigger === 'no-trigger') {
    fail('board switcher trigger is missing or unlabelled');
  } else {
    await s.key('Enter');
    await sleep(700);
    const optionState = () =>
      s.evaluate(`(() => {
        const list = document.querySelector('[role="listbox"]');
        const opts = list ? [...list.querySelectorAll('[role="option"]')] : [];
        const i = opts.findIndex((o) => o === document.activeElement);
        return JSON.stringify({ open: !!list, options: opts.length, index: i, selected: i >= 0 ? opts[i].getAttribute('aria-selected') : null });
      })()`);
    let sw = JSON.parse(await optionState());
    console.log(`switcher open: ${JSON.stringify(sw)}`);
    if (!sw.open || sw.options === 0) fail('Enter on the switcher did not open a populated listbox');

    await s.key('ArrowDown');
    sw = JSON.parse(await optionState());
    console.log(`ArrowDown from search: ${JSON.stringify(sw)}`);
    if (sw.index !== 0) fail(`ArrowDown from the search field did not reach the first option (index=${sw.index})`);

    await s.key('ArrowDown');
    sw = JSON.parse(await optionState());
    console.log(`ArrowDown again: ${JSON.stringify(sw)}`);
    if (sw.index !== 1) fail(`ArrowDown did not move to the next option (index=${sw.index})`);

    await s.key('Escape');
    await sleep(600);
    const restored = JSON.parse(await s.evaluate(`(() => {
      const el = document.activeElement;
      return JSON.stringify({
        name: (el && el.getAttribute ? el.getAttribute('aria-label') : '') || '',
        tag: el ? el.tagName.toLowerCase() : 'none',
      });
    })()`));
    console.log(`Escape from switcher: ${JSON.stringify(restored)}`);
    if (!restored.name.startsWith('Switch board')) fail(`Escape did not return focus to the trigger (${restored.name})`);
    await s.shot('29-keyboard-switcher');
  }

  await s.goto(`/boards/${BOARD_ID}`, 2500);
  await s.shot('30-board-after-keyboard');
}

async function runListMenu(s) {
  await s.setSession();
  await s.goto(`/boards/${BOARD_ID}`, 3500);

  const menu = await s.evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      (b.getAttribute('aria-label') || '').startsWith('Actions for')
    );
    if (!btn) return 'no-menu-button';
    btn.click();
    return 'opened';
  })()`);
  console.log('list menu:', menu);
  await sleep(900);
  await s.shot('13-list-menu-open');

  console.log('rename item:', await s.clickText('button', 'Rename'));
  await sleep(900);
  await s.shot('14-list-rename-inline');
  await s.escape();
  await sleep(600);

  const menu2 = await s.evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      (b.getAttribute('aria-label') || '').startsWith('Actions for')
    );
    if (!btn) return 'no-menu-button';
    btn.click();
    return 'opened';
  })()`);
  console.log('reopened menu:', menu2);
  await sleep(700);
  console.log('delete item:', await s.clickText('button', 'Delete list'));
  await sleep(1200);
  await s.shot('15-confirm-dialog');
  await s.escape();
  await sleep(700);
}

async function runMeasure(s) {
  await s.setSession();
  await s.goto('/boards', 3000);
  const info = await s.evaluate(`(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const scroller = document.querySelector('.thin-scrollbar');
    const hero = scroller && scroller.firstElementChild;
    const grid = document.querySelector('[class*="-mt-12"]');
    return JSON.stringify({
      inner: [window.innerWidth, window.innerHeight],
      docClient: [document.documentElement.clientWidth, document.documentElement.clientHeight],
      bodyScrollWidth: document.body.scrollWidth,
      scroller: rect(scroller),
      hero: rect(hero),
      heroOverflow: hero ? getComputedStyle(hero).overflow : null,
      heroBgImage: hero ? getComputedStyle(hero).backgroundImage.slice(0, 90) : null,
      grid: rect(grid),
    }, null, 2);
  })()`);
  console.log(info);
}

async function runRealtime(s) {
  await s.setSession();
  // setSession navigates to /login to obtain the cookie; navigating again
  // immediately can race that load and abort the CDP command in flight
  // ("Inspected target navigated or closed"). Let it settle first.
  await sleep(400);
  await s.goto(`/boards/${BOARD_ID}`, 3500);

  const countCards = () =>
    s.evaluate(`document.querySelectorAll('[data-rfd-draggable-id]').length`) ||
    s.evaluate(`document.querySelectorAll('[data-rfd-draggable-context-id]').length`);

  const probe = await s.evaluate(`(() => {
    const el = [...document.querySelectorAll('div')].find((d) =>
      d.className && String(d.className).includes('shadow-card')
    );
    if (!el) return 'no-card-el';
    return JSON.stringify({
      attrs: [...el.attributes].map((a) => a.name).filter((n) => n.startsWith('data-')),
      firstLine: (el.innerText || '').split('\\n')[0],
    });
  })()`);
  console.log('card probe:', probe);
  const before = await countCards();
  const detail = await (
    await fetch(`http://localhost:8080/api/boards/${BOARD_ID}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
  ).json();
  const list = detail.lists[0];

  const res = await fetch(
    `http://localhost:8080/api/boards/${BOARD_ID}/lists/${list.id}/cards`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Realtime check (pushed via REST)',
        priority: 'HIGH',
        description: 'Created outside the browser to verify the WebSocket fan-out.',
      }),
    }
  );
  console.log(`push into "${list.name}": HTTP ${res.status}`);

  await sleep(3500);
  const after = await countCards();
  console.log(`cards before=${before} after=${after} -> realtime ${after > before ? 'OK' : 'FAILED'}`);
  console.log(
    'feed shows event:',
    await s.evaluate(`document.body.innerText.includes('Realtime check')`)
  );
  const times = await s.evaluate(`JSON.stringify(
    [...document.querySelectorAll('time')].slice(0, 3).map((t) => ({
      dateTime: t.getAttribute('datetime'),
      text: t.textContent,
      title: t.getAttribute('title'),
    })), null, 2)`);
  console.log('feed <time> elements:', times);
  console.log('--- raw ACTIVITY frames ---');
  s.wsFrames.forEach((f) => console.log(f));
  await s.shot('16-realtime-pushed-card');
}

const LAYOUT_PROBE = `(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const columns = [...document.querySelectorAll('[data-rfd-droppable-id]')]
    .filter((d) => d.getAttribute('data-rfd-droppable-id') !== 'board')
    .map((drop) => {
      const col = drop.closest('.flex.max-h-full') || drop.parentElement;
      return {
        dropId: drop.getAttribute('data-rfd-droppable-id'),
        column: r(col),
        columnOverflow: getComputedStyle(col).overflow,
        columnBackdrop: getComputedStyle(col).backdropFilter,
        columnMaxHeight: getComputedStyle(col).maxHeight,
        innerClientH: drop.clientHeight,
        innerScrollH: drop.scrollHeight,
        innerScrollsInternally: drop.scrollHeight > drop.clientHeight + 1,
        cards: [...drop.querySelectorAll('[data-rfd-draggable-id]')].map((c) => c.innerText.split('\\n')[0].slice(0, 24)),
      };
    });
  const boardScroller = document.querySelector('.thin-scrollbar-light.flex.flex-1');
  return JSON.stringify({
    viewport: [window.innerWidth, window.innerHeight],
    columns,
    boardScroller: boardScroller ? { ...r(boardScroller), scrollH: boardScroller.scrollHeight, clientH: boardScroller.clientHeight, scrollsVertically: boardScroller.scrollHeight > boardScroller.clientHeight + 1 } : null,
  }, null, 1);
})()`;

const DRAG_PROBE = `(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const dragging = [...document.querySelectorAll('[data-rfd-draggable-context-id]')]
    .find((el) => getComputedStyle(el).position === 'fixed') || null;
  if (!dragging) return JSON.stringify({ dragging: null });
  const s = getComputedStyle(dragging);
  const blockers = []; const clippers = [];
  for (let el = dragging.parentElement; el; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (cs.transform !== 'none' || cs.backdropFilter !== 'none' || cs.filter !== 'none' ||
        cs.perspective !== 'none' || cs.willChange !== 'auto' || cs.contain !== 'none') {
      blockers.push({ cls: String(el.className).slice(0, 55), transform: cs.transform !== 'none', backdrop: cs.backdropFilter, contain: cs.contain });
    }
    if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      clippers.push({ cls: String(el.className).slice(0, 55), overflow: cs.overflow, rect: r(el) });
    }
  }
  return JSON.stringify({ rect: r(dragging), position: s.position, zIndex: s.zIndex, blockers, clippers }, null, 1);
})()`;

async function runDnd(s) {
  await s.setSession();
  await s.goto(`/boards/${BOARD_ID}`, 3500);

  console.log('--- board layout (before drag) ---');
  console.log(await s.evaluate(LAYOUT_PROBE));

  const targets = await s.evaluate(`(() => {
    const card = document.querySelector('[data-rfd-droppable-id]:not([data-rfd-droppable-id="board"]) [data-rfd-draggable-id]');
    const drops = [...document.querySelectorAll('[data-rfd-droppable-id]')]
      .filter((d) => d.getAttribute('data-rfd-droppable-id') !== 'board');
    if (!card || drops.length < 2) return JSON.stringify({ error: 'not enough cards/lists' });
    const cb = card.getBoundingClientRect();
    const db = drops[1].getBoundingClientRect();
    return JSON.stringify({
      cardText: card.innerText.split('\\n')[0].slice(0, 40),
      from: { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 },
      to: { x: db.x + db.width / 2, y: db.y + 90 },
    });
  })()`);
  console.log('targets:', targets);
  const t = JSON.parse(targets);
  if (t.error) { console.log('skipping drag:', t.error); return; }

  console.log('--- dragging (mid-flight probe) ---');
  await s.mouse('mousePressed', t.from.x, t.from.y);
  await sleep(150);
  for (let i = 1; i <= 16; i++) {
    const p = i / 16;
    await s.mouse('mouseMoved', t.from.x + (t.to.x - t.from.x) * p, t.from.y + (t.to.y - t.from.y) * p);
    await sleep(25);
  }
  console.log('pointer is at', JSON.stringify({ x: Math.round(t.to.x), y: Math.round(t.to.y) }));
  console.log(await s.evaluate(DRAG_PROBE));
  await s.shot('17-drag-in-flight');
  await s.mouse('mouseReleased', t.to.x, t.to.y);
  await sleep(2200);

  console.log('--- after drop ---');
  console.log('card details modal opened by the drag?',
    await s.evaluate(`Boolean(document.querySelector('[role="dialog"]'))`));
  console.log(await s.evaluate(LAYOUT_PROBE));
  await s.shot('18-after-card-drag');

  const server = await (
    await fetch(`http://localhost:8080/api/boards/${BOARD_ID}`, { headers: { Authorization: `Bearer ${TOKEN}` } })
  ).json();
  console.log('server order:', JSON.stringify(
    server.lists.map((l) => ({ list: l.name, cards: l.cards.map((c) => c.title.slice(0, 20) + '@' + c.position) })), null, 1));

  // ---- column (list) drag ----
  const colDrag = await s.evaluate(`(() => {
    const listDraggable = document.querySelector('[data-rfd-droppable-id="board"] [data-rfd-draggable-id]');
    if (!listDraggable) return null;
    const handle = listDraggable.querySelector('[data-rfd-drag-handle-draggable-id]');
    if (!handle) return null;
    const hb = handle.getBoundingClientRect();
    const boardDrop = document.querySelector('[data-rfd-droppable-id="board"]');
    const bb = boardDrop.getBoundingClientRect();
    return JSON.stringify({
      from: { x: hb.x + 40, y: hb.y + hb.height / 2 },
      to: { x: Math.min(bb.x + bb.width - 80, window.innerWidth - 40), y: hb.y + hb.height / 2 },
    });
  })()`);
  if (!colDrag) { console.log('no list drag handle found'); return; }
  const c = JSON.parse(colDrag);
  console.log('--- column drag ---', JSON.stringify(c));
  await s.mouse('mousePressed', c.from.x, c.from.y);
  await sleep(150);
  for (let i = 1; i <= 16; i++) {
    const p = i / 16;
    await s.mouse('mouseMoved', c.from.x + (c.to.x - c.from.x) * p, c.from.y + (c.to.y - c.from.y) * p);
    await sleep(25);
  }
  console.log('pointer at', JSON.stringify(c.to));
  console.log(await s.evaluate(DRAG_PROBE));
  await s.shot('19-column-drag-in-flight');
  await s.mouse('mouseReleased', c.to.x, c.to.y);
  await sleep(2200);
  console.log('list order after column drag:', await s.evaluate(`JSON.stringify(
    [...document.querySelectorAll('[data-rfd-droppable-id="board"] [data-rfd-draggable-id] > div')].map((d) => d.innerText.split('\\n')[0].slice(0, 14))`));
  await s.shot('20-after-column-drag');
}

async function runDndProbe(s) {
  await s.setSession();
  await s.goto(`/boards/${BOARD_ID}`, 3500);
  console.log('dnd attributes:', await s.evaluate(`JSON.stringify([
    ...new Set([...document.querySelectorAll('*')].flatMap((e) =>
      [...e.attributes].map((a) => a.name).filter((n) => n.includes('rfd') || n.includes('dnd') || n.includes('drag'))
    ))
  ])`));
  // Full ancestor chain of a card droppable with every scroll/filter property.
  console.log(await s.evaluate(`(() => {
    const drop = [...document.querySelectorAll('[data-rfd-droppable-id]')]
      .find((d) => d.getAttribute('data-rfd-droppable-id') !== 'board');
    const chain = [];
    for (let el = drop; el && el !== document.body; el = el.parentElement) {
      const cs = getComputedStyle(el);
      chain.push({
        el: el.tagName + '.' + String(el.className).split(' ').slice(0, 3).join('.'),
        overflow: cs.overflow, overflowX: cs.overflowX, overflowY: cs.overflowY,
        backdropFilter: cs.backdropFilter,
        transform: cs.transform === 'none' ? 'none' : 'set',
        isScrollContainer: cs.overflowX !== 'visible' || cs.overflowY !== 'visible',
      });
    }
    return JSON.stringify(chain, null, 1);
  })()`));
}

async function runDndFix(s) {
  await s.setSession();
  await s.goto(`/boards/${BOARD_ID}`, 3500);

  const OFFSET_PROBE = `(() => {
    const dragging = [...document.querySelectorAll('[data-rfd-draggable-context-id]')]
      .find((el) => getComputedStyle(el).position === 'fixed');
    if (!dragging) return JSON.stringify({ dragging: null });
    const b = dragging.getBoundingClientRect();
    const col = dragging.closest('.flex.max-h-full');
    const cb = col ? col.getBoundingClientRect() : null;
    return JSON.stringify({
      draggedTop: Math.round(b.y), draggedLeft: Math.round(b.x),
      draggedCenterY: Math.round(b.y + b.height / 2),
      columnTop: cb ? Math.round(cb.y) : null,
      columnLeft: cb ? Math.round(cb.x) : null,
      offsetFromColumnTop: cb ? Math.round(b.y - cb.y) : null,
    });
  })()`;

  const grab = await s.evaluate(`(() => {
    const card = document.querySelector('[data-rfd-droppable-id]:not([data-rfd-droppable-id="board"]) [data-rfd-draggable-id]');
    const drops = [...document.querySelectorAll('[data-rfd-droppable-id]')].filter((d) => d.getAttribute('data-rfd-droppable-id') !== 'board');
    const cb = card.getBoundingClientRect(); const db = drops[1].getBoundingClientRect();
    return JSON.stringify({ from: { x: cb.x + cb.width/2, y: cb.y + cb.height/2 }, to: { x: db.x + db.width/2, y: db.y + 90 } });
  })()`);
  const t = JSON.parse(grab);

  async function measure(label) {
    await s.mouse('mousePressed', t.from.x, t.from.y);
    await sleep(140);
    for (let i = 1; i <= 14; i++) {
      const p = i / 14;
      await s.mouse('mouseMoved', t.from.x + (t.to.x - t.from.x) * p, t.from.y + (t.to.y - t.from.y) * p);
      await sleep(25);
    }
    await sleep(120);
    const probe = JSON.parse(await s.evaluate(OFFSET_PROBE));
    console.log(`\n[${label}] pointerY=${Math.round(t.to.y)}  ${JSON.stringify(probe)}`);
    if (probe.draggedCenterY != null) {
      console.log(`   -> cursor/card vertical gap: ${Math.round(t.to.y - probe.draggedCenterY)}px`);
    }
    await s.mouse('mouseReleased', t.to.x, t.to.y);
    await sleep(1500);
    return probe;
  }

  console.log('=== BASELINE (as shipped: backdrop-blur-md on every column) ===');
  await measure('baseline');
  await s.goto(`/boards/${BOARD_ID}`, 3000);

  console.log('\n=== EXPERIMENT: disable backdrop-filter + column overflow clipping ===');
  await s.evaluate(`(() => {
    const st = document.createElement('style');
    st.id = 'dnd-fix';
    st.textContent = '.max-h-full { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; overflow: visible !important; }';
    document.head.appendChild(st);
    return 'injected';
  })()`);
  await sleep(400);
  const fixed = await measure('no-backdrop-filter');
  await s.shot('21-dnd-fix-experiment');
  await s.evaluate(`document.getElementById('dnd-fix')?.remove(); 'removed'`);
}

async function runColDrag(s) {
  await s.setSession();
  await s.goto(`/boards/${BOARD_ID}`, 3500);

  // Map the header's interactive vs non-interactive zones.
  console.log('header zones:', await s.evaluate(`(() => {
    const h = document.querySelector('[data-rfd-droppable-id="board"] [data-rfd-drag-handle-draggable-id]');
    if (!h) return 'no handle';
    const r = (e) => { const b = e.getBoundingClientRect(); return { tag: e.tagName, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), cx: Math.round(b.x + b.width/2), cy: Math.round(b.y + b.height/2) }; };
    return JSON.stringify({ header: r(h), children: [...h.children].map(r) }, null, 1);
  })()`));

  // Regression guard for the original bug: the drag handle must NOT contain
  // interactive children, because the library refuses to start a drag when the
  // press lands on a <button>/<input> etc.
  console.log('handle contains interactive elements:',
    await s.evaluate(`(() => {
      const h = document.querySelector('[data-rfd-droppable-id="board"] [data-rfd-drag-handle-draggable-id]');
      if (!h) return 'no handle';
      const bad = [...h.querySelectorAll('input,button,textarea,select,option,optgroup,video,audio')];
      return JSON.stringify(bad.map((e) => e.tagName + (e.getAttribute('aria-label') || e.textContent.trim().slice(0, 12))));
    })()`));
  console.log('header has a visible reorder grip:',
    await s.evaluate(`Boolean(document.querySelector('[data-rfd-droppable-id="board"] [aria-label^="Reorder"]'))`));

  const ATTEMPTS = [
    { label: 'grab the reorder GRIP (the intended affordance)', sel: '[data-rfd-droppable-id="board"] [aria-label^="Reorder"]' },
  ];

  for (const a of ATTEMPTS) {
    const pt = await s.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(a.sel)});
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return JSON.stringify({ x: b.x + b.width/2, y: b.y + b.height/2 });
    })()`);
    if (!pt) { console.log(`\n[${a.label}] -> element not found`); continue; }
    const p = JSON.parse(pt);
    const dest = await s.evaluate(`(() => {
      const d = document.querySelector('[data-rfd-droppable-id="board"]');
      const b = d.getBoundingClientRect();
      return JSON.stringify({ x: Math.min(b.x + b.width - 30, window.innerWidth - 30), y: b.y + 24 });
    })()`);
    const d2 = JSON.parse(dest);
    await s.mouse('mousePressed', p.x, p.y);
    await sleep(140);
    for (let i = 1; i <= 14; i++) {
      const q = i / 14;
      await s.mouse('mouseMoved', p.x + (d2.x - p.x) * q, p.y + (d2.y - p.y) * q);
      await sleep(25);
    }
    const lifted = await s.evaluate(`Boolean([...document.querySelectorAll('[data-rfd-draggable-context-id]')]
      .find((el) => getComputedStyle(el).position === 'fixed'))`);
    console.log(`\n[${a.label}] at (${Math.round(p.x)},${Math.round(p.y)}) -> drag lifted: ${lifted}`);
    await s.shot(`22-coldrag-${lifted ? 'lifted' : 'not-lifted'}`);
    await s.mouse('mouseReleased', d2.x, d2.y);
    await sleep(1500);
    await s.escape();
    await sleep(400);
  }
}

async function runCreateBoard(s) {
  await s.setSession();
  await s.goto('/boards', 3000);
  const before = await s.evaluate(`document.querySelectorAll('article').length`);
  await s.clickText('button', 'New board');
  await sleep(900);
  const name = `QA created board ${Date.now()}`;
  await s.fill('input[placeholder="e.g. Sprint 42"]', name);
  await s.evaluate(`document.querySelector('form').requestSubmit(); 'submitted'`);
  await sleep(2500);
  const after = await s.evaluate(`document.querySelectorAll('article').length`);
  const hasNew = await s.evaluate(`document.body.innerText.includes(${JSON.stringify(name)})`);
  console.log(`boards before=${before} after=${after}  new board visible on dashboard: ${hasNew}`);
  await s.shot('23-after-create-board');
  // Reload to prove the board did get persisted server-side.
  await s.goto('/boards', 3000);
  const afterReload = await s.evaluate(`document.body.innerText.includes(${JSON.stringify(name)})`);
  console.log(`after reload, new board visible: ${afterReload}`);
}

/**
 * Card virtualisation: how many cards does the DOM actually hold, and is the
 * rest of the list still reachable?
 *
 * The claim being checked is not "the list scrolls" - it always did. It is that
 * a long list does not render every card, and that scrolling still reaches the
 * end. `rendered` is counted from the DOM, not from React state, so it measures
 * what the browser is actually paying for.
 *
 * Env: QA_SCALE_BOARD_ID (a board with a long column), QA_SCALE_EXPECTED.
 */
async function runScale(s) {
  await s.setSession();
  const boardId = process.env.QA_SCALE_BOARD_ID ?? BOARD_ID;
  const expected = Number(process.env.QA_SCALE_EXPECTED ?? 0);
  await s.goto(`/boards/${boardId}`, 3500);

  // Find the *longest* column, not just the first droppable: the board
  // droppable is also a [data-rfd-droppable-id] and is never the one that
  // virtualises.
  const before = await s.evaluate(`(() => {
    const all = [...document.querySelectorAll('[data-rfd-droppable-id]')];
    const longest = all.reduce((a, b) => (b.scrollHeight > a.scrollHeight ? b : a), all[0]);
    return JSON.stringify({
      totalCards: document.querySelectorAll('[data-rfd-draggable-id]').length,
      listCards: longest ? longest.querySelectorAll('[data-rfd-draggable-id]').length : 0,
      scrollHeight: longest?.scrollHeight ?? 0,
      clientHeight: longest?.clientHeight ?? 0,
    });
  })()`);
  const b = JSON.parse(before);
  console.log(
    `rendered cards: ${b.totalCards} total, ${b.listCards} in the longest column ` +
      `(scrollHeight=${b.scrollHeight} clientHeight=${b.clientHeight})`
  );

  // Scroll to the very end and confirm the last card is reachable.
  const end = await s.evaluate(`(() => {
    const d = document.querySelector('[data-rfd-droppable-id]');
    d.scrollTop = d.scrollHeight;
    return new Promise((r) => setTimeout(() => {
      const cards = d.querySelectorAll('[data-rfd-draggable-id]');
      r(JSON.stringify({
        atEnd: d.scrollTop + d.clientHeight >= d.scrollHeight - 2,
        rendered: cards.length,
        lastText: cards.length ? cards[cards.length - 1].innerText.split('\\n')[0] : null,
      }));
    }, 500));
  })()`);
  const e = JSON.parse(end);
  console.log(
    `after scrolling to the end: atEnd=${e.atEnd} rendered=${e.rendered} last="${e.lastText}"`
  );
  await s.shot('24-virtualised-end-of-list');

  if (expected > 0) {
    if (b.listCards >= expected) {
      session.problems.push(
        `scale: ${b.listCards} cards in the DOM, expected fewer than ${expected} - no virtualisation?`
      );
    } else {
      console.log(
        `virtualisation: ${b.listCards} of ${expected} cards in the DOM ` +
          `(${Math.round((b.listCards / expected) * 100)}%)`
      );
    }
  }
  if (!e.atEnd) session.problems.push('scale: could not scroll to the end of the list');
  if (e.rendered === 0) session.problems.push('scale: nothing rendered after scrolling to the end');

  // Drag inside the virtualised column. The drop-accuracy check runs on a short
  // list that never virtualises, so on its own it would not exercise the window
  // at all - this is the case that could actually be broken, where the indices
  // the library reports have to account for the cards scrolled out above.
  await s.goto(`/boards/${boardId}`, 3000);
  const g = await s.evaluate(`(() => {
    // Pick the *card* columns, not the board droppable. The board droppable is
    // also a [data-rfd-droppable-id] and its draggables are the columns, so
    // matching on it would drag a list rather than a card.
    const lists = [...document.querySelectorAll('[data-rfd-droppable-id]')]
      .filter((d) => {
        const cs = getComputedStyle(d);
        return cs.overflowY === 'auto' && d.querySelectorAll('[data-rfd-draggable-id]').length > 3;
      });
    if (!lists.length) return JSON.stringify({ error: 'no populated card list' });
    const source = lists[0];
    const target = lists[1] || source;
    const card = source.querySelector('[data-rfd-draggable-id]');
    if (!card) return JSON.stringify({ error: 'no card' });
    const sb = card.getBoundingClientRect();
    const tb = target.getBoundingClientRect();
    return JSON.stringify({
      from: { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 },
      to: { x: tb.x + tb.width / 2, y: tb.y + 60 },
      title: card.innerText.split('\\n')[0].slice(0, 30),
    });
  })()`);
  const geom = JSON.parse(g);
  if (geom.error) {
    session.problems.push(`scale drag: ${geom.error}`);
    return;
  }
  await s.dragTo(geom.from, geom.to, 20);
  await sleep(2500);
  console.log(`virtualised drag: moved "${geom.title}" - problems so far ${session.problems.length}`);
  await s.shot('25-virtualised-drag');
}

/**
 * Drop-accuracy check: drag a card to a precise slot and compare where it
 * actually landed (server order) with where it was dropped.
 *
 * The library warns about nested scroll containers, which is why this check
 * exists: the warning is cosmetic in our layout. Measured with
 * tools/dropcurve.mjs, the drop-index response is monotonic both for a short
 * column and for a 40-card column that genuinely scrolls, and the end-of-list
 * index is reachable. So a mismatch here means a real regression, not a
 * library limitation.
 */
async function runDropAccuracy(s) {
  await s.setSession();
  await s.goto(`/boards/${BOARD_ID}`, 3500);

  const serverOrder = async () => {
    const detail = await (await fetch(`http://localhost:8080/api/boards/${BOARD_ID}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })).json();
    return detail.lists.map((l) => ({ id: l.id, name: l.name, titles: l.cards.map((c) => c.title) }));
  };

  const before = await serverOrder();
  // Pick any populated source and any other list as the target; top up an
  // empty target with a couple of cards so there is a real slot to aim at.
  const source = before.find((l) => l.titles.length > 0);
  let target = before.find((l) => l.id !== source?.id);
  if (!source || !target) { console.log('need at least two lists'); return; }
  if (target.titles.length < 2) {
    for (const name of ['droptest-a', 'droptest-b']) {
      await fetch(`http://localhost:8080/api/boards/${BOARD_ID}/lists/${target.id}/cards`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name }),
      });
    }
    await s.goto(`/boards/${BOARD_ID}`, 2500);
    const refreshed = await serverOrder();
    target = refreshed.find((l) => l.id === target.id);
  }

  // The target list grows as earlier cases drop cards into it, so the expected
  // slot has to be computed against the live state, not a startup snapshot.
  const SLOTS = [
    { label: 'top of target', pick: (n) => 0 },
    { label: 'middle of target', pick: (n) => Math.floor(n / 2) },
    { label: 'bottom of target', pick: (n) => n },
  ];

  let pass = 0;
  for (const c of SLOTS) {
    const live = (await serverOrder()).find((l) => l.id === target.id);
    const slot = c.pick(live.titles.length);
    const geometry = await s.evaluate(`(() => {
      const drops = [...document.querySelectorAll('[data-rfd-droppable-id]')]
        .filter((d) => d.getAttribute('data-rfd-droppable-id') !== 'board');
      const targetDrop = drops.find((d) => d.getAttribute('data-rfd-droppable-id') === ${JSON.stringify(target.id)});
      if (!targetDrop) return JSON.stringify({ error: 'target droppable missing' });
      let cards = [...targetDrop.querySelectorAll('[data-rfd-draggable-id]')];
      // A user scrolls the destination into view before dropping; aiming at a
      // card that is clipped outside the scroll viewport is not a real gesture.
      if (cards.length) {
        const probe = cards[Math.min(${slot}, cards.length - 1)];
        probe.scrollIntoView({ block: 'nearest' });
        cards = [...targetDrop.querySelectorAll('[data-rfd-draggable-id]')];
      }
      const tb = targetDrop.getBoundingClientRect();
      let y;
      if (cards.length === 0) {
        y = tb.y + 20;
      } else if (${slot} >= cards.length) {
        // Aim a short, fixed distance up from the droppable's bottom edge
        // rather than a fraction of the last card's height.
        //
        // Dropping INSIDE a card means "insert above that card", so aiming at
        // 75% of the last card correctly resolves to n-1. Measured offset
        // sweeps (tools/dropoffset.mjs) show a fixed pixel offset from the
        // LAST CARD drifts as the list grows: the card's height changes
        // between runs, so the same +8px lands differently. Measuring from the
        // droppable's bottom edge is stable and hits the end every time.
        y = tb.bottom - 10;
      } else {
        const r = cards[${slot}].getBoundingClientRect();
        y = r.y + r.height / 2;
      }
      // Always drag the first card of the first list that still has one.
      const sourceDrop = drops.find((d) => {
        const c = d.querySelector('[data-rfd-draggable-id]');
        return c && d.getAttribute('data-rfd-droppable-id') !== ${JSON.stringify(target.id)};
      });
      if (!sourceDrop) return JSON.stringify({ error: 'no source card' });
      const sc = sourceDrop.querySelector('[data-rfd-draggable-id]');
      sc.scrollIntoView({ block: 'nearest' });
      const sb = sc.getBoundingClientRect();
      return JSON.stringify({
        card: sc.innerText.split('\\n')[0].slice(0, 40),
        visible: y >= tb.top - 2 && y <= tb.bottom + 2,
        from: { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 },
        to: { x: tb.x + tb.width / 2, y },
      });
    })()`);
    const g = JSON.parse(geometry);
    if (g.error) { console.log(`[${c.label}] ${g.error}`); continue; }

    await s.dragTo(g.from, g.to, 20);
    await sleep(2000);

    const after = await serverOrder();
    const landed = after.find((l) => l.id === target.id);
    const idx = landed ? landed.titles.indexOf(g.card) : -1;
    const ok = idx === slot;
    if (ok) pass++;
    console.log(`[${c.label}] "${g.card}" -> index ${idx} (expected ${slot}) targetPixelVisible=${g.visible} ${ok ? 'OK' : 'MISMATCH'}`);
  }
  console.log(`\ndrop accuracy: ${pass}/${SLOTS.length}`);
  await s.shot('24-drop-accuracy');
}

const scenario = process.argv[2] ?? 'login';
const session = await connect();

if (scenario === 'login') await runLogin(session);
else if (scenario === 'register') await runRegister(session);
else if (scenario === 'dashboard') await runDashboard(session);
else if (scenario === 'scale') await runScale(session);
else if (scenario === 'board') await runBoard(session);
else if (scenario === 'keyboard') await runKeyboard(session);
else if (scenario === 'listmenu') await runListMenu(session);
else if (scenario === 'measure') await runMeasure(session);
else if (scenario === 'realtime') await runRealtime(session);
else if (scenario === 'dnd') await runDnd(session);
else if (scenario === 'dndprobe') await runDndProbe(session);
else if (scenario === 'dndfix') await runDndFix(session);
else if (scenario === 'coldrag') await runColDrag(session);
else if (scenario === 'droptest') await runDropAccuracy(session);
else if (scenario === 'createboard') await runCreateBoard(session);
else console.log(`unknown scenario: ${scenario}`);

session.report();
session.ws.close();
process.exit(0);

