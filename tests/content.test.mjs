// Content and structure checks for the site's pages - no dependencies.
// Guards each page's metadata, links, images and accessibility hooks; the
// contact page additionally gets the form checks.
// Usage: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'experience/index.html', 'contact/index.html', 'privacy/index.html'];
const read = (page) => readFileSync(join(root, page), 'utf8');

function attr(tag, name) {
  const match = tag.match(new RegExp(` ${name}="([^"]*)"`));
  return match ? match[1] : null;
}

for (const page of pages) {
  const html = read(page);
  const dir = dirname(join(root, page));
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);

  test(`${page}: document shell - doctype, language, title and viewport`, () => {
    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /<html lang="en">/);
    const title = html.match(/<title>([^<]+)<\/title>/);
    assert.ok(title && title[1].trim().length > 0, 'title is present and non-empty');
    assert.match(html, /<meta name="viewport" content="[^"]*width=device-width[^"]*">/);
  });

  test(`${page}: social metadata is present for link previews`, () => {
    for (const property of ['og:title', 'og:description', 'og:image', 'og:url']) {
      assert.match(html, new RegExp(`<meta property="${property}" content="[^"]+"`), `${property} is set`);
    }
    for (const name of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
      assert.match(html, new RegExp(`<meta name="${name}" content="[^"]+"`), `${name} is set`);
    }
    assert.match(html, /<meta name="description" content="[^"]+"/);
  });

  test(`${page}: exactly one h1`, () => {
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  });

  test(`${page}: all element ids are unique`, () => {
    const seen = new Set();
    for (const id of ids) {
      assert.ok(!seen.has(id), `duplicate id "${id}"`);
      seen.add(id);
    }
  });

  test(`${page}: every internal link resolves to a page that exists`, () => {
    const internal = anchors
      .map((tag) => attr(tag, 'href'))
      .filter((href) => href && !href.startsWith('http') && !href.startsWith('#'));
    assert.ok(internal.length > 0, 'page links to other pages');
    for (const href of internal) {
      const target = join(dir, href);
      const resolved = existsSync(target) && !target.endsWith('.html') ? join(target, 'index.html') : target;
      assert.ok(existsSync(resolved), `${href} resolves to an existing page`);
    }
  });

  test(`${page}: every image has alt text and a file that exists`, () => {
    for (const tag of images) {
      const alt = attr(tag, 'alt');
      assert.ok(alt !== null, `image has an alt attribute: ${tag.slice(0, 80)}`);
      const src = attr(tag, 'src');
      assert.ok(src, 'image has a src');
      if (!src.startsWith('http')) {
        assert.ok(existsSync(join(dir, src)), `${src} exists in the repo`);
      }
    }
  });

  test(`${page}: external links use https, and new-tab links neutralise opener access`, () => {
    const external = anchors.filter((tag) => (attr(tag, 'href') || '').startsWith('http'));
    assert.ok(external.length > 0, 'page has external links');
    for (const tag of external) {
      assert.ok(attr(tag, 'href').startsWith('https://'), `https link: ${attr(tag, 'href')}`);
      if (attr(tag, 'target') === '_blank') {
        assert.match(attr(tag, 'rel') || '', /noreferrer/, `rel=noreferrer on ${attr(tag, 'href')}`);
      }
    }
  });

  test(`${page}: social preview images point at files that exist in the repo`, () => {
    const metas = [...html.matchAll(/<meta\b[^>]*(?:og:image|twitter:image)[^>]*>/g)].map((m) => m[0]);
    assert.ok(metas.length >= 2, 'og:image and twitter:image present');
    for (const tag of metas) {
      const content = attr(tag, 'content');
      const localPath = content.replace('https://websitesbynick.co.uk/', '');
      assert.ok(existsSync(join(root, localPath)), `${localPath} exists in the repo`);
    }
  });

  test(`${page}: toggle buttons ship with accessible names and pressed state`, () => {
    for (const cls of ['theme-toggle', 'mobile-toggle']) {
      const button = html.match(new RegExp(`<button[^>]*class="${cls}"[^>]*>`));
      assert.ok(button, `${cls} exists`);
      assert.ok(attr(button[0], 'aria-label'), `${cls} has an aria-label`);
      assert.ok(attr(button[0], 'aria-pressed'), `${cls} has aria-pressed`);
    }
  });

  test(`${page}: nav marks the current page`, () => {
    if (page !== 'privacy/index.html') assert.match(html, /aria-current="page"/);
    else assert.match(html, /Privacy &amp; cookies/);
  });

  test(`${page}: nav chips match across pages - no subtitles`, () => {
    const chips = html.match(/<div class="nav-chips"[\s\S]*?<\/div>/);
    assert.ok(chips, 'nav-chips block exists');
    assert.ok(!/<small/.test(chips[0]), 'chips carry no subtitles on any page');
    const labels = [...chips[0].matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)].map((m) => m[1].trim());
    assert.deepEqual(labels, ['Work', 'Experience', 'Contact']);
  });

  test(`${page}: aria reference attributes resolve to existing ids`, () => {
    const refs = [...html.matchAll(/ aria-(?:labelledby|describedby)="([^"]+)"/g)].map((m) => m[1]);
    for (const ref of refs) {
      for (const id of ref.split(/\s+/)) {
        assert.ok(ids.includes(id), `aria-labelledby target "${id}" exists`);
      }
    }
  });

  test(`${page}: every showcase data source file exists`, () => {
    const dataSrcs = [...html.matchAll(/ data-src-(?:desk|mob)(?:-dark)?="([^"]+)"/g)].map((m) => m[1]);
    for (const src of dataSrcs) {
      assert.ok(existsSync(join(dir, src)), `${src} exists in the repo`);
    }
  });
}

