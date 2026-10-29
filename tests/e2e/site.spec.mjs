// Browser checks for the three-page site (home / experience / contact) across
// Chromium, Firefox, WebKit and mobile Chrome.
// Usage: npx playwright test   (npm run test:e2e)

import { test, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const shotsDir = join(process.cwd(), 'test-results', 'screenshots');
async function shot(page, name, project) {
  mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: join(shotsDir, `${name}-${project}.png`) });
}

// Viewport resizes do not apply synchronously under mobile emulation: media
// queries and grid tracks can still report the previous width's layout on the
// first measurement. After a resize, wait until the hero geometry reads
// identically twice in a row before asserting on it.
async function settleHeroLayout(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForFunction(() => {
    const h1 = document.querySelector('.hero h1');
    const grid = document.querySelector('.hero-grid');
    if (!h1 || !grid) return true;
    const probe = JSON.stringify([
      h1.getBoundingClientRect().width,
      getComputedStyle(h1).fontSize,
      getComputedStyle(grid).gridTemplateColumns,
    ]);
    const stable = probe === window.__heroProbe;
    window.__heroProbe = probe;
    return stable;
  }, null, { polling: 100, timeout: 10000 });
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

// Desktop checks run at 1440x900. Public phone styling starts at 600px;
// the fixed preview frame requires an explicit development-toggle choice.
const DESKTOP = { width: 1440, height: 900 };
const desktopOnly = (isMobile) => test.skip(isMobile, 'desktop chrome and keyboard check');

// Text enlargement emulation: double every px font-size in the shared
// stylesheet (the site's fonts are all px; unitless line-heights scale with
// them) while the layout viewport stays the same width, matching browser
// text-only zoom.
async function enlargeText(page) {
  await page.evaluate(async () => {
    const link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => l.href.includes('/assets/css/site.css'));
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
    siteJsRan: document.body.dataset.motion === 'on',
  });
  await page.route('**/assets/js/*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.continue();
  });
  const painted = () => page.waitForFunction(() => getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)');
  // Background can paint before the parser reaches .site-shell; wait for the node itself
  // (the delayed site.js route still holds, so the prepaint assertions keep their meaning).

  await page.setViewportSize(DESKTOP);
  await page.goto('/', { waitUntil: 'commit' });
  await painted();
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
  await painted();
  await page.waitForSelector('.site-shell', { state: 'attached' });
  const phone = await page.evaluate(prepaintState);
  assert.equal(phone.siteJsRan, false, 'external site.js has not run yet');
  assert.equal(phone.mobile, 'true', 'phone frame is set before first paint');
  assert.equal(phone.shellWidth, 390, 'phone frame already fills the painted viewport');

  await page.addInitScript(() => { try { window.localStorage.setItem('nick-theme', 'light'); } catch (error) {} });
  await page.setViewportSize(DESKTOP);
  await page.goto('/', { waitUntil: 'commit' });
  await painted();
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

test('footer privacy stays bottom right with consistent small-print typography', async ({ page }) => {
  for (const path of ['/', '/experience/', '/contact/', '/privacy/']) {
    for (const width of [320, 698, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const footer = await page.locator('.footer-bottom').evaluate((el) => {
        const source = el.querySelector('.github-link');
        const privacy = el.querySelector('a[href$="privacy/"]');
        const rect = privacy.getBoundingClientRect();
        const bounds = el.getBoundingClientRect();
        const font = (node) => {
          const style = getComputedStyle(node);
          return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight, style.letterSpacing];
        };
        return {
          right: rect.right,
          edge: bounds.right,
          bottom: rect.bottom,
          top: rect.top,
          sourceTop: source.getBoundingClientRect().top,
          sourceBottom: source.getBoundingClientRect().bottom,
          fonts: [font(source), font(privacy)],
          overflow: el.scrollWidth > el.clientWidth,
        };
      });
      assert.ok(Math.abs(footer.right - footer.edge) < 1, `privacy is right-aligned on ${path} at ${width}px`);
      assert.ok(footer.bottom >= footer.sourceBottom - 2, `privacy is on the bottom row on ${path} at ${width}px`);
      assert.ok(Math.abs(footer.top - footer.sourceTop) < 4, `source and privacy sit in line on ${path} at ${width}px`);
      assert.deepEqual(footer.fonts[0], footer.fonts[1], 'footer links share the same typography');
      assert.equal(footer.overflow, false, 'footer does not overflow');
    }
  }
});

test('hero portrait grows on desktop without changing the tablet size', async ({ page }) => {
  for (const [width, expected] of [[1440, 400], [1024, 307.2], [768, 190]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const size = await page.locator('.hero-grid .portrait-wrap').evaluate((el) => el.getBoundingClientRect().width);
    assert.ok(Math.abs(size - expected) < 1, `portrait is about ${expected}px at ${width}px`);
  }
});

test('hero portrait stays within reach of the heading on wide screens', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await settleHeroLayout(page);
    const gap = await page.evaluate(() => {
      const heading = document.querySelector('.hero h1');
      const range = document.createRange();
      range.selectNodeContents(heading);
      const textEnd = Math.max(...[...range.getClientRects()].map((r) => r.right));
      return document.querySelector('.hero-grid .portrait-wrap').getBoundingClientRect().left - textEnd;
    });
    assert.ok(gap >= 16, `portrait clears the heading text at ${width}px (gap ${Math.round(gap)}px)`);
    assert.ok(gap < 280, `portrait stays within reach of the heading at ${width}px (gap ${Math.round(gap)}px)`);
  }
});

