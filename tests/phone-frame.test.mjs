// The phone frame must stay visible in dark mode (Nick, 29 October 2026):
// the old #17191c outline matched the dark page and disappeared.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets/css/site.css'), 'utf8');

test('phone frame uses a ring colour, not the old near-background outline', () => {
  assert.ok(!css.includes('#17191c'));
  // Selector lists may carry the slide-layer variant alongside .shot-mob.
  const frames = css.match(/\.shot-mob[^{]*\{[^}]*outline: 3px solid var\(--phone-ring\)[^}]*\}/g) || [];
  assert.equal(frames.length, 2, 'small screens and the desktop preview both use the ring');
  for (const frame of frames) assert.match(frame, /border-width: 22px 8px 8px/);
});

test('light and dark themes both define the ring and glow', () => {
  assert.match(css, /:root \{[^}]*--phone-ring: #b45e3f/);
  assert.match(css, /data-theme="dark"\] \{[^}]*--phone-ring: #f09a7c/);
  assert.equal((css.match(/--phone-glow:/g) || []).length, 2);
});