test('home page carries the showcase imagery', () => {
  const html = read('index.html');
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(images.filter((tag) => /class="shot-img shot-desk"/.test(tag)).length, 2, 'each project has a desktop overview');
  assert.equal(images.filter((tag) => /class="shot-img shot-mob"/.test(tag)).length, 2, 'each project has a phone inset');
  assert.equal([...html.matchAll(/class="thumb(?: sel)?"/g)].length, 6, 'three labelled page choices per project');
  assert.doesNotMatch(html, /class="(?:m-step|teaser)"|Tap to enlarge|thumb-desk|thumb-mob/, 'no duplicate gallery controls or closing contact panel');
  assert.match(html, /class="intro-contact" href="contact\/"/, 'an early enquiry link is present');
  assert.equal([...html.matchAll(/class="case-role"/g)].length, 2, 'each project explains Nick’s role');
  for (const article of html.matchAll(/<article class="case[^\"]*"[\s\S]*?<\/article>/g)) {
    assert.match(article[0], /<header class="case-heading">[\s\S]*?<h2[\s\S]*?<div class="case-shot">[\s\S]*?<div class="case-copy">/, 'project reading order is heading, imagery, details');
  }
});

test('contact page: form posts securely and every field is labelled and required', () => {
  const html = read('contact/index.html');
  const form = html.match(/<form\b[^>]*>/);
  assert.ok(form, 'contact form exists');
  assert.match(attr(form[0], 'action') || '', /^https:\/\//);
  assert.equal(attr(form[0], 'method'), 'POST');

  const fields = [...html.matchAll(/<(?:input|textarea)\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(fields.length >= 3, 'name, email and message fields present');
  for (const field of fields) {
    const id = attr(field, 'id');
    assert.ok(id, `field has an id: ${field.slice(0, 60)}`);
    assert.ok(html.includes(`<label for="${id}">`), `label exists for ${id}`);
    assert.ok(field.includes('required'), `${id} is required`);
  }
  assert.match(html, /<button[^>]*type="submit"/);
});

test('shared scripts parse', () => {
  for (const script of ['assets/js/site.js', 'assets/js/showcase.js', 'assets/js/analytics.js']) {
    new vm.Script(readFileSync(join(root, script), 'utf8'), { filename: script });
  }
});

test('pages carry no inline behaviour beyond the shared first-paint bootstrap', () => {
  const bootstrap = read('index.html').match(/<script>(?!\s*<\/script>)[\s\S]*?<\/script>/)[0];
  for (const page of pages) {
    const inline = [...read(page).matchAll(/<script>(?!\s*<\/script>)[\s\S]*?<\/script>/g)].map((m) => m[0]);
    assert.equal(inline.length, 1, `${page} carries exactly one inline bootstrap`);
    assert.equal(inline[0], bootstrap, `${page} bootstrap matches the shared first-paint setup`);
  }
});
