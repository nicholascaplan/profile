import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const source = readFileSync('assets/js/analytics.js', 'utf8');
const pages = ['/', '/experience/', '/contact/', '/privacy/'];

for (const path of pages) {
  test(`consent defaults off, rejects and persists on ${path}`, async ({ page }) => {
    const requests = [];
    page.on('request', req => { if (/google-analytics|googletagmanager/.test(req.url())) requests.push(req.url()); });
    await page.goto(path);
    await expect(page.locator('[data-cookie-choice="essential"]')).toBeVisible();
    expect(requests).toEqual([]);
    await page.locator('[data-cookie-choice="essential"]').click();
    await page.reload();
    await expect(page.locator('#cookie-consent-panel')).toBeHidden();
    expect(requests).toEqual([]);
    await expect(page.locator('footer a[href$="privacy/"]')).toBeVisible();
  });
}

test('preview acceptance does not pollute real analytics; preferences reopen and withdraw', async ({ page }) => {
  await page.goto('/privacy/');
  await page.locator('[data-cookie-choice="analytics"]').click();
  await expect(page.locator('[data-google-analytics]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cookie preferences', exact: true }).click();
  await expect(page.locator('[data-cookie-choice="analytics"]')).toBeFocused();
  await page.locator('[data-cookie-choice="essential"]').click();
  await expect(page.getByRole('button', { name: 'Cookie preferences', exact: true })).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('websites-by-nick-cookie-preferences'))).toBe('essential');
});

test('blocked storage still permits an in-page choice', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.getItem = Storage.prototype.setItem = function () { throw Error('blocked'); }; });
  await page.goto('/');
  await page.locator('[data-cookie-choice="analytics"]').click();
  await expect(page.locator('#cookie-consent-panel')).toBeHidden();
});

test('production loader configures only this stream after consent and unloads on withdrawal', async ({ page }) => {
  // Isolated, intercepted production origin: no real Google traffic or page hits.
  await page.route('https://websitesbynick.co.uk/**', async route => {
    if (route.request().url().endsWith('analytics.js')) return route.fulfill({ contentType: 'text/javascript', body: source });
    return route.fulfill({ contentType: 'text/html', body: '<button data-cookie-preferences>Cookie preferences</button><script defer src="/assets/js/analytics.js" data-measurement-id="G-TESTONLY123"></script>' });
  });
  const requests = [];
  await page.route('https://www.googletagmanager.com/**', route => { requests.push(route.request().url()); return route.fulfill({ body: '' }); });
  await page.goto('https://websitesbynick.co.uk/?email=private#secret');
  expect(requests).toHaveLength(0);
  await page.locator('[data-cookie-choice="analytics"]').click();
  await expect.poll(() => requests.length).toBe(1);
  const queue = await page.evaluate(() => window.dataLayer.map(args => Array.from(args)));
  expect(queue[0][2]).toMatchObject({ analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  expect(queue[2]).toEqual(['config', 'G-TESTONLY123', { allow_google_signals: false, allow_ad_personalization_signals: false, page_location: 'https://websitesbynick.co.uk/', page_referrer: '' }]);
  await page.evaluate(() => { document.cookie = '_ga=test; path=/'; document.cookie = '_ga_TESTONLY123=test; path=/'; });
  await page.getByRole('button', { name: 'Cookie preferences', exact: true }).click();
  const reloaded = page.waitForEvent('load');
  await page.locator('[data-cookie-choice="essential"]').click();
  await reloaded;
  await expect(page.locator('#cookie-consent-panel')).toBeHidden();
  expect(await page.evaluate(() => window.dataLayer === undefined && window.gtag === undefined)).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('_ga');
  expect(requests).toHaveLength(1);
  await page.reload();
  expect(requests).toHaveLength(1);
  await page.getByRole('button', { name: 'Cookie preferences', exact: true }).click();
  await page.locator('[data-cookie-choice="analytics"]').click();
  await expect.poll(() => requests.length).toBe(2);
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw Error('writes now blocked'); }; });
  let navigated = false;
  page.on('framenavigated', () => { navigated = true; });
  await page.getByRole('button', { name: 'Cookie preferences', exact: true }).click();
  await page.locator('[data-cookie-choice="essential"]').click();
  expect(await page.evaluate(() => window['ga-disable-G-TESTONLY123'])).toBe(true);
  expect(navigated).toBe(false);
});

test('invalid saved values do not grant consent', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('websites-by-nick-cookie-preferences', 'invalid'));
  await page.goto('/');
  await expect(page.locator('#cookie-consent-panel')).toBeVisible();
  await expect(page.locator('[data-google-analytics]')).toHaveCount(0);
});

