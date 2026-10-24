// Content and structure checks for index.html - no dependencies.
// Guards the page's metadata, links, images, form and accessibility hooks.
// Usage: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
const images = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);

function attr(tag, name) {
  const match = tag.match(new RegExp(` ${name}="([^"]*)"`));
  return match ? match[1] : null;
}

test('document shell: doctype, language, title and viewport', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en">/);
  const title = html.match(/<title>([^<]+)<\/title>/);
  assert.ok(title && title[1].trim().length > 0, 'title is present and non-empty');
  assert.match(html, /<meta name="viewport" content="[^"]*width=device-width[^"]*">/);
});

test('social metadata is present for link previews', () => {
  for (const property of ['og:title', 'og:description', 'og:image', 'og:url']) {
    assert.match(html, new RegExp(`<meta property="${property}" content="[^"]+"`), `${property} is set`);
  }
  for (const name of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    assert.match(html, new RegExp(`<meta name="${name}" content="[^"]+"`), `${name} is set`);
  }
  assert.match(html, /<meta name="description" content="[^"]+"/);
});

test('there is exactly one inline script and it parses', () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  new vm.Script(scripts[0][1]);
});

test('every navigation anchor points at an element that exists', () => {
  const fragmentHrefs = anchors
    .map((tag) => attr(tag, 'href'))
    .filter((href) => href && href.startsWith('#'));
  assert.ok(fragmentHrefs.length > 0, 'page has fragment navigation');
  for (const href of fragmentHrefs) {
    assert.ok(ids.includes(href.slice(1)), `${href} resolves to an existing id`);
  }
});

test('all element ids are unique', () => {
  const seen = new Set();
  for (const id of ids) {
    assert.ok(!seen.has(id), `duplicate id "${id}"`);
    seen.add(id);
  }
});

test('every image has alt text and a file that exists', () => {
  assert.ok(images.length > 0, 'page has images');
  for (const tag of images) {
    const alt = attr(tag, 'alt');
    assert.ok(alt && alt.trim().length > 0, `image has alt text: ${tag.slice(0, 80)}`);
    const src = attr(tag, 'src');
    assert.ok(src, 'image has a src');
    if (!src.startsWith('http')) {
      assert.ok(existsSync(join(root, src)), `${src} exists in the repo`);
    }
  }
});

test('external links use https, and new-tab links neutralise opener access', () => {
  const external = anchors.filter((tag) => (attr(tag, 'href') || '').startsWith('http'));
  assert.ok(external.length > 0, 'page has external links');
  for (const tag of external) {
    assert.ok(attr(tag, 'href').startsWith('https://'), `https link: ${attr(tag, 'href')}`);
    if (attr(tag, 'target') === '_blank') {
      assert.match(attr(tag, 'rel') || '', /noreferrer/, `rel=noreferrer on ${attr(tag, 'href')}`);
    }
  }
});

test('social preview images point at files that exist in the repo', () => {
  const metas = [...html.matchAll(/<meta\b[^>]*(?:og:image|twitter:image)[^>]*>/g)].map((m) => m[0]);
  assert.ok(metas.length >= 2, 'og:image and twitter:image present');
  for (const tag of metas) {
    const content = attr(tag, 'content');
    const localPath = content.replace('https://nicholascaplan.github.io/profile/', '');
    assert.ok(existsSync(join(root, localPath)), `${localPath} exists in the repo`);
  }
});

test('contact form posts securely and every field is labelled and required', () => {
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

test('toggle buttons ship with accessible names and pressed state', () => {
  for (const cls of ['theme-toggle', 'mobile-toggle']) {
    const button = html.match(new RegExp(`<button[^>]*class="${cls}"[^>]*>`));
    assert.ok(button, `${cls} exists`);
    assert.ok(attr(button[0], 'aria-label'), `${cls} has an aria-label`);
    assert.ok(attr(button[0], 'aria-pressed'), `${cls} has aria-pressed`);
  }
});

test('aria reference attributes resolve to existing ids', () => {
  const refs = [...html.matchAll(/ aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    for (const id of ref.split(/\s+/)) {
      assert.ok(ids.includes(id), `aria-labelledby target "${id}" exists`);
    }
  }
});
