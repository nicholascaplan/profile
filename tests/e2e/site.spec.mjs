// Browser checks for the three-page site (home / experience / contact) across
// Chromium, Firefox, WebKit and mobile Chrome.
// Usage: npx playwright test   (npm run test:e2e)

import { test } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const shotsDir = join(process.cwd(), 'test-results', 'screenshots');
async function shot(page, name, project) {
  mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: join(shotsDir, `${name}-${project}.png`) });
}

// WCAG contrast ratio of the hero/muted body text against the page background.
function heroTextContrast() {
  const lum = (rgb) => {
    const c = rgb.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map((v) => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const bg = getComputedStyle(document.body).backgroundColor;
  const text = getComputedStyle(document.querySelector('.hero p, .page-hero p, main p')).color;
  const a = lum(bg); const b = lum(text);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// The site settles its theme colours over a 0.45s transition; always wait past it
// before reading computed colours or screenshots.
const settle = (page) => page.waitForTimeout(1100);

// Desktop checks run at 1440x900: the site switches itself into mobile preview at
// viewports of 1280px and below.
const DESKTOP = { width: 1440, height: 900 };
const desktopOnly = (isMobile) => test.skip(isMobile, 'desktop chrome and keyboard check');

// Text enlargement emulation: double every px font-size in the shared
// stylesheet (the site's fonts are all px; unitless line-heights scale with
// them) while the layout viewport stays the same width, matching browser
// text-only zoom.
async function enlargeText(page) {
  await page.evaluate(async () => {
    const link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => l.href.includes('/assets/css/'));
    const css = await (await fetch(link.href)).text();
    const doubled = css.replace(/(font-size\s*:\s*)([^;}]+)/g,
      (all, prop, val) => prop + val.replace(/(\d+(?:\.\d+)?)px/g, (m, n) => (parseFloat(n) * 2) + 'px'));
    const s = document.createElement('style');
    s.textContent = doubled;
    document.head.appendChild(s);
  });
}

test('desktop: dark by default, toggle switches to light with sufficient contrast', async ({ page, isMobile }, testInfo) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  const state = await page.evaluate(() => ({
    visibleH1: [...document.querySelectorAll('h1')].filter((h) => h.offsetParent !== null).length,
    theme: document.body.dataset.theme,
    pressed: document.querySelector('.theme-toggle').getAttribute('aria-pressed'),
    label: document.querySelector('.theme-toggle').getAttribute('aria-label'),
    hasMobileToggle: !!document.querySelector('.mobile-toggle'),
  }));
  assert.equal(state.visibleH1, 1, 'exactly one h1 is rendered');
  assert.equal(state.theme, 'dark', 'new visitors get the dark theme by default');
  assert.equal(state.pressed, 'true');
  assert.equal(state.label, 'Switch to light mode');
  assert.equal(state.hasMobileToggle, true, 'mobile preview toggle present on a local host');
  await page.locator('.theme-toggle').click();
  await settle(page);
  const light = await page.evaluate(() => {
    const lum = (rgb) => {
      const c = rgb.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map((v) => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const bg = lum(getComputedStyle(document.body).backgroundColor);
    const fg = lum(getComputedStyle(document.querySelector('.hero h1')).color);
    return {
      theme: document.body.dataset.theme,
      pressed: document.querySelector('.theme-toggle').getAttribute('aria-pressed'),
      headlineContrast: (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05),
    };
  });
  assert.equal(light.theme, 'light', 'toggle switches a new visitor to light');
  assert.equal(light.pressed, 'false');
  assert.ok(light.headlineContrast >= 4.5, `light theme headline contrast ${light.headlineContrast.toFixed(2)}:1 meets 4.5:1`);
  await shot(page, 'browser-desktop-light', testInfo.project.name);
});

test('dark system preference: page opens dark and the toggle shows it', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await settle(page);
  const state = await page.evaluate(() => ({
    theme: document.body.dataset.theme,
    pressed: document.querySelector('.theme-toggle').getAttribute('aria-pressed'),
    label: document.querySelector('.theme-toggle .theme-label').textContent,
  }));
  assert.equal(state.theme, 'dark');
  assert.equal(state.pressed, 'true');
  assert.equal(state.label, 'Light mode');
  const contrast = await page.evaluate(heroTextContrast);
  assert.ok(contrast >= 4.5, `dark theme body text contrast ${contrast.toFixed(2)}:1 meets 4.5:1`);
  await shot(page, 'browser-desktop-dark', testInfo.project.name);
});

test('theme toggle: click switches to light, reload restores it', async ({ page, isMobile }, testInfo) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.locator('.theme-toggle').click();
  const after1 = await page.evaluate(() => ({ theme: document.body.dataset.theme, stored: localStorage.getItem('nick-theme') }));
  assert.equal(after1.theme, 'light');
  assert.equal(after1.stored, 'light');
  await settle(page);
  const renderedBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const renderedContrast = await page.evaluate(heroTextContrast);
  assert.equal(renderedBg, 'rgb(238, 233, 226)', 'light background is actually painted');
  assert.ok(renderedContrast >= 4.5, `light body text contrast ${renderedContrast.toFixed(2)}:1 meets 4.5:1`);
  await shot(page, 'browser-desktop-light-toggled', testInfo.project.name);
  await page.reload();
  await settle(page);
  const after2 = await page.evaluate(() => document.body.dataset.theme);
  assert.equal(after2, 'light', 'stored choice survives a reload');
});

