import { test, expect } from '@playwright/test';

const endpoint = '**/formspree.io/f/*';
async function complete(page) {
  await page.goto('/contact/');
  await page.getByLabel('Name', { exact: true }).fill('Test visitor');
  await page.getByLabel('Email', { exact: true }).fill('visitor@example.com');
  await page.getByLabel('Message', { exact: true }).fill('A website enquiry, intercepted in this test.');
}
test.beforeEach(async ({ page }) => {
  // Fail closed: every test intercepts the provider, never sends a real enquiry.
  await page.route(endpoint, route => route.abort());
});

test('inline validation blocks invalid and blank fields, keeps values and focuses first error', async ({ page }) => {
  let requests = 0;
  await page.route(endpoint, route => { requests++; return route.abort(); });
  await page.goto('/contact/');
  await page.getByLabel('Email', { exact: true }).fill('jsjd');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('#contact-name')).toBeFocused();
  await expect(page.locator('#contact-email-error')).toHaveText('Enter a valid email address, such as name@example.com.');
  await expect(page.locator('#contact-email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#contact-email')).toHaveValue('jsjd');
  await page.getByLabel('Email', { exact: true }).fill('visitor@example.com');
  await expect(page.locator('#contact-email-error')).toBeEmpty();
  expect(requests).toBe(0);
});

test('accepted message stays on site; pending prevents duplicates; fresh-message button resets', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requests = 0;
  await page.route(endpoint, async route => {
    requests++;
    expect(route.request().headers().accept).toBe('application/json');
    await gate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"next":"/thanks"}' });
  });
  await complete(page);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('#contact-status')).toHaveText('Sending your message...');
  await expect(page.locator('[type="submit"]')).toBeDisabled();
  await expect(page.locator('#contact-message')).toHaveAttribute('readonly', '');
  release();
  await expect(page.locator('#contact-status')).toContainText('your message has been sent');
  await expect(page.locator('#contact-status')).toBeFocused();
  expect(page.url()).toContain('/contact/');
  expect(requests).toBe(1);
  await page.getByRole('button', { name: 'Send another message' }).click();
  await expect(page.locator('#contact-name')).toHaveValue('');
  await expect(page.locator('#contact-name')).toBeFocused();
});

for (const [label, status, body, contentType, message] of [
  ['field rejection', 422, '{"errors":[{"field":"email","code":"TYPE_EMAIL"}]}', 'application/json', 'Please check the highlighted fields'],
  ['rate limit', 429, '{}', 'application/json', 'Too many attempts'],
  ['server failure', 500, '{}', 'application/json', 'could not confirm'],
  ['invalid response', 200, '<html>Unexpected page</html>', 'text/html', 'could not confirm'],
  ['JSON null', 200, 'null', 'application/json', 'could not confirm'],
  ['JSON array', 200, '[]', 'application/json', 'could not confirm'],
  ['JSON primitive', 200, 'true', 'application/json', 'could not confirm'],
  ['error on 2xx', 200, '{"error":"rejected"}', 'application/json', 'could not confirm'],
  ['form rejection', 422, '{"errors":[{"code":"INACTIVE"}]}', 'application/json', 'could not be sent'],
]) {
  test(`${label}: retained input, no false success, retry possible`, async ({ page }) => {
    await page.route(endpoint, route => route.fulfill({ status, body, contentType }));
    await complete(page);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.locator('#contact-status')).toContainText(message);
    await expect(page.locator('#contact-message')).toHaveValue('A website enquiry, intercepted in this test.');
    await expect(page.locator('[type="submit"]')).toBeEnabled();
    await expect(page.locator('#contact-another')).toBeHidden();
    if (label === 'field rejection') await expect(page.locator('#contact-email')).toBeFocused();
  });
}

test('connection failure retains message and can be retried successfully', async ({ page }) => {
  await complete(page);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('#contact-status')).toContainText('Check your connection');
  await expect(page.locator('#contact-message')).not.toHaveValue('');
  await page.route(endpoint, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"next":"/thanks"}' }));
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('#contact-status')).toContainText('your message has been sent');
});

test('no JavaScript retains native validation and original POST fallback', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.route(endpoint, route => route.abort());
  await page.goto('/contact/');
  await expect(page.locator('form')).toHaveAttribute('method', 'POST');
  await expect(page.locator('form')).not.toHaveAttribute('novalidate', '');
  await expect(page.locator('#contact-email')).toHaveAttribute('type', 'email');
  await expect(page.locator('#contact-another')).toBeHidden();
  await context.close();
});

for (const theme of ['dark', 'light']) {
  test(`${theme}: inline errors fit 320px and enlarged text, accessible contrast`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.addInitScript(value => localStorage.setItem('nick-theme', value), theme);
    await page.goto('/contact/');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await page.evaluate(() => {
      document.querySelectorAll('.form-error, .form-status').forEach(el => { el.style.fontSize = '32px'; });
    });
    await expect(page.locator('#contact-email-error')).toBeVisible();
    const checks = await page.evaluate(() => {
      const el = document.querySelector('.form-error');
      const l = value => {
        const c = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
        return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
      };
      const a = l(getComputedStyle(el).color), b = l(getComputedStyle(document.body).backgroundColor);
      return { width: document.documentElement.scrollWidth, viewport: innerWidth, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
    expect(checks.width).toBeLessThanOrEqual(checks.viewport);
    expect(checks.ratio).toBeGreaterThanOrEqual(4.5);
    const border = await page.locator('#contact-email').evaluate(el => getComputedStyle(el).borderTopColor);
    const errorInk = await page.locator('#contact-email-error').evaluate(el => getComputedStyle(el).color);
    expect(border).toBe(errorInk);
  });
}

for (const body of ['{}', '{"next":null}']) {
  test(`successful JSON without a redirect (${body}) confirms once`, async ({ page }) => {
    await page.route(endpoint, route => route.fulfill({ status: 200, contentType: 'application/json', body }));
    await complete(page);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.locator('#contact-status')).toContainText('your message has been sent');
    await expect(page.locator('[type="submit"]')).toBeHidden();
  });
}

test('status panel keeps a uniform border; outline follows input modality', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"next":"/thanks"}' }));
  const status = page.locator('#contact-status');
  // Pointer submit: the programmatic focus moves to the status panel but must
  // not paint a decorative outline; the panel border stays a uniform 1px.
  await complete(page);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(status).toContainText('your message has been sent');
  await expect(status).toBeFocused();
  const pointerStyle = await status.evaluate(el => {
    const cs = getComputedStyle(el);
    return { left: cs.borderLeftWidth, top: cs.borderTopWidth, outline: cs.outlineStyle };
  });
  expect(pointerStyle).toEqual({ left: '1px', top: '1px', outline: 'none' });
  // Keyboard submit: the outline stays, so keyboard users see where focus went.
  await page.getByRole('button', { name: 'Send another message' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Test visitor');
  await page.getByLabel('Email', { exact: true }).fill('visitor@example.com');
  await page.getByLabel('Message', { exact: true }).fill('Second enquiry, intercepted in this test.');
  await page.getByRole('button', { name: 'Send message', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(status).toContainText('your message has been sent');
  await expect(status).toBeFocused();
  const keyStyle = await status.evaluate(el => {
    const cs = getComputedStyle(el);
    return { left: cs.borderLeftWidth, outline: cs.outlineStyle, outlineWidth: cs.outlineWidth };
  });
  expect(keyStyle).toEqual({ left: '1px', outline: 'solid', outlineWidth: '2px' });
});
