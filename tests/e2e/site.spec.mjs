// Browser checks for index.html across Chromium, Firefox, WebKit and mobile Chrome.
// Replaces the earlier Chrome-only CDP harness (removed in this change) with the
// Playwright matrix used by Nick's other sites; every check from that harness is
// ported here and now runs per browser engine.
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
  const text = getComputedStyle(document.querySelector('.hero p, main p')).color;
  const a = lum(bg); const b = lum(text);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// The site settles its theme colours over a 0.45s transition; always wait past it
// before reading computed colours or screenshots.
const settle = (page) => page.waitForTimeout(1100);

// Desktop checks run at 1440x900: the site switches itself into mobile preview at
// viewports of 1280px and below, so Playwright's 1280x720 default would not
// exercise the desktop layout.
const DESKTOP = { width: 1440, height: 900 };

// Known-defect tracking: each check below asserts the DESIRED state. While the
// defect is present on a browser the check is marked test.fail for that project,
// so Playwright reports it as an expected failure, counted separately from
// genuinely passing checks, and never re-labelled a pass. If the defect stops
// reproducing the unexpected pass fails the run loudly so this record is updated.
// The project lists were measured against real runs, not assumed.
const KNOWN_DEFECTS = {
  overlap320: {
    reason: 'pre-existing layout defect on main: the headline text overflows its grid box into the portrait; fix pending product decision',
    projects: ['chromium', 'firefox', 'webkit', 'mobile-chrome'],
  },
  lightMutedContrast: {
    reason: 'pre-existing design defect on main: muted text measures about 3.9:1 on the light theme; fix pending design decision',
    projects: ['chromium', 'firefox', 'webkit', 'mobile-chrome'],
  },
};

function trackKnownDefect(testInfo, defect) {
  const known = defect.projects.includes(testInfo.project.name);
  test.fail(known, `KNOWN DEFECT: ${defect.reason}`);
  if (known) testInfo.annotations.push({ type: 'known-defect', description: defect.reason });
}

const desktopOnly = (isMobile) => test.skip(isMobile, 'desktop chrome and keyboard check');

test('desktop light: one visible h1, toggle defaults to light mode', async ({ page, isMobile }, testInfo) => {
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
  assert.equal(state.theme, 'light');
  assert.equal(state.pressed, 'false');
  assert.equal(state.label, 'Switch to dark mode');
  assert.equal(state.hasMobileToggle, true, 'mobile preview toggle present on a local host');
  const headlineContrast = await page.evaluate(() => {
    const lum = (rgb) => {
      const c = rgb.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map((v) => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const bg = lum(getComputedStyle(document.body).backgroundColor);
    const fg = lum(getComputedStyle(document.querySelector('.hero h1')).color);
    return (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
  });
  assert.ok(headlineContrast >= 4.5, `light theme headline contrast ${headlineContrast.toFixed(2)}:1 meets 4.5:1`);
  await settle(page);
  await shot(page, 'browser-desktop-light', testInfo.project.name);
});

test('dark system preference: page opens dark and the toggle shows it', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  // the theme transition also runs on first paint when the system prefers dark
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

test('theme toggle: click switches to dark, reload restores it', async ({ page, isMobile }, testInfo) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.locator('.theme-toggle').click();
  const after1 = await page.evaluate(() => ({ theme: document.body.dataset.theme, stored: localStorage.getItem('nick-theme') }));
  assert.equal(after1.theme, 'dark');
  assert.equal(after1.stored, 'dark');
  // settle past the 0.45s transition, then verify the rendered colours, not just attributes
  await settle(page);
  const renderedBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const renderedContrast = await page.evaluate(heroTextContrast);
  assert.equal(renderedBg, 'rgb(24, 33, 29)', 'dark background is actually painted');
  assert.ok(renderedContrast >= 4.5, `dark body text contrast ${renderedContrast.toFixed(2)}:1 meets 4.5:1`);
  await shot(page, 'browser-desktop-dark-toggled', testInfo.project.name);
  await page.reload();
  await settle(page);
  const after2 = await page.evaluate(() => document.body.dataset.theme);
  assert.equal(after2, 'dark', 'stored choice survives a reload');
});

test('keyboard: full page tab order reaches nav, toggles, hero actions and form', async ({ page, isMobile }) => {
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
  for (const expected of ['wordmark', 'theme-toggle', 'mobile-toggle', 'button-primary', 'contact-name', 'contact-email', 'contact-message']) {
    assert.ok(joined.includes(expected), `tab order reaches ${expected} (saw: ${joined.slice(0, 200)})`);
  }
});

test('keyboard: Enter on a nav anchor navigates, Enter and Space toggle the theme', async ({ page, isMobile }) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.locator('a[href="#experience"]').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => location.hash), '#experience', 'Enter on a nav anchor navigates');

  await page.locator('.theme-toggle').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'dark', 'Enter on the focused toggle switches the theme');

  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'light', 'Space on the focused toggle switches back');
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
  await page.goto('/');
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