test('theme and layout apply before first paint, before external scripts run', async ({ page }) => {
  // Delay the external scripts well past first paint; the inline bootstrap must
  // already hold the final theme and frame so the page never flashes.
  const prepaintState = () => ({
    bg: getComputedStyle(document.body).backgroundColor,
    theme: document.body.dataset.theme,
    mobile: document.body.dataset.mobile,
    shellWidth: Math.round(document.querySelector('.site-shell').getBoundingClientRect().width),
    siteJsRan: !!document.querySelector('.zoom-cue'),
  });
  await page.route('**/assets/js/*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.continue();
  });
  const painted = () => page.waitForFunction(() => getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)');
  // The body's background fades in over .45s when site.css loads; Firefox and WebKit can
  // reach the read mid-transition. Wait out the fade so the asserted colour is the final one.
  const settledPaint = async () => { await painted(); await settle(page); };
  // Background can paint before the parser reaches .site-shell; wait for the node itself
  // (the delayed site.js route still holds, so the prepaint assertions keep their meaning).

  await page.setViewportSize(DESKTOP);
  await page.goto('/', { waitUntil: 'commit' });
  await settledPaint();
  await page.waitForSelector('.site-shell', { state: 'attached' });
  const desktop = await page.evaluate(prepaintState);
  assert.equal(desktop.siteJsRan, false, 'external site.js has not run yet');
  assert.equal(desktop.theme, 'dark', 'dark default is set before first paint');
  assert.equal(desktop.bg, 'rgb(24, 33, 29)', 'dark background is the first thing painted');
  assert.equal(desktop.mobile, 'false');
  await page.waitForLoadState('load');
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'dark', 'site.js agrees with the bootstrap - no flip');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'commit' });
  await settledPaint();
  await page.waitForSelector('.site-shell', { state: 'attached' });
  const phone = await page.evaluate(prepaintState);
  assert.equal(phone.siteJsRan, false, 'external site.js has not run yet');
  assert.equal(phone.mobile, 'true', 'phone frame is set before first paint');
  assert.equal(phone.shellWidth, 390, 'phone frame already fills the painted viewport');

  await page.addInitScript(() => { try { window.localStorage.setItem('nick-theme', 'light'); } catch (error) {} });
  await page.setViewportSize(DESKTOP);
  await page.goto('/', { waitUntil: 'commit' });
  await settledPaint();
  await page.waitForSelector('.site-shell', { state: 'attached' });
  const stored = await page.evaluate(prepaintState);
  assert.equal(stored.siteJsRan, false, 'external site.js has not run yet');
  assert.equal(stored.theme, 'light', 'a stored light choice is set before first paint');
  assert.equal(stored.bg, 'rgb(238, 233, 226)', 'light background is the first thing painted');
  await page.waitForLoadState('load');
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'light', 'site.js agrees with the stored choice - no flip');
});

