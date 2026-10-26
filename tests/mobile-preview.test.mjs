// Behaviour checks for the theme and mobile preview logic in index.html.
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
    removed: false,
    listeners: {},
    title: '',
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    remove() { this.removed = true; },
  };
}

// Runs the page script with a chosen hostname, viewport width and stored prefs,
// and returns the resulting state for assertions.
function runPage({ hostname, viewportWidth, stored = {} }) {
  const themeToggle = makeElement();
  themeToggle.querySelector = () => makeElement();
  const mobileToggle = makeElement();
  const store = { ...stored };
  const mediaQueries = [];

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
    location: { hostname },
    localStorage: {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, value) => { store[key] = String(value); },
    },
    matchMedia(query) {
      const media = {
        get matches() {
          return query.includes('max-width')
            ? viewportWidth <= parseInt(query.match(/\d+/)[0], 10)
            : false;
        },
        listeners: [],
        addEventListener(type, listener) {
          if (type === 'change') this.listeners.push(listener);
        },
      };
      mediaQueries.push(media);
      return media;
    },
  };

  vm.runInNewContext(pageScript, { document, window }, { timeout: 1000 });
  function resize(width) {
    const previous = mediaQueries.map((media) => media.matches);
    viewportWidth = width;
    mediaQueries.forEach((media, index) => {
      if (media.matches !== previous[index]) {
        for (const listener of media.listeners) listener({ matches: media.matches });
      }
    });
  }
  return { body: document.body, themeToggle, mobileToggle, store, resize };
}

const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]', ''];
const PREVIEW_HOSTNAMES = [
  ...LOCAL_HOSTNAMES,
  'deploy-preview-4--nickcaplan-profile.netlify.app',
  'deploy-preview-123--another-site.netlify.app',
];
const DEPLOYED_HOSTNAMES = [
  'websitesbynick.co.uk',
  'www.example.com',
  'nickcaplan-profile.netlify.app',
  'deploy-preview-4--nickcaplan-profile.netlify.app.example.com',
];

test('local hosts and Netlify deploy previews keep the mobile preview toggle', () => {
  for (const hostname of PREVIEW_HOSTNAMES) {
    const { mobileToggle } = runPage({ hostname, viewportWidth: 1440 });
    assert.equal(mobileToggle.removed, false, `toggle should stay on ${hostname || 'file://'}`);
  }
});

test('preview hosts default to the viewport and persist manual layout changes', () => {
  for (const hostname of PREVIEW_HOSTNAMES) {
    for (const viewportWidth of [390, 1440]) {
      const page = runPage({ hostname, viewportWidth });
      assert.equal(page.body.dataset.mobile, String(viewportWidth <= 600));
      assert.equal(page.body.dataset.preview, 'false', 'viewport alone never enables a preview frame');
      assert.equal('nick-mobile' in page.store, false, 'viewport default is not persisted before a manual toggle');
      page.mobileToggle.listeners.click();
      assert.equal(page.body.dataset.mobile, String(viewportWidth > 600));
      assert.equal(page.body.dataset.preview, String(viewportWidth > 600));
      assert.equal(page.store['nick-mobile'], String(viewportWidth > 600));
    }
  }
});

test('deployed hosts remove the mobile preview toggle', () => {
  for (const hostname of DEPLOYED_HOSTNAMES) {
    const { mobileToggle } = runPage({ hostname, viewportWidth: 1440 });
    assert.equal(mobileToggle.removed, true, `toggle should be removed on ${hostname}`);
  }
});

test('local hosts honour the stored mobile choice over the viewport', () => {
  const wide = runPage({ hostname: 'localhost', viewportWidth: 1440, stored: { 'nick-mobile': 'true' } });
  assert.equal(wide.body.dataset.mobile, 'true', 'stored mobile=true should win on a wide local viewport');

  const narrow = runPage({ hostname: 'localhost', viewportWidth: 390, stored: { 'nick-mobile': 'false' } });
  assert.equal(narrow.body.dataset.mobile, 'false', 'stored mobile=false should win on a narrow local viewport');
});