test('phone portrait is larger while still scaling down for narrow screens', async ({ page }) => {
  for (const [width, expected] of [[320, 89.6], [390, 109.2], [430, 120.4], [600, 130]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const size = await page.locator('.hero-grid .portrait-wrap').evaluate((el) => el.getBoundingClientRect().width);
    assert.ok(Math.abs(size - expected) < 1, `portrait is about ${expected}px at ${width}px`);
  }
});

test('hero heading keeps earn and their on the same line', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 390, 698, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await settleHeroLayout(page);
    const words = await page.locator('.hero h1').evaluate((heading) => {
      const node = heading.firstChild;
      return ['earn', 'their'].map((word) => {
        const start = node.textContent.indexOf(word);
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + word.length);
        const rect = range.getBoundingClientRect();
        return { top: rect.top, left: rect.left, right: rect.right };
      });
    });
    assert.equal(words[0].top, words[1].top, `earn their stays together at ${width}px`);
    assert.ok(words[0].left >= 0 && words[1].right <= width, `earn their fits at ${width}px`);
  }
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
      const b = p.getBoundingClientRect();
      const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
      const lines = [];
      while (walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        lines.push(...range.getClientRects());
      }
      const overlap = lines.some((a) => !(b.right <= a.left || b.left >= a.right || b.bottom <= a.top || b.top >= a.bottom));
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

test('responsive public layout: tablet and laptop widths stay fluid on every page', async ({ page, baseURL }) => {
  // Serve local files behind a non-preview hostname to exercise the same branch
  // as production, without depending on or modifying the real deployed site.
  await page.route('https://portfolio.example/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await page.request.get(`${baseURL}${url.pathname}`);
    await route.fulfill({ response });
  });
  await page.addInitScript(() => localStorage.setItem('nick-mobile', 'true'));
  for (const path of ['/', '/experience/', '/contact/']) {
    await page.goto(`https://portfolio.example${path}`);
    for (const width of [1280, 768, 600, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction((phone) => document.body.dataset.mobile === String(phone), width <= 600);
      const state = await page.evaluate(() => ({
        shell: document.querySelector('.site-shell').getBoundingClientRect().width,
        preview: document.body.dataset.preview,
        toggle: document.querySelector('.mobile-toggle'),
        overflow: document.documentElement.scrollWidth - innerWidth,
      }));
      assert.equal(state.shell, width, `${path} fills ${width}px without a preview frame`);
      assert.equal(state.preview, 'false');
      assert.equal(state.toggle, null);
      assert.ok(state.overflow <= 1, `${path} has no horizontal scroll at ${width}px`);
    }
  }
});

test('phone: work appears before details, body text is readable and headline wraps comfortably', async ({ page }) => {
  for (const width of [320, 360, 390, 430, 600]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const state = await page.evaluate(() => {
      const caseEl = document.querySelector('.case');
      const heading = caseEl.querySelector('.case-heading').getBoundingClientRect();
      const image = caseEl.querySelector('.case-shot').getBoundingClientRect();
      const details = caseEl.querySelector('.case-copy').getBoundingClientRect();
      const h1 = document.querySelector('.hero h1');
      const range = document.createRange();
      range.selectNodeContents(h1);
      const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
      const lines = [];
      while (walker.nextNode()) {
        range.selectNodeContents(walker.currentNode);
        lines.push(...range.getClientRects());
      }
      const portrait = document.querySelector('.portrait').getBoundingClientRect();
      const opening = document.createRange();
      opening.setStart(h1.firstChild, 0);
      opening.setEnd(h1.firstChild, 'Websites that'.length);
      return {
        headingBeforeImage: heading.bottom <= image.top,
        imageBeforeDetails: image.bottom <= details.top,
        imageTop: image.top,
        font: parseFloat(getComputedStyle(caseEl.querySelector('p')).fontSize),
        headlineLines: h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight),
        portraitBeside: lines.every((line) => line.bottom <= portrait.top || line.top >= portrait.bottom || line.right <= portrait.left),
        linesBesidePortrait: lines.filter((line) => line.bottom > portrait.top && line.top < portrait.bottom && line.right <= portrait.left).length,
        openingLines: opening.getClientRects().length,
        portraitWidth: portrait.width,
        contactLink: document.querySelector('.intro-contact').getBoundingClientRect().height,
      };
    });
    assert.ok(state.headingBeforeImage && state.imageBeforeDetails, `heading → image → details at ${width}px`);
    assert.ok(state.font >= 16, `project body copy is at least 16px at ${width}px`);
    assert.ok(state.headlineLines <= 5.1, `headline has at most five lines at ${width}px (saw ${state.headlineLines})`);
    assert.ok(state.portraitBeside, `portrait remains beside the painted headline at ${width}px`);
    assert.ok(state.linesBesidePortrait >= 2, `at least two painted headline lines wrap beside the portrait at ${width}px (saw ${state.linesBesidePortrait})`);
    assert.equal(state.openingLines, 1, `Websites that uses the full first line at ${width}px`);
    assert.ok(state.imageTop < 800, `first project image appears within 800px at ${width}px (saw ${state.imageTop})`);
    assert.ok(state.contactLink >= 44, 'early enquiry link has a comfortable target');
    if (width === 320) assert.ok(state.portraitWidth < 90, 'portrait scales down on narrow screens');
  }
});

test('contact: mobile fields avoid focus zoom and the message hint is accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/contact/');
  const state = await page.evaluate(() => ({
    fonts: [...document.querySelectorAll('.form-field input, .form-field textarea')].map((el) => parseFloat(getComputedStyle(el).fontSize)),
    describedBy: document.querySelector('#contact-message').getAttribute('aria-describedby'),
    hint: document.querySelector('#message-hint').textContent,
  }));
  assert.ok(state.fonts.every((size) => size >= 16), 'all input text is at least 16px');
  assert.deepEqual(state.describedBy.split(/\s+/), ['message-hint', 'contact-message-error']);
  assert.match(state.hint, /what would you like the website to achieve/);
});

