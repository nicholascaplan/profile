// Behaviour checks for the theme (dark/light) logic in index.html.
// Runs the page's inline script against a minimal DOM stub - no dependencies.
// Usage: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pageScript = readFileSync(join(root, 'assets/js/site.js'), 'utf8');

function makeElement() {
  return {
    attributes: {},
    listeners: {},
    title: '',
    textContent: '',
    removed: false,
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    remove() { this.removed = true; },
  };
}

// Runs the page script with a chosen system theme and stored prefs, and
// returns the resulting state for assertions.
function runPage({ prefersDark = false, stored = {} }) {
  const themeLabel = makeElement();
  const themeIcon = makeElement();
  const themeToggle = makeElement();
  themeToggle.querySelector = (selector) =>
    selector === '.theme-label' ? themeLabel : themeIcon;
  const mobileToggle = makeElement();
  const store = { ...stored };

  const document = {
    body: { dataset: {} },
    querySelector(selector) {
      if (selector === '.theme-toggle') return themeToggle;
      if (selector === '.mobile-toggle') return mobileToggle;
      return makeElement();
    },
    querySelectorAll() {
      return [];
    },
  };
  const window = {
    location: { hostname: 'nickcaplan.github.io' },
    localStorage: {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, value) => { store[key] = String(value); },
    },
    matchMedia: (query) => ({
      matches: query.includes('prefers-color-scheme') ? prefersDark : false,
      addEventListener() {},
    }),
  };

  vm.runInNewContext(pageScript, { document, window }, { timeout: 1000 });
  return { body: document.body, themeToggle, themeLabel, themeIcon, store };
}

function expectLight({ body, themeToggle, themeLabel, themeIcon }) {
  assert.equal(body.dataset.theme, 'light');
  assert.equal(themeToggle.attributes['aria-pressed'], 'false');
  assert.equal(themeToggle.attributes['aria-label'], 'Switch to dark mode');
  assert.equal(themeLabel.textContent, 'Dark mode');
  assert.equal(themeIcon.textContent, '☾');
}

function expectDark({ body, themeToggle, themeLabel, themeIcon }) {
  assert.equal(body.dataset.theme, 'dark');
  assert.equal(themeToggle.attributes['aria-pressed'], 'true');
  assert.equal(themeToggle.attributes['aria-label'], 'Switch to light mode');
  assert.equal(themeLabel.textContent, 'Light mode');
  assert.equal(themeIcon.textContent, '☀');
}

test('defaults to dark with a light system and no stored choice', () => {
  const page = runPage({ prefersDark: false });
  expectDark(page);
  assert.equal('nick-theme' in page.store, false, 'no theme is written before a manual toggle');
});

test('defaults to dark when the system prefers dark and nothing is stored', () => {
  const page = runPage({ prefersDark: true });
  expectDark(page);
  assert.equal('nick-theme' in page.store, false, 'no theme is written before a manual toggle');
});

test('a stored dark choice wins over a light system preference', () => {
  const page = runPage({ prefersDark: false, stored: { 'nick-theme': 'dark' } });
  expectDark(page);
});

test('a stored light choice wins over a dark system preference', () => {
  const page = runPage({ prefersDark: true, stored: { 'nick-theme': 'light' } });
  expectLight(page);
});

test('toggling from the dark default switches to light and persists the choice', () => {
  const page = runPage({ prefersDark: false });
  page.themeToggle.listeners.click();
  expectLight(page);
  assert.equal(page.store['nick-theme'], 'light');
});

test('toggling from a stored light choice switches to dark and persists the choice', () => {
  const page = runPage({ stored: { 'nick-theme': 'light' } });
  page.themeToggle.listeners.click();
  expectDark(page);
  assert.equal(page.store['nick-theme'], 'dark');
});

test('toggling twice returns to the original theme', () => {
  const page = runPage({ stored: { 'nick-theme': 'light' } });
  page.themeToggle.listeners.click();
  page.themeToggle.listeners.click();
  expectLight(page);
  assert.equal(page.store['nick-theme'], 'light');
});

test('storage failures never break theme setup or toggling', () => {
  const themeLabel = makeElement();
  const themeIcon = makeElement();
  const themeToggle = makeElement();
  themeToggle.querySelector = (selector) => (selector === '.theme-label' ? themeLabel : themeIcon);
  const document = {
    body: { dataset: {} },
    querySelector(selector) {
      if (selector === '.theme-toggle') return themeToggle;
      return makeElement();
    },
    querySelectorAll() { return []; },
  };
  const window = {
    location: { hostname: 'nickcaplan.github.io' },
    localStorage: {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  vm.runInNewContext(pageScript, { document, window }, { timeout: 1000 });
  assert.equal(document.body.dataset.theme, 'dark', 'falls back to the dark default when storage is unavailable');
  themeToggle.listeners.click();
  assert.equal(document.body.dataset.theme, 'light', 'toggling still works without storage');
});
