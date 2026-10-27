import { test, expect } from '@playwright/test';

// Evaluates a sizes attribute at a viewport width: (max-width: Npx) conditions
// with Npx / Nvw / calc(Avw +/- Bpx) lengths. Defaults to 100vw per spec.
function resolveSizes(sizes, viewportWidth) {
  for (const part of sizes.split(',').map((s) => s.trim())) {
    const match = part.match(/^(?:\(max-width:\s*(\d+)px\)\s+)?(.+)$/);
    if (!match) continue;
    const [, condition, length] = match;
    if (condition && viewportWidth > Number(condition)) continue;
    const calc = length.match(/^calc\(\s*([\d.]+)vw\s*([+-])\s*([\d.]+)px\s*\)$/);
    if (calc) return (Number(calc[1]) / 100) * viewportWidth + (calc[2] === '+' ? 1 : -1) * Number(calc[3]);
    const vw = length.match(/^([\d.]+)vw$/);
    if (vw) return (Number(vw[1]) / 100) * viewportWidth;
    const px = length.match(/^([\d.]+)px$/);
    if (px) return Number(px[1]);
  }
  return viewportWidth;
}

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
    // Width-appropriateness (user-approved replacement for the variant-picked
    // proxy): the sizes hint must track the rendered width, and the requested
    // file must be the smallest srcset candidate covering that need - or at
    // most one bucket step above it for UA selection heuristics - so captures
    // are never oversized fetches and downscaled variants stay available.
    const dpr = await page.evaluate(() => devicePixelRatio);
    const viewportWidth = page.viewportSize().width;
    for (const img of await page.locator('.shot-img').all()) {
      const { current, srcset, sizes, renderWidth } = await img.evaluate((i) => ({
        current: i.currentSrc, srcset: i.srcset, sizes: i.sizes,
        renderWidth: i.getBoundingClientRect().width,
      }));
      if (renderWidth === 0) continue; // hidden at this width: only the matching device capture shows
      const sourceSize = resolveSizes(sizes, viewportWidth);
      // Hint fidelity: within [0.9x, 1.5x] of the rendered width. Under-declaring
      // risks soft captures; the upper bound covers the capped-width transition
      // (max measured 1.375x at the 600px viewport where the width cap binds).
      expect(sourceSize / renderWidth, `${sizes} vs ${renderWidth}px render`).toBeGreaterThanOrEqual(0.9);
      expect(sourceSize / renderWidth, `${sizes} vs ${renderWidth}px render`).toBeLessThanOrEqual(1.5);
      const candidates = srcset.split(',').map((s) => s.trim().split(/\s+/))
        .map(([url, d]) => ({ url, w: Number(d.replace('w', '')) }))
        .sort((a, b) => a.w - b.w);
      // Srcset availability: downscaled variants remain offered below the full capture.
      expect(candidates.filter((c) => c.w < candidates[candidates.length - 1].w).length, `${current} offers downscaled variants`).toBeGreaterThanOrEqual(1);
      const need = sourceSize * dpr;
      const fitting = candidates.filter((c) => c.w >= need - 0.5);
      const optimal = fitting.length ? fitting[0] : candidates[candidates.length - 1];
      const optimalIndex = candidates.indexOf(optimal);
      const pickedIndex = candidates.findIndex((c) => current.split('/').pop().endsWith(c.url.split('/').pop()));
      expect(pickedIndex, `${current} is a srcset candidate`).toBeGreaterThanOrEqual(0);
      // Never below the optimal pick (soft fetch); at most one bucket step above
      // it. Chromium, Firefox and WebKit all pick exactly optimal in testing.
      expect(pickedIndex, `${current} vs optimal ${optimal.url} for ${need.toFixed(0)}px need`).toBeGreaterThanOrEqual(optimalIndex);
      expect(pickedIndex, `${current} vs optimal ${optimal.url} for ${need.toFixed(0)}px need`).toBeLessThanOrEqual(Math.min(optimalIndex + 1, candidates.length - 1));
    }
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
  // Every capture stays in the DOM and loads; small screens hide the desktop
  // capture by design (the phone capture stands alone there).
  // One capture per viewport: exactly the capture matching the viewport's
  // device class is visible; the other stays in the DOM, hidden by design.
  const vw = page.viewportSize().width;
  for (const image of await page.locator('.shot-img').all()) {
    const kind = await image.evaluate((el) => (el.classList.contains('shot-desk') ? 'desk' : 'mob'));
    const shouldShow = (kind === 'desk' && vw > 960) || (kind === 'mob' && vw <= 960);
    if (shouldShow) await expect(image).toBeVisible();
    else await expect(image).toBeHidden();
  }
  await context.close();
});

test('static no-JavaScript small screen shows the phone capture alone', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.locator('.case:first-child .shot-img')).toHaveCount(2);
  await expect(page.locator('.case:first-child .shot-desk')).toBeHidden();
  await expect(page.locator('.case:first-child .shotbar')).toBeHidden();
  const mob = page.locator('.case:first-child .shot-mob');
  await expect(mob).toBeVisible();
  const box = await mob.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(220);
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