test('closing contact copy has sufficient contrast in both themes', async ({ page }) => {
  await page.goto('/');
  for (const theme of ['dark', 'light']) {
    if (await page.evaluate(() => document.body.dataset.theme) !== theme) await page.locator('.theme-toggle').click();
    await settle(page);
    const contrast = await page.evaluate(() => {
      const luminance = (rgb) => {
        const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
          v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
        });
        return .2126 * r + .7152 * g + .0722 * b;
      };
      const a = luminance(getComputedStyle(document.querySelector('.footer-intro')).color);
      const b = luminance(getComputedStyle(document.querySelector('.footer')).backgroundColor);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    assert.ok(contrast >= 4.5, `${theme} footer body contrast ${contrast.toFixed(2)}:1 meets 4.5:1`);
  }
});

test('desktop mobile preview: content fits the frame and matches a phone layout', async ({ page, isMobile }, testInfo) => {
  desktopOnly(isMobile);
  const layout = () => {
    const shell = document.querySelector('.site-shell').getBoundingClientRect();
    const clipped = [...document.querySelectorAll('main h1, main h2, main h3, main p, main a, main input, main textarea, main .portrait')]
      .filter((el) => el.getClientRects().length)
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left < shell.left - 1 || r.right > shell.right + 1;
      })
      .map((el) => el.className || el.tagName);
    const structures = [...document.querySelectorAll('.hero, .role, .lower-grid, .contact-grid')].map((el) => {
      const css = getComputedStyle(el);
      return { display: css.display, columns: css.gridTemplateColumns };
    });
    // The showcase mirrors too: the phone capture stands alone in the preview,
    // exactly as on a real phone.
    structures.push(...['.case:first-child .shotbar', '.case:first-child .shot-desk', '.case:first-child .shot-mob'].map((sel) => {
      const el = document.querySelector(sel);
      const css = getComputedStyle(el);
      return { display: css.display, columns: css.position };
    }));
    const hero = document.querySelector('.hero');
    const walker = document.createTreeWalker(hero.querySelector('h1'), NodeFilter.SHOW_TEXT);
    const lines = [];
    while (walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      lines.push(...range.getClientRects());
    }
    const portrait = hero.querySelector('.portrait').getBoundingClientRect();
    const overlap = lines.some((text) => !(portrait.right <= text.left || portrait.left >= text.right || portrait.bottom <= text.top || portrait.top >= text.bottom));
    return { width: shell.width, clipped, structures, overlap };
  };
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.locator('.mobile-toggle').click();
  assert.equal(await page.locator('.mobile-toggle').getAttribute('aria-pressed'), 'true');
  const preview = await page.evaluate(layout);
  assert.equal(preview.width, 430);
  assert.deepEqual(preview.clipped, [], 'content must fit inside the frame, not just avoid document scrollbars');
  assert.equal(preview.overlap, false, 'headline and portrait must not overlap in the phone-width frame');
  await shot(page, 'browser-desktop-mobile-preview', testInfo.project.name);

  await page.setViewportSize({ width: 430, height: DESKTOP.height });
  await page.reload();
  const phone = await page.evaluate(layout);
  assert.deepEqual(preview.structures, phone.structures, 'preview and phone use the same responsive layouts');
  assert.deepEqual(phone.clipped, []);

  await page.setViewportSize(DESKTOP);
  await page.reload();
  assert.equal(await page.locator('.mobile-toggle').getAttribute('aria-pressed'), 'true', 'preview persists across reloads');
  await page.locator('.mobile-toggle').click();
  assert.equal(await page.locator('.mobile-toggle').getAttribute('aria-pressed'), 'false');
  assert.ok((await page.locator('.site-shell').boundingBox()).width > 430, 'toggle restores the desktop width');
  assert.equal(await page.locator('.hero-grid').evaluate((el) => getComputedStyle(el).display), 'grid', 'desktop hero returns to columns');
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
  assert.match(before.src, /foa-fundraising-desk-dark\.webp$/, 'Fundraising screenshot shown by default (page opens dark)');
  assert.equal(before.pill, 'Fundraising', 'pill labels the default shot');
  await page.locator('.case:first-child .thumb[data-label="What’s On"]').click();
  // The choice slides in (capture motion): wait for the swap to settle
  // rather than a fixed beat.
  await page.waitForFunction(() => {
    const d = document.querySelector('.case:first-child .shot-desk');
    const m = document.querySelector('.case:first-child .shot-mob');
    return d.src.includes('foa-whatson-desk') && m.src.includes('foa-whatson-mob')
      && !document.querySelector('.case:first-child .shot-layer');
  });
  const after = await page.evaluate(() => ({
    src: document.querySelector('.case:first-child .shot-desk').src,
    mobSrc: document.querySelector('.case:first-child .shot-mob').src,
    pill: document.querySelector('.case:first-child .pill').textContent,
    pressed: document.querySelector('.case:first-child .thumb[data-label="What’s On"]').getAttribute('aria-pressed'),
    otherPill: document.querySelector('.case:last-child .pill').textContent,
  }));
  assert.match(after.src, /foa-whatson-desk-dark\.webp$/, 'main screenshot swaps to the chosen page');
  assert.match(after.mobSrc, /foa-whatson-mob-dark\.webp$/, 'mobile variant swaps too');
  assert.equal(after.pill, 'What’s On', 'pill follows the choice');
  assert.equal(after.pressed, 'true', 'chosen thumbnail is pressed');
  assert.equal(after.otherPill, 'Homepage', 'the other card is untouched');
  await shot(page, 'browser-showcase-thumb-pick', testInfo.project.name);
});

test('showcase: mobile page choices are readable, keyboard-accessible and independent', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await settle(page);
  const first = '.case:first-child';
  const buttons = page.locator(`${first} .thumb`);
  assert.equal(await buttons.count(), 4);
  for (const [index, expected] of [[2, 'whatson'], [1, 'fireworks'], [3, 'menu'], [0, 'fundraising']]) {
    await buttons.nth(index).focus();
    await page.keyboard.press(index === 2 ? 'Space' : 'Enter');
    await page.waitForFunction((name) => document.querySelector('.case:first-child .shot-mob').currentSrc.includes(`foa-${name}-mob`), expected);
    const state = await page.evaluate(() => ({
      pressed: [...document.querySelectorAll('.case:first-child .thumb')].map((b) => b.getAttribute('aria-pressed')),
      other: document.querySelector('.case:last-child .shot-mob').currentSrc,
    }));
    assert.deepEqual(state.pressed, [0, 1, 2, 3].map((j) => String(j === index)));
    assert.match(state.other, /sam-home-mob-dark(?:-\d+w)?\.webp$/, 'choosing a page does not change the other project');
  }
  await shot(page, 'browser-showcase-mobile-choices', testInfo.project.name);
});

