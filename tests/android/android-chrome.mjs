// Proof-of-concept: load the site in real Chrome for Android on an emulator,
// exercise the screenshot chooser with a real touch tap, and record evidence.
// Runs inside the android-emulator-runner step in .github/workflows/android-chrome.yml.
import { chromium } from '@playwright/test';
import { execFile as execFileCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';

const execFile = promisify(execFileCb);
const SITE_URL = 'http://10.0.2.2:8080/'; // 10.0.2.2 is the host loopback from the emulator
const ARTIFACTS = 'test-results/android';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const adb = (...args) => execFile('adb', args, { maxBuffer: 16 * 1024 * 1024 });
const adbText = async (...args) => (await adb(...args)).stdout.toString();

mkdirSync(ARTIFACTS, { recursive: true });
const info = {};

async function waitForBoot() {
  await adb('wait-for-device');
  for (let i = 0; i < 120; i++) {
    const done = (await adbText('shell', 'getprop', 'sys.boot_completed')).trim();
    if (done === '1') return;
    await sleep(2000);
  }
  throw new Error('Emulator did not finish booting');
}

// Tap the centre of a UI node whose text matches, using a uiautomator dump.
async function tapIfPresent(patterns) {
  let xml;
  try {
    await adb('shell', 'uiautomator', 'dump', '/sdcard/poc-ui.xml');
    xml = await adbText('exec-out', 'cat', '/sdcard/poc-ui.xml');
  } catch { return false; }
  for (const node of xml.match(/<node [^>]*>/g) || []) {
    const text = /text="([^"]*)"/.exec(node)?.[1] || '';
    const bounds = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);
    if (!bounds) continue;
    const plain = text.replace(/&amp;/g, '&');
    if (patterns.some(p => p.test(plain))) {
      const x = (Number(bounds[1]) + Number(bounds[3])) / 2;
      const y = (Number(bounds[2]) + Number(bounds[4])) / 2;
      console.log(`tapping "${plain}" at ${x},${y}`);
      await adb('shell', 'input', 'tap', String(x), String(y));
      return true;
    }
  }
  return false;
}

const DISMISS = [/^accept & continue$/i, /^use without an account$/i, /^no thanks$/i, /^got it$/i, /^skip$/i, /^next$/i, /^turn on sync\?/i];

async function getTargets() {
  try {
    const res = await fetch('http://127.0.0.1:9222/json');
    return await res.json();
  } catch { return []; }
}

