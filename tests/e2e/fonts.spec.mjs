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
      // Block the webfont outright for the "before" paint: an aborted request
      // cannot satisfy document.fonts on any engine (a held request can race
      // WebKit's font cache). The "after" phase reloads without the block.
      let fontRequested = false;
      await page.route('**/assets/fonts/dmsans.woff2', async (route) => {
        fontRequested = true;
        await route.abort();
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
          fontReady: document.fonts.check('400 48px "DM Sans"'),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      };
      const paint = () => page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }));

      try {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.fonts.status === 'loaded');
        assert.ok(fontRequested, 'page requested the DM Sans webfont');
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
        assert.equal(before.fontReady, false, 'webfont is unavailable during the blocked first paint');
        assert.ok(before.width > 0 && before.bottom > before.top, 'fallback text has visible geometry');
        assert.ok(before.text.length > 0, 'headline is readable before the font arrives');
        assert.ok(before.overflow <= 1, 'fallback does not introduce horizontal scrolling');

        // A failed font load poisons the @font-face for the rest of the page
        // lifetime (Chromium keeps rejecting later loads of the same face),
        // so the "after" phase reloads the page without the block.
        await page.unroute('**/assets/fonts/dmsans.woff2');
        await page.reload({ waitUntil: 'domcontentloaded' });
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
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      }
    });
  }
}