test('showcase: composed overviews have a single readable set of controls at every width', async ({ page }) => {
  for (const width of [1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const state = await page.evaluate(() => ({
      shots: [...document.querySelectorAll('.shot-img')].filter((el) => el.offsetParent !== null).length,
      sizes: [...document.querySelectorAll('.thumb')].filter(el => !el.hidden).map((el) => ({ height: el.getBoundingClientRect().height, font: parseFloat(getComputedStyle(el.querySelector('span')).fontSize) })),
      duplicateControls: document.querySelectorAll('.m-step, .zoom-cue, .thumb img').length,
    }));
    // One capture per viewport (Nick, 27 October 2026): the capture matching
    // the visitor's own device shows alone at every width.
    assert.equal(state.shots, 2, `only the capture matching the visitor's device is visible at ${width}px`);
    assert.equal(state.duplicateControls, 0, 'no competing arrows, thumbnail images or enlargement affordance');
    assert.equal(state.sizes.length, width <= 960 ? 8 : 7);
    for (const size of state.sizes) {
      assert.ok(size.height >= 44, `44px touch target at ${width}px`);
      assert.ok(size.font >= 12, `readable label at ${width}px`);
    }
  }
});

// Exploration (Nick, 27 October 2026, separate branch): show the capture
// matching the visitor's own device. On mobile widths the phone capture stands
// alone, large and readable; desktop widths show the framed desktop capture
// alone - no overlay, nothing stacked.
test('showcase: on desktop widths the framed desktop capture stands alone', async ({ page, isMobile }) => {
  desktopOnly(isMobile);
  for (const width of [1440, 1280, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await settle(page);
    for (const caseSel of ['.case:first-child', '.case:last-child']) {
      const g = await page.evaluate((cs) => {
        const rectOf = (sel) => {
          const r = document.querySelector(`${cs} ${sel}`).getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, width: r.width };
        };
        const visible = (sel) => document.querySelector(`${cs} ${sel}`).offsetParent !== null;
        const cardStyle = getComputedStyle(document.querySelector(`${cs} .shot`));
        return { card: rectOf('.shot'), bar: rectOf('.shotbar'), desk: rectOf('.shot-desk'),
                 borderTop: parseFloat(cardStyle.borderTopWidth), borderBottom: parseFloat(cardStyle.borderBottomWidth),
                 barVisible: visible('.shotbar'), deskVisible: visible('.shot-desk'), mobVisible: visible('.shot-mob') };
      }, caseSel);
      assert.ok(g.barVisible && g.deskVisible, `${caseSel} framed desktop capture shows at ${width}px`);
      assert.ok(!g.mobVisible, `${caseSel} phone capture does not overlay at ${width}px`);
      // Compare against the card's content box: its border ring is not layout slack.
      assert.ok(Math.abs(g.bar.top - (g.card.top + g.borderTop)) <= 1, `${caseSel} address bar caps the card at ${width}px`);
      assert.ok(Math.abs(g.desk.top - g.bar.bottom) <= 1, `${caseSel} desktop capture sits directly under its bar at ${width}px`);
      assert.ok(Math.abs(g.desk.bottom - (g.card.bottom - g.borderBottom)) <= 1, `${caseSel} desktop capture fills the card to its foot at ${width}px`);
      assert.ok(g.desk.width >= 400, `${caseSel} desktop capture is large enough to read at ${width}px (${Math.round(g.desk.width)}px)`);
    }
  }
});

test('showcase: on mobile widths the phone capture stands alone, large and readable', async ({ page }) => {
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await settle(page);
    for (const caseSel of ['.case:first-child', '.case:last-child']) {
      const g = await page.evaluate((cs) => {
        const rectOf = (sel) => {
          const r = document.querySelector(`${cs} ${sel}`).getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width, height: r.height };
        };
        const visible = (sel) => document.querySelector(`${cs} ${sel}`).offsetParent !== null;
        const mobStyle = getComputedStyle(document.querySelector(`${cs} .shot-mob`));
        return { card: rectOf('.shot'), mob: rectOf('.shot-mob'),
                 barVisible: visible('.shotbar'), deskVisible: visible('.shot-desk'), mobVisible: visible('.shot-mob'),
                 mobPosition: mobStyle.position, mobDisplay: mobStyle.display, mobRadius: parseFloat(mobStyle.borderTopLeftRadius),
                 mobHasBezel: mobStyle.outlineStyle === 'solid' && mobStyle.outlineWidth === '3px',
                 cropFit: mobStyle.objectFit, cropPosition: mobStyle.objectPosition,
                 outerBorder: getComputedStyle(document.querySelector(`${cs} .shot`)).borderTopWidth,
                 outerBackground: getComputedStyle(document.querySelector(`${cs} .shot`)).backgroundColor,
                 hScroll: document.documentElement.scrollWidth > window.innerWidth + 1 };
      }, caseSel);
      assert.ok(!g.barVisible && !g.deskVisible, `${caseSel} desktop unit is not shown at ${width}px`);
      assert.ok(g.mobVisible, `${caseSel} phone capture is shown at ${width}px`);
      assert.equal(g.mobPosition, 'static', `${caseSel} phone capture stands in the flow at ${width}px`);
      assert.equal(g.mobDisplay, 'block', `${caseSel} phone capture is a centered block at ${width}px`);
      assert.ok(g.mob.width >= 220, `${caseSel} phone capture is wide enough to read at ${width}px (${Math.round(g.mob.width)}px)`);
      const spare = g.card.width - g.mob.width;
      assert.ok(Math.abs(g.mob.left - g.card.left - spare / 2) <= 2, `${caseSel} phone capture is centered at ${width}px`);
      assert.ok(g.mobRadius >= 10 && g.mobHasBezel, `${caseSel} phone capture keeps its device frame at ${width}px`);
      assert.equal(g.outerBorder, '0px', 'solo phone has no redundant outer border');
      assert.equal(g.outerBackground, 'rgba(0, 0, 0, 0)', 'solo phone has no outer panel background');
      assert.equal(g.cropFit, 'cover', 'phone crop never distorts the capture');
      assert.equal(g.cropPosition, '50% 0%', 'phone crop preserves the top of the page');
      assert.ok(Math.abs(g.mob.height / g.mob.width - 1.8) < .02, 'phone is a taller 5:9 crop');
      assert.ok(!g.hScroll, `no horizontal scroll at ${width}px`);
    }
  }
});

