import { test, expect } from '@playwright/test';

for (const saved of [null, 'true', 'false']) test(`phone hides redundant preview toggle with saved choice ${saved}`, async ({ page }) => {
  if (saved !== null) await page.addInitScript(value => localStorage.setItem('nick-mobile', value), saved);
  for (const path of ['/', '/experience/', '/contact/']) {
    await page.goto(path);
    for (const width of [390, 600]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator('.mobile-toggle')).toBeHidden();
      await expect(page.locator('.theme-toggle')).toBeVisible();
    }
  }
});

test('desktop preview toggle remains usable through resize', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const toggle = page.locator('.mobile-toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('body')).toHaveAttribute('data-preview', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(toggle).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toggle).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-preview', 'true');
  await toggle.click();
  await expect(page.locator('body')).toHaveAttribute('data-mobile', 'false');
});