test('theme change during a pending selection keeps the requested screenshots', async ({ page }) => {
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
  // The theme flips while the requested pair is still decoding; the pending
  // choice must survive, reloading the same selection for the new theme.
  await page.evaluate(() => { document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark'; });
  await page.waitForFunction(() => window.decodeReleases.length >= 6);
  await page.evaluate(() => window.decodeReleases.splice(0).forEach((release) => release()));
  await expect(page.locator('.case:first-child .thumb:nth-child(2)')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.case:first-child .pill-label')).toHaveText(/What.s On/);
  await expect(page.locator('.case:first-child .shot-desk')).toHaveAttribute('src', /foa-whatson-desk(-dark)?\.webp$/);
  await expect(page.locator('.case:first-child .shot-mob')).toHaveAttribute('src', /foa-whatson-mob(-dark)?\.webp$/);
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


test('first desktop capture has high priority before sources are assigned', async ({ page }) => {
  await page.addInitScript(() => {
    window.initialCapturePriority = [];
    for (const property of ['srcset', 'src']) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, property);
      Object.defineProperty(HTMLImageElement.prototype, property, {
        ...descriptor,
        set(value) {
          if (this.matches('.case:first-child .shot-desk')) {
            window.initialCapturePriority.push({ property, priority: this.fetchPriority });
          }
          descriptor.set.call(this, value);
        },
      });
    }
  });
  await page.goto('/');
  await expect(page.locator('.shot-img')).toHaveCount(4);
  expect(await page.evaluate(() => window.initialCapturePriority.slice(0, 2))).toEqual([
    { property: 'srcset', priority: 'high' },
    { property: 'src', priority: 'high' },
  ]);
});

test('a rejected decode retains both displayed images and selected label', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => [...document.querySelectorAll('.shot-img')].every((i) => i.complete && i.naturalWidth > 0));
  const before = await page.locator('.case:first-child .shot-img').evaluateAll((images) => images.map((i) => i.currentSrc));
  await page.evaluate(() => {
    const decode = HTMLImageElement.prototype.decode;
    let rejected = false;
    HTMLImageElement.prototype.decode = function () {
      return decode.call(this).then(() => {
        if (!rejected) { rejected = true; throw new Error('synthetic decode failure'); }
      });
    };
    window.failedDecodeSwap = new Promise((resolve) => document.querySelector('.case:first-child').addEventListener('showcase:swap-failed', resolve, { once: true }));
  });
  await page.locator('.case:first-child .thumb:nth-child(2)').click();
  await page.evaluate(() => window.failedDecodeSwap);
  expect(await page.locator('.case:first-child .shot-img').evaluateAll((images) => images.map((i) => i.currentSrc))).toEqual(before);
  await expect(page.locator('.case:first-child .pill-label')).toHaveText('Homepage');
  await expect(page.locator('.case:first-child .thumb.sel')).toHaveText('Homepage');
});

test('an older decoded pair cannot overwrite a newer selection', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => [...document.querySelectorAll('.shot-img')].every((i) => i.complete && i.naturalWidth > 0));
  await page.evaluate(() => {
    const decode = HTMLImageElement.prototype.decode;
    window.olderDecodeReleases = [];
    window.olderDecodesCompleted = 0;
    HTMLImageElement.prototype.decode = function () {
      return decode.call(this).then(() => {
        if (this.src.includes('foa-whatson-')) return new Promise((resolve) => window.olderDecodeReleases.push(resolve)).then(() => { window.olderDecodesCompleted++; });
      });
    };
  });
  await page.locator('.case:first-child .thumb:nth-child(2)').click();
  await page.waitForFunction(() => window.olderDecodeReleases.length === 2);
  await page.locator('.case:first-child .thumb:nth-child(3)').click();
  await expect(page.locator('.case:first-child .shot-desk')).toHaveAttribute('src', /foa-fundraising-desk/);
  await expect(page.locator('.case:first-child .shot-mob')).toHaveAttribute('src', /foa-fundraising-mob/);
  await page.evaluate(async () => {
    window.olderDecodeReleases.forEach((release) => release());
    // A task boundary lets all promise continuations, including the pair's
    // Promise.all commit callback, finish before preservation is checked.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(await page.evaluate(() => window.olderDecodesCompleted)).toBe(2);
  await expect(page.locator('.case:first-child .shot-desk')).toHaveAttribute('src', /foa-fundraising-desk/);
  await expect(page.locator('.case:first-child .shot-mob')).toHaveAttribute('src', /foa-fundraising-mob/);
  await expect(page.locator('.case:first-child .pill-label')).toHaveText('Fundraising');
  await expect(page.locator('.case:first-child .thumb.sel')).toHaveText('Fundraising');
});
