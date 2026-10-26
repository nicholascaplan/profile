import { test, expect } from '@playwright/test';

for (const theme of ['dark', 'light']) {
  test(`image requests start in the saved ${theme} theme without the other capture set`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('nick-theme', value), theme);
    const requests = [];
    page.on('request', (request) => {
      if (request.url().includes('/images/work/')) requests.push(request.url());
    });
    await page.goto('/');
    await expect(page.locator('.shot-img')).toHaveCount(4);
    await page.waitForFunction(() => [...document.querySelectorAll('.shot-img')].every((i) => i.complete && i.naturalWidth > 0));
    expect(requests).toHaveLength(4);
    for (const url of requests) expect(/-dark(?:-\d+w)?\.webp$/.test(url)).toBe(theme === 'dark');
    expect(requests.some((url) => /-\d+w\.webp$/.test(url))).toBeTruthy();
    expect(await page.locator('.case:first-child .shot-desk').getAttribute('fetchpriority')).toBe('high');
  });
}

test('responsive captures retain enough detail at phone, tablet and desktop widths', async ({ page }) => {
  for (const width of [320, 390, 768, 960, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.waitForFunction(() => [...document.querySelectorAll('.shot-img, .portrait')].every((i) => i.complete && i.naturalWidth > 0));
    const images = await page.locator('.shot-img, .portrait').evaluateAll((images) => images.map((img) => {
      const candidate = Number(img.currentSrc.match(/-(\d+)w\.webp$/)?.[1] || (img.classList.contains('shot-desk') ? 1280 : 600));
      return { candidate, required: img.getBoundingClientRect().width * devicePixelRatio, src: img.currentSrc };
    }));
    for (const image of images) {
      // Original capture resolution is the upper bound, never upscale or invent detail.
      const maximum = image.src.includes('-desk') ? 1280 : 600;
      expect(image.candidate, `${image.src} at ${width}px`).toBeGreaterThanOrEqual(Math.min(maximum, image.required) * 0.9);
    }
  }
});

test('static no-JavaScript homepage retains all showcase images', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.locator('.shot-img')).toHaveCount(4);
  for (const image of await page.locator('.shot-img').all()) await expect(image).toBeVisible();
  await context.close();
});

test('paired screenshot changes wait for both decoded candidates', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => [...document.querySelectorAll('.shot-img')].every((i) => i.complete && i.naturalWidth > 0));
  await page.evaluate(() => {
    window.decodeReleases = [];
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      return decode.call(this).then(() => new Promise((resolve) => window.decodeReleases.push(resolve)));
    };
  });
  await page.locator('.case:first-child .thumb:nth-child(2)').click();
  await page.waitForFunction(() => window.decodeReleases.length === 2);
  expect(await page.locator('.case:first-child .shot-desk').getAttribute('src')).toContain('foa-home-desk');
  expect(await page.locator('.case:first-child .shot-mob').getAttribute('src')).toContain('foa-home-mob');
  await page.evaluate(() => window.decodeReleases[0]());
  expect(await page.locator('.case:first-child .shot-desk').getAttribute('src')).toContain('foa-home-desk');
  expect(await page.locator('.case:first-child .shot-mob').getAttribute('src')).toContain('foa-home-mob');
  await page.evaluate(() => window.decodeReleases[1]());
  await expect(page.locator('.case:first-child .shot-desk')).toHaveAttribute('src', /foa-whatson-desk/);
  await expect(page.locator('.case:first-child .shot-mob')).toHaveAttribute('src', /foa-whatson-mob/);
});


test('screenshot activation preserves the reserved layout before scripts run', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/assets/js/showcase.js', async (route) => { await gate; await route.continue(); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('.case:first-child .shot-template')).toHaveCount(2);
  await page.waitForFunction(() => document.querySelector('.case .shot-template').getBoundingClientRect().height > 300);
  const box = () => page.locator('.case:first-child .shot').boundingBox();
  const before = await box();
  expect(before.height).toBeGreaterThan(300);
  release();
  await expect(page.locator('.shot-img')).toHaveCount(4);
  const after = await box();
  expect(Math.abs(after.height - before.height)).toBeLessThan(1);
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
});