test('footer CTA: heading links to the contact action on every page', async ({ page }) => {
  await page.goto('/');
  assert.equal(await page.locator('.footer-cta').getAttribute('href'), 'contact/');
  await page.goto('/experience/');
  assert.equal(await page.locator('.footer-cta').getAttribute('href'), '../contact/');
  await page.goto('/contact/');
  const cta = page.locator('.footer-cta');
  assert.equal(await cta.getAttribute('href'), '#contact-form');
  await cta.click();
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => {
    const form = document.querySelector('#contact-form');
    const r = form.getBoundingClientRect();
    return { hash: window.location.hash, active: document.activeElement && document.activeElement.id, inView: r.top < window.innerHeight && r.bottom > 0 };
  });
  assert.equal(state.hash, '#contact-form');
  assert.equal(state.active, 'contact-form', 'focus moves to the form');
  assert.equal(state.inView, true, 'form scrolled into view');
});

test('navigation: every page is reachable by its real URL from the nav', async ({ page, isMobile }, testInfo) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.locator('.nav-links a[href="experience/"]').click();
  await page.waitForURL('**/experience/');
  assert.equal(await page.evaluate(() => document.querySelector('h1').textContent.trim()), 'Selected experience.');
  assert.equal(await page.evaluate(() => document.querySelector('.nav-links a[aria-current="page"]').textContent.trim()), 'Experience');
  await page.locator('.nav-links a[href="../contact/"]').click();
  await page.waitForURL('**/contact/');
  assert.equal(await page.evaluate(() => document.querySelector('h1').textContent.trim()), 'Have a website in mind?');
  await page.locator('.nav-links a[href="../"]').first().click();
  await page.waitForURL('**/');
  assert.match(await page.evaluate(() => document.querySelector('h1').textContent), /Websites that earn/);
  await shot(page, 'browser-nav-roundtrip', testInfo.project.name);
});

test('keyboard: full page tab order reaches nav, toggles and hero actions', async ({ page, isMobile }) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  const seen = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const name = await page.evaluate(() => {
      const el = document.activeElement;
      return el.id || (typeof el.className === 'string' && el.className) || el.tagName;
    });
    if (seen.length > 3 && name === seen[0]) break;
    seen.push(name);
  }
  const joined = seen.join('|');
  for (const expected of ['wordmark', 'theme-toggle', 'mobile-toggle', 'button-primary']) {
    assert.ok(joined.includes(expected), `tab order reaches ${expected} (saw: ${joined.slice(0, 200)})`);
  }
});

test('keyboard: Enter on a nav link navigates, Enter and Space toggle the theme', async ({ page, isMobile }) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.locator('.nav-links a[href="experience/"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/experience/');

  await page.locator('.theme-toggle').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'light', 'Enter on the focused toggle switches the theme');

  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'dark', 'Space on the focused toggle switches back');
});

test('keyboard: screenshot lightbox opens, traps focus, closes and restores focus', async ({ page }) => {
  await page.goto('/');
  const cue = page.locator('.case-shot .zoom-cue').first();
  await cue.focus();
  await page.keyboard.press('Enter');
  const dialog = page.locator('.shot-zoom[role="dialog"]');
  await dialog.waitFor();
  assert.equal(await dialog.getAttribute('aria-modal'), 'true', 'dialog is modal');
  assert.equal(await dialog.getAttribute('aria-label'), 'Enlarged screenshot', 'dialog has an accessible name');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'z-close', 'focus moves to the close button');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'z-close', 'Tab stays on the close button while the dialog is open');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.shot-zoom').count(), 0, 'Escape closes the lightbox');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'zoom-cue', 'focus returns to the enlarge button');
  await page.keyboard.press('Space');
  await page.locator('.shot-zoom[role="dialog"]').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.shot-zoom').count(), 0, 'Space also opens and Escape closes again');
  await cue.click();
  await page.locator('.shot-zoom[role="dialog"]').waitFor();
  await page.locator('.shot-zoom .z-close').click();
  assert.equal(await page.locator('.shot-zoom').count(), 0, 'pointer click opens and the close button closes');
});

