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
      const candidate = Number(img.currentSrc.match(/-(\d+)w\.webp$/)?.[1] || (img.classList.contains('shot-desk') ? 2560 : 1170));
      return { candidate, required: img.getBoundingClientRect().width * devicePixelRatio, src: img.currentSrc };
    }));
    for (const image of images) {
      // Original capture resolution is the upper bound, never upscale or invent detail.
      const maximum = image.src.includes('-desk') ? 2560 : image.src.includes('/work/') ? 1170 : 600;
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
  await page.locator('.case:first-child .thumb[data-label="What’s On"]').click();
  await page.waitForFunction(() => window.decodeReleases.length === 2);
  expect(await page.locator('.case:first-child .shot-desk').getAttribute('src')).toContain('foa-fundraising-desk');
  expect(await page.locator('.case:first-child .shot-mob').getAttribute('src')).toContain('foa-fundraising-mob');
  await page.evaluate(() => window.decodeReleases[0]());
  expect(await page.locator('.case:first-child .shot-desk').getAttribute('src')).toContain('foa-fundraising-desk');
  expect(await page.locator('.case:first-child .shot-mob').getAttribute('src')).toContain('foa-fundraising-mob');
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
  await page.locator('.case:first-child .thumb[data-label="What’s On"]').click();
  await page.waitForFunction(() => window.decodeReleases.length === 2);
  // The theme flips while the requested pair is still decoding; the pending
  // choice must survive, reloading the same selection for the new theme.
  await page.evaluate(() => { document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark'; });
  await page.waitForFunction(() => window.decodeReleases.length >= 6);
  await page.evaluate(() => window.decodeReleases.splice(0).forEach((release) => release()));
  await expect(page.locator('.case:first-child .thumb[data-label="What’s On"]')).toHaveAttribute('aria-pressed', 'true');
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
  await page.locator('.case:first-child .thumb[data-label="What’s On"]').click();
  await page.evaluate(() => window.failedDecodeSwap);
  expect(await page.locator('.case:first-child .shot-img').evaluateAll((images) => images.map((i) => i.currentSrc))).toEqual(before);
  await expect(page.locator('.case:first-child .pill-label')).toHaveText('Fundraising');
  await expect(page.locator('.case:first-child .thumb.sel')).toHaveText('Fundraising');
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
  await page.locator('.case:first-child .thumb[data-label="What’s On"]').click();
  await page.waitForFunction(() => window.olderDecodeReleases.length === 2);
  await page.locator('.case:first-child .thumb[data-label="Fireworks"]').click();
  await expect(page.locator('.case:first-child .shot-desk')).toHaveAttribute('src', /foa-fireworks-desk/);
  await expect(page.locator('.case:first-child .shot-mob')).toHaveAttribute('src', /foa-fireworks-mob/);
  await page.evaluate(async () => {
    window.olderDecodeReleases.forEach((release) => release());
    // A task boundary lets all promise continuations, including the pair's
    // Promise.all commit callback, finish before preservation is checked.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(await page.evaluate(() => window.olderDecodesCompleted)).toBe(2);
  await expect(page.locator('.case:first-child .shot-desk')).toHaveAttribute('src', /foa-fireworks-desk/);
  await expect(page.locator('.case:first-child .shot-mob')).toHaveAttribute('src', /foa-fireworks-mob/);
  await expect(page.locator('.case:first-child .pill-label')).toHaveText('Fireworks');
  await expect(page.locator('.case:first-child .thumb.sel')).toHaveText('Fireworks');
});

// Regression: a 1x phone should not fetch 600w for a capture capped at 300px.
test('mobile 390 at 1x uses the sufficient 320w capture', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForFunction(() => [...document.querySelectorAll('.shot-mob')].every(i => i.complete && i.naturalWidth > 0));
  for (const image of await page.locator('.shot-mob').all()) {
    const state = await image.evaluate(i => ({ src: i.currentSrc, width: i.getBoundingClientRect().width }));
    expect(state.width).toBeLessThanOrEqual(300);
    expect(state.src).toMatch(/-320w\.webp$/);
  }
  await context.close();
});


test('every declared mobile capture candidate matches its decoded pixel dimensions', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 3 });
  const page = await context.newPage(); await page.goto(baseURL);
  const candidates = await page.locator('.thumb').evaluateAll(bs => bs.flatMap(b => [b.dataset.srcMob,b.dataset.srcMobDark]));
  const manifest = await (await page.request.get(new URL('assets/images/work/mobile-captures.json', baseURL).href)).json();
  for (const capture of Object.values(manifest)) for (const [width,file] of Object.entries(capture.variants)) {
    const actual = await page.evaluate(async f => { const image = new Image();image.src='assets/images/work/'+f;await image.decode();return image.naturalWidth; },file);
    expect(actual,file).toBe(Number(width));
  }
  for (const src of new Set(candidates)) {
    const dimensions = await page.evaluate(async (src) => { const i = new Image(); i.src = src; await i.decode(); return [i.naturalWidth,i.naturalHeight]; }, src);
    expect(dimensions[0], src).toBe(1170); expect(dimensions[1], src).toBe(2106);
  }
  // Verify the synchronous runtime map for every selectable capture and theme.
  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => { document.body.dataset.theme = value; }, theme);
    for (const card of await page.locator('.case').all()) {
      for (const thumb of await card.locator('.thumb').all()) {
        const source = await thumb.getAttribute(theme === 'dark' ? 'data-src-mob-dark' : 'data-src-mob');
        const capture = manifest[source.split('/').pop()];
        expect(capture, source).toBeDefined();
        await thumb.click();
        const image = card.locator('.shot-mob');
        await expect(image).toHaveAttribute('src', source);
        const srcset = await image.getAttribute('srcset');
        for (const [width, file] of Object.entries(capture.variants)) {
          expect(srcset, source).toContain(`${file} ${width}w`);
        }
      }
    }
  }
  for (const image of await page.locator('.shot-mob').all()) {
    const result = await image.evaluate(async i => { const candidate = new Image(); candidate.src = i.currentSrc; await candidate.decode(); const descriptor = i.srcset.split(',').map(s=>s.trim().split(/\s+/)).find(([u])=>new URL(u,location.href).href===i.currentSrc);return {actual:candidate.naturalWidth,declared:Number(descriptor[1].replace('w','')),need:i.getBoundingClientRect().width*devicePixelRatio};});
    expect(result.actual).toBe(result.declared);expect(result.actual).toBeGreaterThanOrEqual(result.need);
  }
  await context.close();
});

