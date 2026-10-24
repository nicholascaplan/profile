// Browser checks for index.html in headless Chrome - no npm dependencies.
// Drives Chrome over the DevTools protocol using only Node's standard library.
// Skips with a clear reason when no Chrome/Chromium binary is available.
// Usage: node --test

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = process.env.SHOTS_DIR || '/tmp/coverage-shots';
const chromeBin = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  .find((bin) => existsSync(`/usr/bin/${bin}`));

// --- static file server ---------------------------------------------------
const types = { '.html': 'text/html', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer((req, res) => {
  const path = join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!path.startsWith(root) || !existsSync(path)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.slice(path.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// --- Chrome over CDP --------------------------------------------------------
let chrome;
let ws;
let msgId = 0;
const pending = new Map();

async function connect() {
  const profile = join('/tmp', `chrome-coverage-${process.pid}`);
  chrome = spawn(chromeBin, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    chrome.stderr.on('data', (chunk) => {
      buf += chunk;
      const match = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    chrome.on('exit', () => reject(new Error('chrome exited before DevTools was ready')));
    setTimeout(() => reject(new Error('timed out waiting for DevTools')), 15000);
  });
  ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('websocket failed'));
  });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };
}

function send(method, params = {}, sessionId) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`${method} timed out`)); } }, 20000);
  });
}

// Opens an isolated page at a chosen viewport and colour scheme.
async function openPage({ width, height, dark = false }) {
  // fresh browser context per page so localStorage never leaks between checks
  const { browserContextId } = await send('Target.createBrowserContext');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Target.activateTarget', { targetId });
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] }, sessionId);
  await send('Page.navigate', { url: `${origin}/` }, sessionId);
  await new Promise((resolve) => setTimeout(resolve, 700));
  return sessionId;
}

async function evaluate(sessionId, expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (exceptionDetails) throw new Error(`page evaluation failed: ${JSON.stringify(exceptionDetails.exception)}`);
  return result.value;
}

async function shot(sessionId, name) {
  mkdirSync(shotsDir, { recursive: true });
  const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(join(shotsDir, `${name}.png`), Buffer.from(data, 'base64'));
}

async function closePage(sessionId) {
  const info = await send('Target.getTargetInfo', {}, sessionId).catch(() => null);
  if (info && info.targetInfo) {
    await send('Target.closeTarget', { targetId: info.targetInfo.targetId });
    if (info.targetInfo.browserContextId) await send('Target.disposeBrowserContext', { browserContextId: info.targetInfo.browserContextId }).catch(() => {});
  }
}

before(async () => { if (chromeBin) await connect(); });
after(async () => {
  try { if (ws) ws.close(); } catch {}
  try { if (chrome) chrome.kill('SIGKILL'); } catch {}
  server.close();
});

const withChrome = chromeBin ? test : test.skip;

// --- checks -----------------------------------------------------------------

withChrome('desktop light: one visible h1, toggle defaults to light mode', async () => {
  const s = await openPage({ width: 1440, height: 900 });
  try {
    const state = await evaluate(s, `({
      visibleH1: [...document.querySelectorAll('h1')].filter((h) => h.offsetParent !== null).length,
      theme: document.body.dataset.theme,
      pressed: document.querySelector('.theme-toggle').getAttribute('aria-pressed'),
      label: document.querySelector('.theme-toggle').getAttribute('aria-label'),
      hasMobileToggle: !!document.querySelector('.mobile-toggle'),
    })`);
    assert.equal(state.visibleH1, 1, 'exactly one h1 is rendered');
    assert.equal(state.theme, 'light');
    assert.equal(state.pressed, 'false');
    assert.equal(state.label, 'Switch to dark mode');
    assert.equal(state.hasMobileToggle, true, 'mobile preview toggle present on a local host');
    await shot(s, 'browser-desktop-light');
  } finally { await closePage(s); }
});

withChrome('dark system preference: page opens dark and the toggle shows it', async () => {
  const s = await openPage({ width: 1440, height: 900, dark: true });
  try {
    const state = await evaluate(s, `({
      theme: document.body.dataset.theme,
      pressed: document.querySelector('.theme-toggle').getAttribute('aria-pressed'),
      label: document.querySelector('.theme-toggle .theme-label').textContent,
    })`);
    assert.equal(state.theme, 'dark');
    assert.equal(state.pressed, 'true');
    assert.equal(state.label, 'Light mode');
    await shot(s, 'browser-desktop-dark');
  } finally { await closePage(s); }
});