test('keyboard: contact form can be completed and submitted by keyboard (submission intercepted)', async ({ page, isMobile }) => {
  desktopOnly(isMobile);
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      window.__submitted = false;
      document.querySelector('.contact-form')?.addEventListener('submit', (e) => { e.preventDefault(); window.__submitted = true; });
    });
  });
  await page.setViewportSize(DESKTOP);
  await page.goto('/contact/');
  await page.locator('#contact-name').focus();
  await page.keyboard.type('Test Person');
  await page.keyboard.press('Tab');
  await page.keyboard.type('test@example.com');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Hello from the keyboard');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.className);
  assert.match(String(focused), /button|submit/, `keyboard flow ends on the submit button (focused: ${focused})`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => ({ submitted: window.__submitted, valid: document.querySelector('.contact-form').checkValidity() }));
  assert.equal(state.valid, true, 'form is valid after keyboard entry');
  assert.equal(state.submitted, true, 'Enter on the submit button fires submission (intercepted, nothing sent)');
});

for (const [name, path] of [['home', '/'], ['experience', '/experience/'], ['contact', '/contact/']]) {
  test(`mobile 390px (${name}): one visible h1, no horizontal scrolling, visible nav chips`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    const state = await page.evaluate(() => ({
      visibleH1: [...document.querySelectorAll('h1')].filter((h) => h.offsetParent !== null).length,
      mobileMode: document.body.dataset.mobile,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      chips: [...document.querySelectorAll('.nav-chips a')].filter((a) => a.offsetParent !== null).length,
      chipDelta: Math.max(...[...document.querySelectorAll('.nav-chips a')].filter((a) => a.offsetParent !== null).map((a) => {
        const range = document.createRange();
        range.selectNodeContents(a);
        const t = range.getBoundingClientRect();
        const b = a.getBoundingClientRect();
        return Math.abs((t.top + t.bottom) / 2 - (b.top + b.bottom) / 2);
      })),
      menuButton: !!document.querySelector('[aria-label*="menu" i], .hamburger'),
    }));
    assert.equal(state.visibleH1, 1, 'exactly one h1 is rendered');
    assert.equal(state.mobileMode, 'true', 'mobile layout active at 390px');
    assert.ok(state.overflow <= 1, `no horizontal scroll (overflow ${state.overflow}px)`);
    assert.equal(state.chips, 3, 'Work / Experience / Contact chips all visible on mobile');
    assert.ok(state.chipDelta <= 2, `chip labels vertically centred (delta ${state.chipDelta.toFixed(1)}px)`);
    assert.equal(state.menuButton, false, 'no hidden menu button');
    await settle(page);
    await shot(page, `browser-mobile-390-${name}`, testInfo.project.name);
  });
}

test('portrait: headline and portrait share the hero without overlap or horizontal scroll', async ({ page }, testInfo) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const r = await page.evaluate(() => {
      const h1 = document.querySelector('.hero h1');
      const p = document.querySelector('.hero .portrait');
      if (!h1 || !p || p.offsetParent === null) return { missing: true };
      const a = h1.getBoundingClientRect();
      const b = p.getBoundingClientRect();
      const overlap = !(b.right <= a.left || b.left >= a.right || b.bottom <= a.top || b.top >= a.bottom);
      return {
        overlap,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        portraitWidth: Math.round(b.width),
      };
    });
    assert.ok(!r.missing, `portrait renders at ${width}px`);
    assert.equal(r.overlap, false, `headline and portrait must not overlap at ${width}px`);
    assert.ok(r.overflow <= 1, `no horizontal scroll at ${width}px (overflow ${r.overflow}px)`);
  }
  await settle(page);
  await shot(page, 'browser-portrait-hero', testInfo.project.name);
});

test('200% text at a laptop viewport: no horizontal scrolling', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `no horizontal scroll at 720px effective width (overflow ${overflow}px)`);
  await settle(page);
  await shot(page, 'browser-zoom-720', testInfo.project.name);
});

test('light-theme muted body text has at least 4.5:1 contrast', async ({ page }) => {
  await page.addInitScript(() => { try { window.localStorage.setItem('nick-theme', 'light'); } catch (error) {} });
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await settle(page); // let the .45s background fade finish so the measured colours are the final ones
  const contrast = await page.evaluate(heroTextContrast);
  assert.ok(contrast >= 4.5, `muted body text contrast ${contrast.toFixed(2)}:1 is below 4.5:1`);
});