// Decode the actual selected file, not its srcset descriptor or a capped need.
test('wide desktop and phone captures cover real high-density display pixels', async ({browser,baseURL}) => {
  for(const [width,dpr] of [[390,3],[1280,2],[1440,2],[1920,3]]) {
    const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:dpr});
    const page=await context.newPage();await page.goto(baseURL);
    for(const preview of [false,true]) {
      await page.evaluate(v=>document.body.dataset.mobile=String(v),preview);
      for(const c of await page.locator('.case').all()) for(const button of await c.locator('.thumb:visible').all()) {
        await button.click();await expect(button).toHaveAttribute('aria-pressed','true');
        const image=c.locator(width<=960||preview?'.shot-mob':'.shot-desk');
        const actual=await image.evaluate(async i=>{const n=new Image();n.src=i.currentSrc;await n.decode();return{pixels:n.naturalWidth,need:i.getBoundingClientRect().width*devicePixelRatio,source:i.currentSrc}});
        expect(actual.pixels,`${actual.source} ${width}px @${dpr}x preview=${preview}`).toBeGreaterThanOrEqual(Math.ceil(actual.need)-1);
      }
    }
    await context.close();
  }
});

test('each desktop capture candidate keeps its master pixels and theme', async ({page}) => {
  await page.goto('/');
  const families=await page.locator('.case .thumb').evaluateAll(bs=>[...new Set(bs.flatMap(b=>[b.dataset.srcDesk,b.dataset.srcDeskDark]))]);
  for(const src of families){
    const result=await page.evaluate(async src=>{
      const image=async url=>{const i=new Image();i.src=url;await i.decode();return i};
      const master=await image(src);const canvas=document.createElement('canvas');canvas.width=16;canvas.height=9;const ctx=canvas.getContext('2d');ctx.drawImage(master,0,0,16,9);const ref=ctx.getImageData(0,0,16,9).data;
      const base=src.split('/').pop();let errors=[];
      for(const w of[400,800,1280,1920]){
        let file=base.replace('.webp',`-${w}w.webp`);
        if(base.startsWith('3-sam-home')&&w<1000)file=(w===400?'5-13-':'6-14-')+file.slice(2);
        if(base.startsWith('4-sam-home')&&w<1000)file=(w===400?'7-15-':'8-16-')+file.slice(2);
        const i=await image(src.slice(0,src.lastIndexOf('/')+1)+file);ctx.clearRect(0,0,16,9);ctx.drawImage(i,0,0,16,9);const data=ctx.getImageData(0,0,16,9).data;let diff=0;for(let k=0;k<data.length;k++)diff+=Math.abs(data[k]-ref[k]);errors.push({w,pixels:i.naturalWidth,diff:diff/data.length});
      }
      return{master:master.naturalWidth,errors};
    },src);
    expect(result.master).toBe(2560);
    for(const e of result.errors){expect(e.pixels).toBe(e.w);expect(e.diff,`${src} ${e.w}w agrees with actual master pixels`).toBeLessThan(12)}
  }
});