withChrome('theme toggle: click switches to dark, reload restores it', async () => {
  const s = await openPage({ width: 1440, height: 900 });
  try {
    await evaluate(s, `document.querySelector('.theme-toggle').click()`);
    const after1 = await evaluate(s, `({ theme: document.body.dataset.theme, stored: localStorage.getItem('nick-theme') })`);
    assert.equal(after1.theme, 'dark');
    assert.equal(after1.stored, 'dark');
    await shot(s, 'browser-desktop-dark-toggled');
    await send('Page.navigate', { url: `${origin}/` }, s);
    await new Promise((resolve) => setTimeout(resolve, 700));
    const after2 = await evaluate(s, `document.body.dataset.theme`);
    assert.equal(after2, 'dark', 'stored choice survives a reload');
  } finally { await closePage(s); }
});

withChrome('keyboard: tab reaches the toggles and Enter switches the theme', async () => {
  const s = await openPage({ width: 1440, height: 900 });
  try {
    const focusTag = await evaluate(s, `(async () => {
      for (let i = 0; i < 20; i++) {
        // simulate a Tab press by moving focus through the tab order
        const focusables = [...document.querySelectorAll('a[href], button')].filter((el) => el.offsetParent !== null);
        const index = focusables.indexOf(document.activeElement);
        (focusables[index + 1] || focusables[0]).focus();
        if (document.activeElement === document.querySelector('.theme-toggle')) return 'theme-toggle';
        if (document.activeElement === document.querySelector('.mobile-toggle')) return 'mobile-toggle';
      }
      return document.activeElement ? document.activeElement.className : 'none';
    })()`);
    assert.ok(['theme-toggle', 'mobile-toggle'].includes(focusTag), `toggle reachable by keyboard, reached ${focusTag}`);
    await evaluate(s, `document.querySelector('.theme-toggle').focus()`);
    for (const type of ['keyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' }, s);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    const theme = await evaluate(s, `document.body.dataset.theme`);
    assert.equal(theme, 'dark', 'Enter on the focused toggle switches the theme');
  } finally { await closePage(s); }
});

withChrome('mobile 390px: one visible h1 and no horizontal scrolling', async () => {
  const s = await openPage({ width: 390, height: 844 });
  try {
    const state = await evaluate(s, `({
      visibleH1: [...document.querySelectorAll('h1')].filter((h) => h.offsetParent !== null).length,
      mobileMode: document.body.dataset.mobile,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    })`);
    assert.equal(state.visibleH1, 1, 'exactly one h1 is rendered');
    assert.equal(state.mobileMode, 'true', 'mobile layout active at 390px');
    assert.ok(state.overflow <= 1, `no horizontal scroll (overflow ${state.overflow}px)`);
    await shot(s, 'browser-mobile-390');
  } finally { await closePage(s); }
});

withChrome('200% text at a laptop viewport: no horizontal scrolling', async () => {
  // 200% browser zoom at 1440px leaves a 720px CSS viewport.
  const s = await openPage({ width: 720, height: 450 });
  try {
    const overflow = await evaluate(s, `document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    assert.ok(overflow <= 1, `no horizontal scroll at 720px effective width (overflow ${overflow}px)`);
    await shot(s, 'browser-zoom-720');
  } finally { await closePage(s); }
});

test('320px headline and portrait do not overlap', { todo: 'known existing defect on main - fix not yet decided' }, () => {});

withChrome('contact form: empty form is invalid, completed form is valid', async () => {
  const s = await openPage({ width: 1440, height: 900 });
  try {
    const state = await evaluate(s, `({
      emptyValid: document.querySelector('.contact-form').checkValidity(),
      emailBad: (() => { const e = document.querySelector('#contact-email'); e.value = 'not-an-email'; return e.validity.typeMismatch; })(),
      filledValid: (() => {
        document.querySelector('#contact-name').value = 'Test Person';
        const e = document.querySelector('#contact-email'); e.value = 'test@example.com';
        document.querySelector('#contact-message').value = 'Hello';
        return document.querySelector('.contact-form').checkValidity();
      })(),
      action: document.querySelector('.contact-form').action,
    })`);
    assert.equal(state.emptyValid, false, 'empty form fails native validation');
    assert.equal(state.emailBad, true, 'malformed email is rejected');
    assert.equal(state.filledValid, true, 'completed form passes native validation');
    assert.match(state.action, /^https:\/\//);
  } finally { await closePage(s); }
});

withChrome('navigation: in-page anchors move to their sections', async () => {
  const s = await openPage({ width: 1440, height: 900 });
  try {
    await evaluate(s, `document.querySelector('a[href="#experience"]').click()`);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const state = await evaluate(s, `({ hash: location.hash, scrolled: window.scrollY > 0 })`);
    assert.equal(state.hash, '#experience');
    assert.ok(state.scrolled, 'page scrolled to the section');
  } finally { await closePage(s); }
});
