import { test, expect } from '@playwright/test';

// Exercise the same static server used by every local browser check.
for (const [path, type] of [
  ['/assets/images/favicon.svg', 'image/svg+xml'],
  ['/favicon.ico', 'image/vnd.microsoft.icon'],
  ['/site.webmanifest', 'application/manifest+json'],
]) {
  test(`icon resource has its correct content type: ${path}`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'].split(';')[0]).toBe(type);
    expect((await response.body()).length).toBeGreaterThan(0);
  });
}