// Regression (27 October 2026, bff2b598): an author display rule on a noscript
// element overrides the browser's scripting-enabled display:none, so the
// fallback's raw markup leaked onto the page as text. With JavaScript enabled
// the noscript fallbacks must never render, as boxes or as text.
test('showcase: with JavaScript the noscript fallbacks never render as text', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await settle(page);
    const bad = await page.evaluate(() => ({
      visibleBox: [...document.querySelectorAll('.shot noscript')].some((n) => n.getClientRects().length > 0),
      rawText: document.body.innerText.includes('shot-img') || document.body.innerText.includes('<img'),
    }));
    assert.ok(!bad.visibleBox, `no noscript box renders at ${width}px`);
    assert.ok(!bad.rawText, `no raw image markup shows as text at ${width}px`);
  }
});

test('showcase: mobile activation preserves the reserved phone block', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/assets/js/showcase.js', async (route) => { await gate; await route.continue(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.querySelectorAll('.case:first-child .shot-template').length === 2);
  await page.waitForFunction(() => {
    const t = [...document.querySelectorAll('.case:first-child .shot-template')];
    return t[0].getBoundingClientRect().height === 0 && t[1].getBoundingClientRect().height > 200;
  });
  const box = () => page.locator('.case:first-child .shot').boundingBox();
  const before = await box();
  release();
  await page.waitForFunction(() => document.querySelectorAll('.shot-img').length === 4);
  const after = await box();
  assert.ok(Math.abs(after.height - before.height) < 1, `showcase card height preserved on activation (before ${before.height}, after ${after.height})`);
  assert.ok(Math.abs(after.y - before.y) < 1, 'showcase card position preserved on activation');
});

// Nick's rule (24 October 2026): a CTA symbol must never wrap away from the end
// of its label. Check every visible CTA with a symbol, narrow widths and enlarged text.
// Regression coverage for the paired screenshot swap (the composed card shows
// both shots, so a staggered change is visible): the desktop and mobile shots
// must change together, rapid choices must settle on the latest, and a failed
// image must not block the pair. Artificial per-image latency forces the
// windows open; assertions are on observable behaviour, not timing internals.
const pageOf = (file) => (file.match(/foa-(home|fireworks|whatson|fundraising)-/) || [])[1] || '';
const shotPair = (page) => page.evaluate(() => ({
  desk: document.querySelector('.case:first-child .shot-desk').currentSrc.split('/').pop().replace(/^(?:\d+-)+/, '').replace(/-\d+w(?=\.webp$)/, ''),
  mob: document.querySelector('.case:first-child .shot-mob').currentSrc.split('/').pop().replace(/^(?:\d+-)+/, '').replace(/-\d+w(?=\.webp$)/, ''),
}));
const initialPairLoaded = () => {
  const d = document.querySelector('.case:first-child .shot-desk');
  const m = document.querySelector('.case:first-child .shot-mob');
  return d && m && d.complete && d.naturalWidth > 0 && m.complete && m.naturalWidth > 0;
};

