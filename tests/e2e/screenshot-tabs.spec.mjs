import {test, expect} from '@playwright/test';
for (const theme of ['dark', 'light']) for (const width of [320, 390, 1440]) test(`underline screenshot choices ${theme} at ${width}`, async ({page}) => {
  await page.setViewportSize({width, height:900});
  await page.addInitScript(t => {localStorage.setItem('nick-theme', t); localStorage.setItem('websites-by-nick-cookie-preferences', 'essential');}, theme);
  await page.goto('/');
  const groups = await page.locator('.thumbs').all();
  expect(groups.length).toBe(2);
  for (const group of groups) {
    const buttons = group.locator('.thumb:visible');
    expect(await buttons.count()).toBe(group === groups[0] ? (width <= 960 ? 4 : 3) : 4);
    for (let i=0; i<await buttons.count(); i++) {
      const button = buttons.nth(i);
      await button.focus();
      await button.press('Enter');
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1);
      expect(await button.evaluate(el => {const s=getComputedStyle(el);return {border:s.borderTopWidth,background:s.backgroundColor,radius:s.borderRadius,outline:s.outlineStyle};})).toMatchObject({border:'0px', background:'rgba(0, 0, 0, 0)',radius:'0px',outline:'solid'});
      // The underline is one sliding indicator (JS); assert it sits under the
      // just-selected button with the same 2px accent bar the ::after drew.
      const indicator = group.locator('.thumb-ind');
      await expect(indicator).toHaveCSS('height', '2px');
      expect(await indicator.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
      // The indicator slides (180ms transition); poll until it settles there.
      await expect.poll(async () => {
        const indBox = await indicator.boundingBox();
        const btnBox = await button.boundingBox();
        return indBox.x >= btnBox.x - 1 && indBox.x + indBox.width <= btnBox.x + btnBox.width + 1 &&
          Math.abs(indBox.y + indBox.height - (btnBox.y + btnBox.height)) <= 2;
      }).toBe(true);
      const box=await button.boundingBox();
      expect(Math.round(box.height * 1000) / 1000).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(width);
    }
  }
  await page.evaluate(() => {const elements=[...document.querySelectorAll('.thumb span')];const sizes=elements.map(el=>parseFloat(getComputedStyle(el).fontSize));elements.forEach((el,i)=>el.style.fontSize=sizes[i]*2+'px');});
  const allThumbs = await page.locator('.thumb:visible').all();
  expect(allThumbs.length).toBe(width <= 960 ? 8 : 7);
  for (const button of allThumbs) {const box=await button.boundingBox();expect(await button.evaluate(el=>getComputedStyle(el).boxShadow)).toContain('inset');expect(Math.round(box.height * 1000) / 1000).toBeGreaterThanOrEqual(44);expect(box.x+box.width).toBeLessThanOrEqual(width);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
