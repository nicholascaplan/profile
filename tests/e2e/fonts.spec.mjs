import { test } from '@playwright/test';
import assert from 'node:assert/strict';

// Hold the webfont until after a fallback paint, rather than relying on network
// timing. This checks vertical text stability, not identical character widths or
// zero CLS: the fallback cannot promise either of those.
for (const path of ['/', '/experience/', '/contact/']) {
  for (const localFallback of [true, false]) {
    test(`font swap (${path}, local fallback ${localFallback ? 'enabled' : 'unavailable'}): readable before and after loading`, async ({ page, isMobile }, testInfo) => {
      if (!localFallback) {
        await page.route('**/assets/css/fonts.css', async (route) => {
          const response = await route.fetch();
          const css = (await response.text()).replace(
            "src: local('Arial'), local('Liberation Sans');",
            "src: local('Deliberately unavailable test font');",
          );
          await route.fulfill({ response, body: css });
        });
      }

      // Mobile projects keep their device viewport; desktop projects exercise
      // the full-sized headline.
      if (!isMobile) await page.setViewportSize({ width: 1440, height: 900 });
      // Delay the webfont response instead of holding it: an indefinitely held
      // request is killed on WebKit before release (the face goes to "error"
      // and the same-document swap can never happen). A delayed response keeps
      // the face "loading" while the fallback paints, then completes the swap
      // inside the SAME document. Every fulfill is no-store: WebKit's memory
      // cache would otherwise serve the font across the per-variant
      // navigations without a network request (the preload and the CSS fetch
      // share the cache). The delay is well beyond the fallback-paint work.
      const FONT_DELAY_MS = 2500;
      let fontRequested;
      const requested = new Promise((resolve) => { fontRequested = resolve; });
      await page.route('**/assets/fonts/dmsans.woff2', async (route) => {
        fontRequested();
        await new Promise((resolve) => setTimeout(resolve, FONT_DELAY_MS));
        const response = await route.fetch();
        const headers = { ...response.headers(), 'cache-control': 'no-store' };
        await route.fulfill({ response, headers });
      });

      const measure = () => {
        const heading = document.querySelector('h1');
        const range = document.createRange();
        range.selectNodeContents(heading);
        const text = range.getBoundingClientRect();
        return {
          top: text.top,
          bottom: text.bottom,
          width: text.width,
          text: heading.textContent.trim(),
          fontReady: (() => {
            // WebKit reports a face in "error" as check() === true; read the
            // face status directly - "loaded" is the only applied state.
            const face = [...document.fonts].find((f) => f.family === 'DM Sans' && f.weight === '400');
            return !!face && face.status === 'loaded';
          })(),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      };
      const paint = () => page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }));

      try {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await requested;
        const hasLocalFallback = await page.evaluate(async () => {
          // A rejected load means neither local face is installed. Do not make
          // a vertical-metric guarantee on platforms using generic sans-serif.
          try {
            return (await document.fonts.load('400 48px "DM Sans FB"')).length > 0;
          } catch {
            return false;
          }
        });
        if (!localFallback) assert.equal(hasLocalFallback, false, 'test disables the adjusted fallback');
        if (localFallback && !hasLocalFallback) {
          testInfo.annotations.push({ type: 'fallback', description: 'No Arial/Liberation Sans installed; only generic-fallback assertions apply.' });
        }
        await paint();
        const before = await page.evaluate(measure);
        // Diagnostics ride the failure message: CI engines where the hold does
        // not gate the font (WebKit, mobile Chrome) need the FontFaceSet and
        // resource-timing state to identify the bypass.
        const diag = await page.evaluate(() => ({
          faces: [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`),
          dmsansEntries: performance.getEntriesByType('resource')
            .filter((e) => e.name.includes('dmsans'))
            .map((e) => `${e.initiatorType} size=${e.transferSize} dur=${Math.round(e.duration)}`),
        }));
        assert.equal(before.fontReady, false,
          `webfont is still held after fallback paint ${JSON.stringify(diag)}`);
        assert.ok(before.width > 0 && before.bottom > before.top, 'fallback text has visible geometry');
        assert.ok(before.text.length > 0, 'headline is readable before the font arrives');
        assert.ok(before.overflow <= 1, 'fallback does not introduce horizontal scrolling');

        // The delayed response lands on its own: the swap happens inside this
        // same document, so before/after measure the real runtime font swap.
        await page.waitForFunction(() => {
          const face = [...document.fonts].find((f) => f.family === 'DM Sans' && f.weight === '400');
          return face && face.status === 'loaded';
        }, { timeout: 8000 });
        await page.evaluate(() => document.fonts.ready);
        await paint();
        const after = await page.evaluate(measure);
        assert.equal(after.fontReady, true, 'webfont successfully replaces the fallback');
        assert.equal(after.text, before.text, 'headline content survives the swap');
        assert.ok(after.width > 0 && after.bottom > after.top, 'webfont text has visible geometry');
        assert.ok(after.overflow <= 1, 'loaded text does not introduce horizontal scrolling');
        if (hasLocalFallback) {
          assert.ok(Math.abs(after.top - before.top) <= 1,
            `matched fallback keeps text top stable (${before.top} -> ${after.top})`);
          assert.ok(Math.abs(after.bottom - before.bottom) <= 1,
            `matched fallback keeps text bottom stable (${before.bottom} -> ${after.bottom})`);
        }
      } finally {
        await page.unrouteAll({ behavior: 'wait' });
      }
    });
  }
}