for (const theme of ['light', 'dark']) test(`consent contrast and enlarged-text reachability in ${theme}`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(t => localStorage.setItem('nick-theme', t), theme);
  await page.goto('/privacy/');
  const contrast = await page.locator('[data-cookie-choice="analytics"]').evaluate(el => {
    const lum = c => { const rgb = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
    const s = getComputedStyle(el), a = lum(s.color), b = lum(s.backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.evaluate(() => {
    const elements = [...document.querySelectorAll('body *')];
    const sizes = elements.map(el => parseFloat(getComputedStyle(el).fontSize));
    elements.forEach((el, i) => { el.style.fontSize = sizes[i] * 2 + 'px'; });
  });
  const reject = page.locator('[data-cookie-choice="essential"]');
  await reject.scrollIntoViewIfNeeded();
  await expect(reject).toBeVisible();
  const bounds = await reject.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  await reject.click();
  await expect(page.locator('#cookie-consent-panel')).toBeHidden();
});


test('readable but unwritable storage cannot restore a stale Allow', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('websites-by-nick-cookie-preferences', 'analytics');
    Storage.prototype.setItem = function () { throw Error('writes blocked'); };
  });
  await page.goto('/privacy/');
  await expect(page.locator('#cookie-consent-panel')).toBeVisible();
  await expect(page.locator('[data-google-analytics]')).toHaveCount(0);
  await page.locator('[data-cookie-choice="essential"]').click();
  await page.reload();
  await expect(page.locator('#cookie-consent-panel')).toBeVisible();
  await expect(page.locator('[data-google-analytics]')).toHaveCount(0);
});


test('withdrawal in another tab unloads an active tag in this tab', async ({ page, context }) => {
  await context.route('https://websitesbynick.co.uk/**', route => {
    if (route.request().url().endsWith('analytics.js')) return route.fulfill({ contentType: 'text/javascript', body: source });
    return route.fulfill({ contentType: 'text/html', body: '<button data-cookie-preferences>Cookie preferences</button><script defer src="/assets/js/analytics.js" data-measurement-id="G-TESTONLY123"></script>' });
  });
  await context.route('https://www.googletagmanager.com/**', route => route.fulfill({ body: '' }));
  await page.goto('https://websitesbynick.co.uk/');
  await page.locator('[data-cookie-choice="analytics"]').click();
  const other = await context.newPage();
  await other.goto('https://websitesbynick.co.uk/');
  expect(await other.evaluate(() => typeof window.gtag)).toBe('function');
  await page.getByRole('button', { name: 'Cookie preferences', exact: true }).click();
  const unloaded = other.waitForEvent('load');
  await page.locator('[data-cookie-choice="essential"]').click();
  await unloaded;
  expect(await other.evaluate(() => window.gtag === undefined)).toBe(true);
  expect(await other.evaluate(() => localStorage.getItem('websites-by-nick-cookie-preferences'))).toBe('essential');
  await expect(other.locator('[data-google-analytics]')).toHaveCount(0);
  await other.close();
});

for (const theme of ['light', 'dark']) test(`privacy preference label has contrast in every state in ${theme}`, async ({ page }) => {
  await page.addInitScript(t => { localStorage.setItem('nick-theme', t); localStorage.setItem('websites-by-nick-cookie-preferences', 'essential'); }, theme);
  await page.goto('/privacy/');
  const button = page.locator('[data-cookie-preferences]');
  await expect(button).toHaveText('Cookie preferences');
  await button.scrollIntoViewIfNeeded();
  for (const state of ['default', 'hover', 'focus']) {
    if (state === 'hover') await button.hover();
    if (state === 'focus') { await page.mouse.move(0, 0); await button.focus(); }
    // Sample after the existing colour transition finishes.
    await page.waitForTimeout(300);
    const contrast = await button.evaluate(el => {
      const lum = c => { const rgb = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
      const s = getComputedStyle(el), a = lum(s.color), b = lum(s.backgroundColor);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    expect(contrast, state).toBeGreaterThanOrEqual(4.5);
  }
  await button.click();
  await expect(page.locator('#cookie-consent-panel')).toBeVisible();
});

test('mobile consent is compact with both choices immediately visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const panel = await page.locator('#cookie-consent-panel').boundingBox();
  expect(panel.height).toBeLessThan(211);
  for (const choice of ['analytics', 'essential']) {
    const button = await page.locator(`[data-cookie-choice="${choice}"]`).boundingBox();
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.y).toBeGreaterThanOrEqual(panel.y);
    expect(button.y + button.height).toBeLessThanOrEqual(844);
    expect(button.x).toBeGreaterThanOrEqual(0);
    expect(button.x + button.width).toBeLessThanOrEqual(390);
  }
});

test('desktop consent uses a compact bottom-corner card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const card = await page.locator('#cookie-consent-panel').boundingBox();
  expect(card.width).toBeLessThanOrEqual(420);
  expect(card.x).toBeGreaterThan(950);
  expect(card.height).toBeLessThan(220);
  for (const choice of ['analytics', 'essential']) {
    const button = await page.locator(`[data-cookie-choice="${choice}"]`).boundingBox();
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.y + button.height).toBeLessThan(900);
  }
});
