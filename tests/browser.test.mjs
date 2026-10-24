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
  // wait past the 0.45s theme transition so captures show the settled state
  await new Promise((resolve) => setTimeout(resolve, 1100));
  return sessionId;
}

async function evaluate(sessionId, expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (exceptionDetails) throw new Error(`page evaluation failed: ${JSON.stringify(exceptionDetails.exception)}`);
  return result.value;
}

const contrastFn = `(() => {
  const lum = (rgb) => {
    const c = rgb.match(/\\d+(\\.\\d+)?/g).map(Number).slice(0, 3).map((v) => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const bg = getComputedStyle(document.body).backgroundColor;
  const text = getComputedStyle(document.querySelector('.hero p, main p')).color;
  const a = lum(bg); const b = lum(text);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
})()`;

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

// Browser checks must really run in CI; locally they skip with a reason when
// no Chrome/Chromium binary is installed.
const chromeMissing = (name) => test(name, () => {
  assert.fail('Chrome/Chromium is required for the browser checks but no binary was found');
});
const withChrome = chromeBin ? test : (process.env.CI ? chromeMissing : test.skip);

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
    const headlineContrast = await evaluate(s, `(() => {
      const lum = (rgb) => { const c = rgb.match(/\\d+(\\.\\d+)?/g).map(Number).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
      const bg = lum(getComputedStyle(document.body).backgroundColor);
      const fg = lum(getComputedStyle(document.querySelector('.hero h1')).color);
      return (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
    })()`);
    assert.ok(headlineContrast >= 4.5, `light theme headline contrast ${headlineContrast.toFixed(2)}:1 meets 4.5:1`);
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
    const contrast = await evaluate(s, contrastFn);
    assert.ok(contrast >= 4.5, `dark theme body text contrast ${contrast.toFixed(2)}:1 meets 4.5:1`);
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
    // settle past the 0.45s transition, then verify the rendered colours, not just attributes
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const rendered = await evaluate(s, `({
      bg: getComputedStyle(document.body).backgroundColor,
      contrast: ${contrastFn},
    })`);
    assert.equal(rendered.bg, 'rgb(24, 33, 29)', 'dark background is actually painted');
    assert.ok(rendered.contrast >= 4.5, `dark body text contrast ${rendered.contrast.toFixed(2)}:1 meets 4.5:1`);
    await shot(s, 'browser-desktop-dark-toggled');
    await send('Page.navigate', { url: `${origin}/` }, s);
    await new Promise((resolve) => setTimeout(resolve, 1100));
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

// KNOWN EXISTING DEFECT on main: at 320px the hero headline and portrait overlap.
// This check measures the real rendered geometry and PASSES while the defect is
// present. When the overlap is fixed it FAILS on purpose - flip the assertion
// to assert.equal(overlap, false) as part of the fix.
withChrome('KNOWN DEFECT: 320px hero headline overlaps the portrait (flip when fixed)', async () => {
  const s = await openPage({ width: 320, height: 700 });
  try {
    // the headline's painted text overflows its grid box, so measure the text
    // geometry (Range), not the element's bounding box
    const { overlap, detail } = await evaluate(s, `(() => {
      const hero = document.querySelector('.mobile-hero');
      const h1 = hero.querySelector('h1');
      const range = document.createRange();
      range.selectNodeContents(h1);
      const text = range.getBoundingClientRect();
      const img = hero.querySelector('img.portrait').getBoundingClientRect();
      const overlap = !(text.right <= img.left || img.right <= text.left || text.bottom <= img.top || img.bottom <= text.top);
      return { overlap, detail: { text: [Math.round(text.left), Math.round(text.right)], img: [Math.round(img.left), Math.round(img.right)] } };
    })()`);
    await shot(s, 'browser-320-known-defect');
    assert.equal(overlap, true, `320px overlap defect no longer reproduces (${JSON.stringify(detail)}) - flip this check to require no overlap`);
  } finally { await closePage(s); }
});

// KNOWN EXISTING DEFECT on main: the muted body text (--muted) on the light
// theme measures about 3.9:1, below WCAG AA 4.5:1 for normal text. This check
// PASSES while the defect is present; when the contrast is fixed it FAILS on
// purpose - flip the assertion to >= 4.5 as part of the fix.
withChrome('KNOWN DEFECT: light-theme muted body text below 4.5:1 contrast (flip when fixed)', async () => {
  const s = await openPage({ width: 1440, height: 900 });
  try {
    const contrast = await evaluate(s, contrastFn);
    assert.ok(contrast < 4.5, `muted text contrast now ${contrast.toFixed(2)}:1 - defect appears fixed, flip this check to require >= 4.5:1`);
  } finally { await closePage(s); }
});

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