test('showcase: screenshot pair swaps atomically under uneven image latency', async ({ page }) => {
  await page.route('**/assets/images/work/*-desk*.webp', async (route) => { await new Promise((r) => setTimeout(r, 700)); await route.continue(); });
  await page.route('**/assets/images/work/*-mob*.webp', async (route) => { await new Promise((r) => setTimeout(r, 100)); await route.continue(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(initialPairLoaded);
  await page.click('.case:first-child .thumb[data-label="What’s On"]');
  const mismatches = [];
  for (let i = 0; i < 12; i++) {
    const pair = await shotPair(page);
    if (pageOf(pair.desk) !== pageOf(pair.mob)) mismatches.push(`${pair.desk} vs ${pair.mob}`);
    await page.waitForTimeout(80);
  }
  assert.deepEqual(mismatches, [], `pair changed at different times: ${mismatches.join('; ')}`);
  const finalPair = await shotPair(page);
  assert.equal(pageOf(finalPair.desk), 'whatson', 'desktop shot settled on the chosen page');
  assert.equal(pageOf(finalPair.mob), 'whatson', 'mobile shot settled on the chosen page');
});

test('showcase: rapid thumbnail changes settle on the latest choice', async ({ page }) => {
  await page.route('**/assets/images/work/*.webp', async (route) => { await new Promise((r) => setTimeout(r, 450)); await route.continue(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(initialPairLoaded);
  await page.click('.case:first-child .thumb[data-label="What’s On"]');
  await page.waitForTimeout(120);
  await page.click('.case:first-child .thumb[data-label="Fireworks"]');
  await page.waitForFunction(() => {
    const d = document.querySelector('.case:first-child .shot-desk');
    const m = document.querySelector('.case:first-child .shot-mob');
    return d.currentSrc.includes('fireworks-desk') && m.currentSrc.includes('fireworks-mob');
  }, { timeout: 8000 });
  const state = await page.evaluate(() => ({
    pill: document.querySelector('.case:first-child .pill').textContent,
    selected: document.querySelector('.case:first-child .thumb.sel').textContent.trim(),
  }));
  assert.equal(state.pill, 'Fireworks', 'pill follows the latest choice');
  assert.equal(state.selected, 'Fireworks', 'selected label follows the latest choice');
});

test('showcase: a failed screenshot preserves the displayed pair and allows retry', async ({ page }) => {
  let fail = true;
  await page.route('**/assets/images/work/*foa-fireworks-desk-dark*.webp', (route) => fail ? route.fulfill({ status: 404, body: '' }) : route.continue());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(initialPairLoaded);
  const before = await shotPair(page);
  const failedResponse = page.waitForResponse((response) => response.url().includes('fireworks-desk-dark') && response.status() === 404);
  await page.evaluate(() => {
    window.failedShowcaseSwap = new Promise((resolve) => {
      document.querySelector('.case:first-child').addEventListener('showcase:swap-failed', resolve, { once: true });
    });
  });
  await page.click('.case:first-child .thumb[data-label="Fireworks"]');
  await failedResponse;
  await page.evaluate(() => window.failedShowcaseSwap);
  assert.deepEqual(await shotPair(page), before, 'a failed replacement cannot discard either working screenshot');
  assert.equal(await page.locator('.case:first-child .pill-label').textContent(), 'Fundraising');
  assert.equal(await page.locator('.case:first-child .thumb.sel').textContent(), 'Fundraising');
  // After a failed swap the displayed pair stays the theme-swap target (the
  // brief: keep the working pair and its selected label): a theme change
  // re-themes the working pair rather than retrying the failed tab.
  await page.evaluate(() => { document.body.dataset.theme = 'light'; });
  await page.waitForFunction(() => {
    const src = document.querySelector('.case:first-child .shot-mob').currentSrc;
    return src.includes('foa-fundraising-mob') && !src.includes('-dark');
  });
  assert.equal(await page.locator('.case:first-child .pill-label').textContent(), 'Fundraising');
  fail = false;
  await page.click('.case:first-child .thumb[data-label="Fireworks"]');
  await page.waitForFunction(() => document.querySelector('.case:first-child .shot-mob').currentSrc.includes('fireworks-mob'));
  const state = await page.evaluate(() => ({
    // src, not currentSrc: the swap commits both src attributes atomically, but
    // Firefox only updates currentSrc for a failed image after the 404 settles,
    // which can lag the successful mobile shot and made this assertion flaky.
    deskSrc: document.querySelector('.case:first-child .shot-desk').src,
    deskAlt: document.querySelector('.case:first-child .shot-desk').alt,
    pill: document.querySelector('.case:first-child .pill').textContent,
  }));
  assert.ok(state.deskSrc.includes('fireworks-desk'), 'retry commits the working replacement');
  assert.match(state.deskAlt, /Fireworks/);
  assert.equal(state.pill, 'Fireworks');
});

test('showcase: screenshots follow the page light/dark theme', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await settle(page);
  const read = () => page.evaluate(() => {
    const first = document.querySelector('.case:first-child');
    const last = document.querySelector('.case:last-child');
    return {
      theme: document.body.dataset.theme,
      foaDesk: first.querySelector('.shot-desk').currentSrc.split('/').pop().replace(/^(?:\d+-)+/, '').replace(/-\d+w(?=\.webp$)/, ''),
      foaMob: first.querySelector('.shot-mob').currentSrc.split('/').pop().replace(/^(?:\d+-)+/, '').replace(/-\d+w(?=\.webp$)/, ''),
      foaSelected: first.querySelector('.thumb.sel').textContent.trim(),
      samDesk: last.querySelector('.shot-desk').currentSrc.split('/').pop().replace(/^(?:\d+-)+/, '').replace(/-\d+w(?=\.webp$)/, ''),
    };
  });
  const dark0 = await read();
  assert.equal(dark0.theme, 'dark', 'page opens dark by default');
  assert.equal(dark0.foaDesk, 'foa-fundraising-desk-dark.webp', 'FOA shows its dark capture in dark mode');
  assert.equal(dark0.foaMob, 'foa-fundraising-mob-dark.webp', 'mobile shot follows too');
  assert.equal(dark0.foaSelected, 'Fundraising', 'page choice is labelled');
  assert.equal(dark0.samDesk, 'sam-home-desk-dark.webp', 'Sam shows its dark capture in dark mode too');
  await page.locator('button.theme-toggle').first().click();
  await page.waitForTimeout(300);
  const light = await read();
  assert.equal(light.theme, 'light');
  assert.equal(light.foaDesk, 'foa-fundraising-desk.webp', 'FOA swaps to its light capture in light mode');
  assert.equal(light.foaMob, 'foa-fundraising-mob.webp');
  assert.equal(light.foaSelected, 'Fundraising', 'theme changes preserve the selected page');
  assert.equal(light.samDesk, 'sam-home-desk.webp', 'Sam swaps to its light capture in light mode');
  await page.locator('button.theme-toggle').first().click();
  await page.waitForTimeout(300);
  const dark1 = await read();
  assert.equal(dark1.foaDesk, 'foa-fundraising-desk-dark.webp', 'toggling back restores the dark captures');
  assert.equal(dark1.samDesk, 'sam-home-desk-dark.webp', 'Sam dark captures return too');

  await page.locator('.case:first-child .thumb[data-label="What’s On"]').click();
  const waitForSelectedPair = (suffix) => page.waitForFunction((ending) => {
    const first = document.querySelector('.case:first-child');
    return first.querySelector('.shot-desk').currentSrc.replace(/-\d+w(?=\.webp$)/, '').endsWith(`foa-whatson-desk${ending}.webp`)
      && first.querySelector('.shot-mob').currentSrc.replace(/-\d+w(?=\.webp$)/, '').endsWith(`foa-whatson-mob${ending}.webp`)
      && document.querySelector('.case:last-child .shot-desk').currentSrc.replace(/-\d+w(?=\.webp$)/, '').endsWith(`sam-home-desk${ending}.webp`);
  }, suffix);
  await waitForSelectedPair('-dark');

  for (const [theme, suffix] of [['light', ''], ['dark', '-dark']]) {
    await page.locator('.theme-toggle').click();
    await waitForSelectedPair(suffix);
    const selected = await read();
    assert.equal(selected.theme, theme);
    assert.equal(selected.foaDesk, `foa-whatson-desk${suffix}.webp`, `selected desktop capture follows ${theme} mode`);
    assert.equal(selected.foaMob, `foa-whatson-mob${suffix}.webp`, `selected mobile capture follows ${theme} mode`);
    assert.equal(selected.foaSelected, 'What’s On', 'theme changes preserve the selected page');
    assert.equal(await page.locator('.case:first-child .pill-label').textContent(), 'What’s On', 'displayed page label is preserved too');
    assert.equal(selected.samDesk, `sam-home-desk${suffix}.webp`, 'the other project keeps its own page selection');
  }
});

test('CTA symbols stay with the end of their label at narrow widths and enlarged text', async ({ page }, testInfo) => {
  const probe = () => {
    const bad = [];
    for (const el of document.querySelectorAll('.intro-contact, .hero-actions .button, .nav-contact, .case-copy .button, .contact-form button[type=submit], .github-link, .footer-cta')) {
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

test('showcase: Fundraising leads and Menu is a labelled phone-only last choice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/'); await settle(page);
  const first = page.locator('.case').first();
  assert.deepEqual(await first.locator('.thumb:visible').allTextContents(), ['Fundraising', 'Fireworks', 'What’s On', 'Menu']);
  await expect(first.locator('.shot-mob')).toHaveAttribute('alt', /Fundraising/);
  const menu = first.getByRole('button', { name: 'Menu', exact: true });
  await menu.focus(); await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-pressed', 'true');
  await expect(first.locator('.shot-mob')).toHaveAttribute('alt', /open navigation menu/);
  assert.ok((await first.locator('.shot-mob').getAttribute('src')).includes('foa-menu-mob'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(menu).toBeHidden();
  await expect(first.locator('.thumb').first()).toHaveAttribute('aria-pressed', 'true');
  assert.deepEqual(await first.locator('.thumb:visible').allTextContents(), ['Fundraising', 'Fireworks', 'What’s On']);
  await expect(first.locator('.shot-desk')).toHaveAttribute('alt', /Fundraising/);
  await page.evaluate(() => { document.body.dataset.mobile = 'true'; });
  await expect(menu).toBeVisible(); await menu.click();
  await expect(menu).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { document.body.dataset.mobile = 'false'; });
  await expect(menu).toBeHidden();
  await expect(first.locator('.thumb').first()).toHaveAttribute('aria-pressed', 'true');
  assert.equal(await first.locator('.thumb[aria-pressed="true"]').count(), 1);
});


test('showcase: hiding a focused unselected Menu preserves keyboard position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/'); await settle(page);
  const first = page.locator('.case').first();
  const menu = first.getByRole('button', { name: 'Menu', exact: true });
  const fundraising = first.getByRole('button', { name: 'Fundraising', exact: true });
  await menu.focus();
  await expect(menu).toHaveAttribute('aria-pressed', 'false');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(menu).toBeHidden(); await expect(fundraising).toBeFocused();
  await page.evaluate(() => { document.body.dataset.mobile = 'true'; });
  await menu.focus();
  await page.evaluate(() => { document.body.dataset.mobile = 'false'; });
  await expect(menu).toBeHidden(); await expect(fundraising).toBeFocused();
  await page.evaluate(() => { document.body.dataset.mobile = 'true'; });
  await menu.click(); await expect(menu).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { document.body.dataset.mobile = 'false'; });
  await expect(menu).toBeHidden(); await expect(fundraising).toBeFocused();
  await expect(fundraising).toHaveAttribute('aria-pressed', 'true');
});

test('showcase: failed Menu desktop fallback keeps a visible selection and restores phone state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/'); await settle(page);
  const first = page.locator('.case').first();
  const menu = first.getByRole('button', { name: 'Menu', exact: true });
  const homepage = first.getByRole('button', { name: 'Fundraising', exact: true });
  await menu.click(); await expect(menu).toHaveAttribute('aria-pressed', 'true');
  const pair = await shotPair(page);
  // Reject decode even if an engine reuses the initially decoded image
  // without another network request (notably Firefox's memory image cache).
  await page.evaluate(() => {
    const NativeImage = window.Image;
    window.Image = class extends NativeImage {
      decode() { return this.src.includes('fundraising') ? Promise.reject(new Error('test decode failure')) : super.decode(); }
    };
  });
  await page.evaluate(() => { window.fallbackFailed = new Promise(resolve => document.querySelector('.case').addEventListener('showcase:swap-failed', resolve, {once:true})); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.fallbackFailed);
  await expect(menu).toBeHidden();
  await expect(homepage).toHaveAttribute('aria-pressed', 'true');
  await expect(first.locator('.pill-label')).toHaveText('Fundraising');
  assert.deepEqual(await shotPair(page), pair, 'working captures survive the failed fallback');
  assert.equal(await first.locator('.shot-desk').getAttribute('src'), await homepage.getAttribute('data-src-desk-dark'), 'selected label matches the displayed desktop asset');
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(menu).toHaveAttribute('aria-pressed', 'true');
  await expect(first.locator('.pill-label')).toHaveText('Menu');
  await expect(first.locator('.shot-mob')).toHaveAttribute('src', /foa-menu-mob/);
});

test('showcase: failed Menu preview-toggle fallback keeps a visible selection and restores phone state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/'); await settle(page);
  await page.evaluate(() => { document.body.dataset.mobile = 'true'; });
  await expect(page.locator('.case').first().getByRole('button', {name:'Menu',exact:true})).toBeVisible();
  const first = page.locator('.case').first();
  const menu = first.getByRole('button', { name: 'Menu', exact: true });
  const homepage = first.getByRole('button', { name: 'Fundraising', exact: true });
  await menu.click(); await expect(menu).toHaveAttribute('aria-pressed', 'true');
  const pair = await shotPair(page);
  // Reject decode even if an engine reuses the initially decoded image
  // without another network request (notably Firefox's memory image cache).
  await page.evaluate(() => {
    const NativeImage = window.Image;
    window.Image = class extends NativeImage {
      decode() { return this.src.includes('fundraising') ? Promise.reject(new Error('test decode failure')) : super.decode(); }
    };
  });
  await page.evaluate(() => { window.fallbackFailed = new Promise(resolve => document.querySelector('.case').addEventListener('showcase:swap-failed', resolve, {once:true})); });
  await page.evaluate(() => { document.body.dataset.mobile = 'false'; });
  await page.evaluate(() => window.fallbackFailed);
  await expect(menu).toBeHidden();
  await expect(homepage).toHaveAttribute('aria-pressed', 'true');
  await expect(first.locator('.pill-label')).toHaveText('Fundraising');
  assert.deepEqual(await shotPair(page), pair, 'working captures survive the failed fallback');
  assert.equal(await first.locator('.shot-desk').getAttribute('src'), await homepage.getAttribute('data-src-desk-dark'), 'selected label matches the displayed desktop asset');
  await page.evaluate(() => { document.body.dataset.mobile = 'true'; });
  await expect(menu).toHaveAttribute('aria-pressed', 'true');
  await expect(first.locator('.pill-label')).toHaveText('Menu');
  await expect(first.locator('.shot-mob')).toHaveAttribute('src', /foa-menu-mob/);
});

test('showcase: retained Menu desktop capture stays selected after theme and fallback failures', async ({ page }) => {
  await page.setViewportSize({width:390,height:900});
  await page.goto('/'); await settle(page);
  const first = page.locator('.case').first();
  const menu = first.getByRole('button',{name:'Menu',exact:true});
  const home = first.getByRole('button',{name:'Fundraising',exact:true});
  await menu.click(); await expect(menu).toHaveAttribute('aria-pressed','true');
  const retained = await shotPair(page);
  await page.evaluate(() => {
    const NativeImage = Image;
    window.Image = class extends NativeImage { decode() { return Promise.reject(new Error('test all replacements fail')); } };
    window.themeFailed = new Promise(resolve => document.querySelector('.case').addEventListener('showcase:swap-failed',resolve,{once:true}));
    document.body.dataset.theme = 'light';
  });
  await page.evaluate(() => window.themeFailed);
  await page.evaluate(() => { window.fallbackFailed = new Promise(resolve => document.querySelector('.case').addEventListener('showcase:swap-failed',resolve,{once:true})); });
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(() => window.fallbackFailed);
  await expect(menu).toBeHidden(); await expect(home).toHaveAttribute('aria-pressed','true');
  await expect(first.locator('.pill-label')).toHaveText('Fundraising');
  expect(await shotPair(page)).toEqual(retained);
  expect(await first.locator('.shot-desk').getAttribute('src')).toBe(await home.getAttribute('data-src-desk-dark'));
  await page.setViewportSize({width:390,height:900});
  await expect(menu).toHaveAttribute('aria-pressed','true');
  await expect(first.locator('.pill-label')).toHaveText('Menu');
  await expect(first.locator('.shot-mob')).toHaveAttribute('src', /foa-menu-mob/);
});

test('wide Work canvas preserves dedicated device previews', async ({page,isMobile}) => {
  test.skip(isMobile,'desktop canvas');
  for(const width of [1280,1440,1920]) {
    await page.setViewportSize({width,height:1000}); await page.goto('/'); await settle(page);
    const cases=await page.locator('.case').evaluateAll(cs=>cs.map(c=>({shot:c.querySelector('.case-shot').getBoundingClientRect().width,copy:c.querySelector('.case-copy').getBoundingClientRect().width,visible:[...c.querySelectorAll('.shot-img')].filter(e=>e.offsetParent!==null).map(e=>e.className)})));
    for(const c of cases){expect(c.shot/c.copy).toBeCloseTo(1.5,1);expect(c.visible).toEqual(['shot-img shot-desk']);expect(c.shot).toBeGreaterThan(650);expect(c.shot).toBeLessThan(850)}
    expect(Math.abs(cases[0].shot-cases[1].shot)).toBeLessThan(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test('phone frame paints all four edges without changing capture geometry', async ({browser,baseURL}) => {
  for(const [width,preview] of [[390,false],[768,false],[1440,true]]) {
    const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:1});
    const page=await context.newPage();
    await page.addInitScript(()=>localStorage.setItem('websites-by-nick-cookie-preferences','essential'));
    await page.goto(baseURL);
    if(preview)await page.evaluate(()=>document.body.dataset.mobile='true');
    for(const image of await page.locator('.shot-mob').all()) {
      await image.evaluate(i=>i.decode());
      await image.scrollIntoViewIfNeeded();
      const geometry=()=>image.evaluate(i=>{const r=i.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}});
      const before=await geometry();
      const screenshot=await image.screenshot({animations:'disabled'});
      const edges=await page.evaluate(async data=>{
        const i=new Image();i.src='data:image/png;base64,'+data;await i.decode();
        const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);
        return [[1,i.height/2],[i.width-2,i.height/2],[i.width/2,1],[i.width/2,i.height-2]].map(([a,b])=>Array.from(x.getImageData(Math.floor(a),Math.floor(b),1,1).data));
      },screenshot.toString('base64'));
      for(const edge of edges)assert.deepEqual(edge,[11,13,16,255],`actual painted frame ${width}px preview=${preview}`);
      await image.evaluate(i=>i.style.outline='none');
      assert.deepEqual(await geometry(),before,'frame must not change capture geometry');
    }
    await context.close();
  }
});