test('deployed hosts ignore the stored mobile choice and follow the viewport', () => {
  const wide = runPage({ hostname: 'websitesbynick.co.uk', viewportWidth: 1440, stored: { 'nick-mobile': 'true' } });
  assert.equal(wide.body.dataset.mobile, 'false', 'stored mobile=true must be ignored on a wide deployed viewport');

  const narrow = runPage({ hostname: 'websitesbynick.co.uk', viewportWidth: 390, stored: { 'nick-mobile': 'false' } });
  assert.equal(narrow.body.dataset.mobile, 'true', 'stored mobile=false must be ignored on a narrow deployed viewport');
});

test('deployed hosts do not persist a mobile choice', () => {
  const { store } = runPage({ hostname: 'websitesbynick.co.uk', viewportWidth: 390 });
  assert.equal('nick-mobile' in store, false, 'no nick-mobile value should be written off local hosts');
});

test('deployed hosts follow breakpoint changes without reloading or persisting a choice', () => {
  for (const hostname of DEPLOYED_HOSTNAMES) {
    for (const viewportWidth of [390, 1440]) {
      const page = runPage({ hostname, viewportWidth, stored: { 'nick-mobile': 'true' } });
      for (const width of [1280, 768, 601, 600, 1440, 390]) {
        page.resize(width);
        assert.equal(page.body.dataset.mobile, String(width <= 600), `${hostname} follows a resize to ${width}px`);
        assert.equal(page.body.dataset.preview, 'false', 'a public viewport never creates a preview frame');
        assert.equal(page.mobileToggle.removed, true);
        assert.equal(page.store['nick-mobile'], 'true', 'resizing must not overwrite a stored local preview choice');
      }
    }
  }
});

test('local and Netlify preview choices remain unchanged on resize and can still be toggled', () => {
  for (const hostname of PREVIEW_HOSTNAMES) {
    for (const choice of ['true', 'false']) {
      const page = runPage({ hostname, viewportWidth: 1440, stored: { 'nick-mobile': choice } });
      page.resize(390);
      page.resize(1440);
      assert.equal(page.body.dataset.mobile, choice, 'resize preserves the local preview override');
      assert.equal(page.store['nick-mobile'], choice);
      page.mobileToggle.listeners.click();
      const toggled = String(choice !== 'true');
      assert.equal(page.body.dataset.mobile, toggled);
      assert.equal(page.store['nick-mobile'], toggled);
      page.resize(390);
      assert.equal(page.body.dataset.mobile, toggled, 'resize preserves the toggled preview choice');
    }
  }
});

test('unmodified local and Netlify previews follow viewport changes without creating a frame', () => {
  for (const hostname of PREVIEW_HOSTNAMES) {
    const page = runPage({ hostname, viewportWidth: 1440 });
    for (const width of [768, 600, 390, 1280]) {
      page.resize(width);
      assert.equal(page.body.dataset.mobile, String(width <= 600));
      assert.equal(page.body.dataset.preview, 'false');
      assert.equal('nick-mobile' in page.store, false);
    }
  }
});

test('theme defaults to dark for new visitors and persists only manual choices', () => {
  const { body, themeToggle, store } = runPage({ hostname: 'websitesbynick.co.uk', viewportWidth: 1440 });
  assert.equal(body.dataset.theme, 'dark', 'new visitors get dark by default');
  assert.equal('nick-theme' in store, false, 'no theme is written before a manual toggle');
  themeToggle.listeners.click();
  assert.equal(body.dataset.theme, 'light');
  assert.equal(store['nick-theme'], 'light');
  themeToggle.listeners.click();
  assert.equal(body.dataset.theme, 'dark');
  assert.equal(store['nick-theme'], 'dark');
});

test('a stored theme choice wins over the dark default', () => {
  for (const theme of ['light', 'dark']) {
    const { body, store } = runPage({ hostname: 'websitesbynick.co.uk', viewportWidth: 1440, stored: { 'nick-theme': theme } });
    assert.equal(body.dataset.theme, theme);
    assert.equal(store['nick-theme'], theme, 'stored choice is left untouched');
  }
});
