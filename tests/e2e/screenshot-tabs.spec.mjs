import {test, expect} from '@playwright/test';
for (const theme of ['dark', 'light']) for (const width of [320, 390, 1440]) test(`underline screenshot choices ${theme} at ${width}`, async ({page}) => {
  await page.setViewportSize({width, height:900});
  await page.addInitScript(t => {localStorage.setItem('nick-theme', t); localStorage.setItem('websites-by-nick-cookie-preferences', 'essential');}, theme);
  await page.goto('/');
  const groups = await page.locator('.thumbs').all();
  expect(groups.length).toBe(2);
  for (const group of groups) {
    const buttons = group.locator('.thumb');
    expect(await buttons.count()).toBe(3);
    for (let i=0; i<await buttons.count(); i++) {
      const button = buttons.nth(i);
      await button.focus();
      await button.press('Enter');
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1);
      expect(await button.evaluate(el => {const s=getComputedStyle(el);return {border:s.borderTopWidth,background:s.backgroundColor,radius:s.borderRadius,outline:s.outlineStyle};})).toMatchObject({border:'0px', background:'rgba(0, 0, 0, 0)',radius:'0px',outline:'solid'});
      const underline = await button.evaluate(el => {const s=getComputedStyle(el,'::after');return {height:s.height,color:s.backgroundColor};});
      expect(underline.height).toBe('2px');
      expect(await button.evaluate(el => getComputedStyle(el,'::after').bottom)).toBe('0px');
      expect(underline.color).not.toBe('rgba(0, 0, 0, 0)');
      const box=await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(width);
    }
  }
  await page.evaluate(() => {const elements=[...document.querySelectorAll('.thumb span')];const sizes=elements.map(el=>parseFloat(getComputedStyle(el).fontSize));elements.forEach((el,i)=>el.style.fontSize=sizes[i]*2+'px');});
  const allThumbs = await page.locator('.thumb').all();
  expect(allThumbs.length).toBe(6);
  for (const button of allThumbs) {const box=await button.boundingBox();expect(await button.evaluate(el=>getComputedStyle(el).boxShadow)).toContain('inset');expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x+box.width).toBeLessThanOrEqual(width);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