async function main() {
  await waitForBoot();
  info.model = (await adbText('shell', 'getprop', 'ro.product.model')).trim();
  info.android = (await adbText('shell', 'getprop', 'ro.build.version.release')).trim();
  console.log(`device: ${info.model}, Android ${info.android}`);

  const chromePath = await adbText('shell', 'pm', 'path', 'com.android.chrome').catch(() => '');
  if (!chromePath.includes('package:')) throw new Error('Chrome for Android is not installed on this system image');

  const recorder = spawn('adb', ['shell', 'screenrecord', '--time-limit', '150', '/sdcard/android-chrome-poc.mp4'], { stdio: 'ignore' });
  await sleep(1000);

  await adb('forward', 'tcp:9222', 'localabstract:chrome_devtools_remote');
  await adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', SITE_URL, 'com.android.chrome');

  // Walk through any first-run or sync prompts until the page target appears.
  let pageTarget = null;
  for (let round = 0; round < 30 && !pageTarget; round++) {
    await tapIfPresent(DISMISS);
    await sleep(1500);
    const targets = await getTargets();
    pageTarget = targets.find(t => t.type === 'page' && t.url.startsWith(SITE_URL));
    if (!pageTarget && round > 0 && round % 8 === 0) {
      await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
      await adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', SITE_URL, 'com.android.chrome');
    }
  }
  if (!pageTarget) throw new Error('Chrome did not reach the site (first-run prompts not cleared)');

  const version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
  info.chrome = version.Browser;
  console.log(`browser: ${info.chrome}`);

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().startsWith(SITE_URL)) || context.pages()[0];
  await page.bringToFront().catch(() => {});
  if (!page.url().startsWith(SITE_URL)) await page.goto(SITE_URL, { waitUntil: 'load' });
  await page.waitForSelector('.thumbs .thumb.sel', { timeout: 30000 });

  // Match the e2e setup: dismiss the consent banner and pick a theme via
  // localStorage, then reload so the banner is gone and nothing overlays the
  // screenshot choices (run 1 failure: the banner covered the tap target).
  await page.evaluate(() => {
    localStorage.setItem('nick-theme', 'dark');
    localStorage.setItem('websites-by-nick-cookie-preferences', 'essential');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.thumbs .thumb.sel', { timeout: 30000 });

  const group = page.locator('.thumbs').first();
  const buttons = group.locator('.thumb:visible');
  const before = {
    label: await group.locator('.thumb.sel').textContent(),
    src: await page.locator('.shot-img:visible').first().getAttribute('src'),
  };
  await page.screenshot({ path: `${ARTIFACTS}/before-tap.png` });

  // Real touch tap on the second choice, at its on-screen coordinates.
  const target = buttons.nth(1);
  const targetLabel = (await target.textContent()).trim();
  const box = await target.boundingBox();
  const session = await context.newCDPSession(page);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  // No fixed waits: poll until the selection and the visible capture change.
  await page.waitForFunction(({ groupIdx, label }) => {
    const g = document.querySelectorAll('.thumbs')[groupIdx];
    const sel = g && g.querySelector('.thumb.sel');
    return sel && sel.textContent.trim() === label && g.querySelectorAll('[aria-pressed="true"]').length === 1;
  }, { groupIdx: 0, label: targetLabel }, { timeout: 10000 });
  await page.waitForFunction(prev => {
    const img = [...document.querySelectorAll('.shot-img')].find(i => i.offsetParent !== null);
    return img && img.currentSrc && img.currentSrc !== prev;
  }, before.src, { timeout: 10000 });

  const after = {
    label: (await group.locator('.thumb.sel').textContent()).trim(),
    src: await page.evaluate(() => { const img = [...document.querySelectorAll('.shot-img')].find(i => i.offsetParent !== null); return img && img.currentSrc; }),
  };
  await sleep(400); // let the swapped capture finish decoding for the screenshot
  await page.screenshot({ path: `${ARTIFACTS}/after-tap.png` });

  const noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  if (!noHorizontalOverflow) throw new Error('page overflows horizontally on a phone viewport');
  if (after.label === before.label) throw new Error('touch tap did not change the selected screenshot');

  console.log(`tap changed selection: "${before.label.trim()}" -> "${after.label}"`);

  // A real touch swipe across the visible capture: left swipe pages to the
  // next choice, right swipe pages back (showcase.js gesture handling).
  const swipe = async (fromRight) => {
    const imgBox = await page.evaluate(() => {
      const img = [...document.querySelectorAll('.shot-img')].find(i => i.offsetParent !== null);
      const r = img.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const cy = imgBox.y + imgBox.height / 2;
    const startX = fromRight ? imgBox.x + imgBox.width * 0.8 : imgBox.x + imgBox.width * 0.2;
    const endX = fromRight ? imgBox.x + imgBox.width * 0.2 : imgBox.x + imgBox.width * 0.8;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: cy }] });
    for (let i = 1; i <= 5; i++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX + (endX - startX) * (i / 5), y: cy }] });
      await sleep(60);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const selectedLabel = () => group.locator('.thumb.sel').textContent().then(t => t.trim());
  const nextLabel = (await buttons.nth(2).textContent()).trim();

  await swipe(true); // left swipe -> next choice
  await page.waitForFunction(({ groupIdx, label }) => {
    const g = document.querySelectorAll('.thumbs')[groupIdx];
    const sel = g && g.querySelector('.thumb.sel');
    return sel && sel.textContent.trim() === label;
  }, { groupIdx: 0, label: nextLabel }, { timeout: 15000 });
  await page.screenshot({ path: `${ARTIFACTS}/after-swipe.png` });
  console.log(`left swipe changed selection: "${after.label}" -> "${nextLabel}"`);

  await swipe(false); // right swipe -> back
  await page.waitForFunction(({ groupIdx, label }) => {
    const g = document.querySelectorAll('.thumbs')[groupIdx];
    const sel = g && g.querySelector('.thumb.sel');
    return sel && sel.textContent.trim() === label;
  }, { groupIdx: 0, label: after.label }, { timeout: 15000 });
  console.log(`right swipe changed selection back: "${nextLabel}" -> "${after.label}"`);

  await adb('shell', 'pkill', '-INT', 'screenrecord').catch(() => {});
  await sleep(2500);
  recorder.kill();
  await adb('pull', '/sdcard/android-chrome-poc.mp4', `${ARTIFACTS}/android-chrome-poc.mp4`).catch(e => console.log('video pull failed:', e.message));

  info.result = `tap "${before.label.trim()}" -> "${after.label}"; left swipe -> "${nextLabel}"; right swipe -> back; capture swapped, no horizontal overflow`;
  writeFileSync(`${ARTIFACTS}/summary.json`, JSON.stringify(info, null, 2));
  console.log('ANDROID CHROME POC PASSED', JSON.stringify(info));
  await browser.close();
}

main().catch(async err => {
  console.error('ANDROID CHROME POC FAILED:', err.message);
  // Save a screenshot and the selected state to make CI failures diagnosable.
  try {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const pages = browser.contexts()[0].pages();
    if (pages[0]) {
      await pages[0].screenshot({ path: `${ARTIFACTS}/failure.png` });
      const state = await pages[0].evaluate(() => ({
        url: location.href,
        selected: [...document.querySelectorAll('.thumbs')].map(g => g.querySelector('.thumb.sel')?.textContent?.trim()),
        banner: !!document.querySelector('[class*="cookie"], [id*="cookie"]'),
      }));
      writeFileSync(`${ARTIFACTS}/failure-state.json`, JSON.stringify(state, null, 2));
    }
    await browser.close();
  } catch (e) { console.log('failure capture skipped:', e.message); }
  try { await adb('shell', 'pkill', '-INT', 'screenrecord'); await sleep(2500); await adb('pull', '/sdcard/android-chrome-poc.mp4', `${ARTIFACTS}/android-chrome-poc.mp4`); } catch {}
  process.exit(1);
});