test('showcase: thumbnails choose the screenshot, desktop', async ({ page, isMobile }, testInfo) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await settle(page);
  const before = await page.evaluate(() => ({
    src: document.querySelector('.case:first-child .shot-desk').src,
    pill: document.querySelector('.case:first-child .pill').textContent,
  }));
  assert.match(before.src, /foa-home-desk\.webp$/, 'homepage screenshot shown by default');
  assert.match(before.pill, /1 OF 3 · HOMEPAGE · DESKTOP/, 'pill labels the default shot');
  await page.locator('.case:first-child .thumb:nth-child(2)').click();
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({
    src: document.querySelector('.case:first-child .shot-desk').src,
    mobSrc: document.querySelector('.case:first-child .shot-mob').src,
    pill: document.querySelector('.case:first-child .pill').textContent,
    pressed: document.querySelector('.case:first-child .thumb:nth-child(2)').getAttribute('aria-pressed'),
    otherPill: document.querySelector('.case:last-child .pill').textContent,
  }));
  assert.match(after.src, /foa-whatson-desk\.webp$/, 'main screenshot swaps to the chosen page');
  assert.match(after.mobSrc, /foa-whatson-mob\.webp$/, 'mobile variant swaps too');
  assert.match(after.pill, /2 OF 3 · WHAT’S ON · DESKTOP/, 'pill follows the choice');
  assert.equal(after.pressed, 'true', 'chosen thumbnail is pressed');
  assert.match(after.otherPill, /1 OF 3/, 'the other card is untouched');
  await shot(page, 'browser-showcase-thumb-pick', testInfo.project.name);
});

test('showcase: mobile arrows and counter step and wrap through the same set', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await settle(page);
  const first = '.case:first-child';
  const state0 = await page.evaluate((sel) => ({
    steps: document.querySelector(`${sel} .m-step`).offsetParent !== null,
    cnt: document.querySelector(`${sel} .cnt`).textContent,
  }), first);
  assert.equal(state0.steps, true, 'arrows and counter are visible on mobile');
  assert.equal(state0.cnt, '1 OF 3');
  await page.locator(`${first} .arr[data-step="1"]`).click();
  await page.waitForTimeout(200);
  const state1 = await page.evaluate((sel) => ({
    src: document.querySelector(`${sel} .shot-mob`).src,
    cnt: document.querySelector(`${sel} .cnt`).textContent,
    pill: document.querySelector(`${sel} .pill`).textContent,
  }), first);
  assert.match(state1.src, /foa-whatson-mob\.webp$/, 'next arrow swaps the mobile screenshot');
  assert.equal(state1.cnt, '2 OF 3');
  assert.match(state1.pill, /MOBILE/, 'pill names the mobile set');
  await page.locator(`${first} .arr[data-step="-1"]`).click();
  await page.locator(`${first} .arr[data-step="-1"]`).click();
  await page.waitForTimeout(200);
  const state2 = await page.evaluate((sel) => document.querySelector(`${sel} .cnt`).textContent, first);
  assert.equal(state2, '3 OF 3', 'previous arrow wraps to the last screenshot');
  await shot(page, 'browser-showcase-mobile-arrows', testInfo.project.name);
});