test('mobile 390px: one visible h1 and no horizontal scrolling', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const state = await page.evaluate(() => ({
    visibleH1: [...document.querySelectorAll('h1')].filter((h) => h.offsetParent !== null).length,
    mobileMode: document.body.dataset.mobile,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert.equal(state.visibleH1, 1, 'exactly one h1 is rendered');
  assert.equal(state.mobileMode, 'true', 'mobile layout active at 390px');
  assert.ok(state.overflow <= 1, `no horizontal scroll (overflow ${state.overflow}px)`);
  await settle(page);
  await shot(page, 'browser-mobile-390', testInfo.project.name);
});

test('200% text at a laptop viewport: no horizontal scrolling', async ({ page }, testInfo) => {
  // 200% browser zoom at 1440px leaves a 720px CSS viewport.
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `no horizontal scroll at 720px effective width (overflow ${overflow}px)`);
  await settle(page);
  await shot(page, 'browser-zoom-720', testInfo.project.name);
});

test('320px hero headline does not overlap the portrait', async ({ page }, testInfo) => {
  trackKnownDefect(testInfo, KNOWN_DEFECTS.overlap320);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  // the headline's painted text overflows its grid box, so measure the text
  // geometry (Range), not the element's bounding box
  const { overlap, detail } = await page.evaluate(() => {
    const hero = document.querySelector('.mobile-hero');
    const h1 = hero.querySelector('h1');
    const range = document.createRange();
    range.selectNodeContents(h1);
    const text = range.getBoundingClientRect();
    const img = hero.querySelector('img.portrait').getBoundingClientRect();
    const overlap = !(text.right <= img.left || img.right <= text.left || text.bottom <= img.top || img.bottom <= text.top);
    return { overlap, detail: { text: [Math.round(text.left), Math.round(text.right)], img: [Math.round(img.left), Math.round(img.right)] } };
  });
  await settle(page);
  await shot(page, 'browser-320-headline-portrait', testInfo.project.name);
  assert.equal(overlap, false, `headline text overlaps the portrait at 320px: ${JSON.stringify(detail)}`);
});

test('light-theme muted body text has at least 4.5:1 contrast', async ({ page }, testInfo) => {
  trackKnownDefect(testInfo, KNOWN_DEFECTS.lightMutedContrast);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  const contrast = await page.evaluate(heroTextContrast);
  assert.ok(contrast >= 4.5, `muted body text contrast ${contrast.toFixed(2)}:1 is below 4.5:1`);
});

test('contact form: empty form is invalid, completed form is valid', async ({ page }) => {
  await page.goto('/');
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

test('navigation: in-page anchors move to their sections', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { document.querySelector('a[href="#experience"]').click(); });
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => ({ hash: location.hash, scrolled: window.scrollY > 0 }));
  assert.equal(state.hash, '#experience');
  assert.ok(state.scrolled, 'page scrolled to the section');
});