test('showcase: thumbnails and main shot show the matching breakpoint imagery', async ({ page }) => {
  const visible = () => {
    const first = document.querySelector('.case:first-child');
    const vis = (el) => !!el && el.offsetParent !== null;
    return {
      deskShot: vis(first.querySelector('.shot-desk')),
      mobShot: vis(first.querySelector('.shot-mob')),
      deskThumb: vis(first.querySelector('.thumb .thumb-desk')),
      mobThumb: vis(first.querySelector('.thumb .thumb-mob')),
    };
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await settle(page);
  assert.deepEqual(await page.evaluate(visible), { deskShot: true, mobShot: false, deskThumb: true, mobThumb: false },
    'desktop shows desktop screenshots only');
  // the layout mode is chosen at load time, and on a local host a stored
  // preview choice wins over the viewport, so clear it and reload narrower
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await settle(page);
  assert.deepEqual(await page.evaluate(visible), { deskShot: false, mobShot: true, deskThumb: false, mobThumb: true },
    'mobile shows mobile screenshots only');
});

// Nick's rule (24 October 2026): a CTA symbol must never wrap away from the end
// of its label. Check every visible CTA with a symbol, narrow widths and enlarged text.
test('CTA symbols stay with the end of their label at narrow widths and enlarged text', async ({ page }, testInfo) => {
  const probe = () => {
    const bad = [];
    for (const el of document.querySelectorAll('.hero-actions .button, .nav-contact, .case-copy .button, .teaser .button, .contact-form button[type=submit], .github-link, .footer-cta')) {
      if (el.offsetParent === null) continue;
      const sym = el.querySelector('span[aria-hidden="true"], svg');
      if (!sym) continue;
      const textNodes = [];
      (function walk(n) {
        for (const c of n.childNodes) {
          if (c.nodeType === 3 && c.textContent.trim()) textNodes.push(c);
          else if (c.nodeType === 1 && c !== sym && !sym.contains(c)) walk(c);
        }
      })(el);
      if (!textNodes.length) continue;
      const range = document.createRange();
      range.selectNodeContents(textNodes[textNodes.length - 1]);
      const rects = [...range.getClientRects()];
      if (!rects.length) continue;
      const lastLine = rects[rects.length - 1];
      const sr = sym.getBoundingClientRect();
      const symMid = sr.top + sr.height / 2;
      const lineMid = lastLine.top + lastLine.height / 2;
      if (Math.abs(symMid - lineMid) > 4 || sr.left < lastLine.left) {
        bad.push({ cta: el.textContent.trim().slice(0, 30), symY: Math.round(symMid), lineY: Math.round(lineMid) });
      }
    }
    return bad;
  };
  const stranded = [];
  for (const path of ['/', '/contact/']) {
    for (const scenario of [{ width: 320, zoom: false }, { width: 390, zoom: false }, { width: 390, zoom: true }, { width: 320, zoom: true }]) {
      await page.setViewportSize({ width: scenario.width, height: 700 });
      await page.goto(path);
      if (scenario.zoom) await enlargeText(page);
      await settle(page);
      const bad = await page.evaluate(probe);
      for (const b of bad) stranded.push({ ...b, path, width: scenario.width, zoom: scenario.zoom });
      await shot(page, `browser-${scenario.width}${scenario.zoom ? '-text200' : ''}-cta-symbols${path === '/' ? '' : '-contact'}`, testInfo.project.name);
    }
  }
  assert.equal(stranded.length, 0, `CTA symbols separated from the end of their label: ${JSON.stringify(stranded)}`);
});

test('contact form: empty form is invalid, completed form is valid', async ({ page }) => {
  await page.goto('/contact/');
  const state = await page.evaluate(() => ({
    emptyValid: document.querySelector('.contact-form').checkValidity(),
    emailBad: (() => { const e = document.querySelector('#contact-email'); e.value = 'not-an-email'; return e.validity.typeMismatch; })(),
    filledValid: (() => {
      document.querySelector('#contact-name').value = 'Test Person';
      const e = document.querySelector('#contact-email'); e.value = 'test@example.com';
      document.querySelector('#contact-message').value = 'Hello';
      return document.querySelector('.contact-form').checkValidity();
    })(),
    action: document.querySelector('.contact-form').action,
  }));
  assert.equal(state.emptyValid, false, 'empty form fails native validation');
  assert.equal(state.emailBad, true, 'malformed email is rejected');
  assert.equal(state.filledValid, true, 'completed form passes native validation');
  assert.match(state.action, /^https:\/\//);
});

test('experience page: all four roles render', async ({ page }) => {
  await page.goto('/experience/');
  const roles = await page.evaluate(() => [...document.querySelectorAll('.role .role-title')].map((r) => r.textContent.trim()));
  assert.equal(roles.length, 4, 'four roles listed');
  for (const expected of ['NatWest Boxed', 'Oddschecker', 'Moogsoft', 'Alfa']) {
    assert.ok(roles.some((r) => r.includes(expected)), `role present: ${expected}`);
  }
});
