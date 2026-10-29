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
  const images = [...html.replace(/<template\b[\s\S]*?<\/template>/g, '').matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);

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

  test(`${page}: GitHub footer uses the concise label and keeps its icon attached`, () => {
    assert.match(html, /<span class="cta-label">Check it out on <span class="cta-end">GitHub <svg class="github-icon"/);
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

  test(`${page}: favicon set is linked and every referenced file exists`, () => {
    const head = html.match(/<head>[\s\S]*?<\/head>/)[0];
    const tags = [...head.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);
    const byRel = (rel) => tags.filter((t) => (attr(t, 'rel') || '').split(/\s+/).includes(rel));
    const svg = byRel('icon').find((t) => (attr(t, 'href') || '').endsWith('.svg'));
    const ico = byRel('icon').find((t) => (attr(t, 'href') || '').endsWith('.ico'));
    const touch = byRel('apple-touch-icon')[0];
    const manifest = byRel('manifest')[0];
    assert.ok(svg, 'svg favicon linked');
    assert.ok(ico, 'ico fallback linked');
    const iconData = readFileSync(join(dir, attr(ico, 'href')));
    assert.equal(iconData.readUInt16LE(0), 0, 'ICO reserved header');
    assert.equal(iconData.readUInt16LE(2), 1, 'ICO image type');
    const count = iconData.readUInt16LE(4);
    assert.ok(count > 0, 'ICO has images');
    const sizes = Array.from({ length: count }, (_, i) => {
      const offset = 6 + i * 16;
      return `${iconData[offset] || 256}x${iconData[offset + 1] || 256}`;
    });
    assert.deepEqual(sizes.sort(), ['16x16', '32x32', '48x48'], 'ICO contains the required fixed image sizes');
    assert.deepEqual((attr(ico, 'sizes') || '').split(/\s+/).sort(), sizes.sort(), 'ICO size hints match its fixed image entries');
    assert.ok(touch, 'apple-touch-icon linked');
    assert.ok(manifest, 'web manifest linked');
    for (const tag of [svg, ico, touch, manifest]) {
      const href = attr(tag, 'href');
      assert.ok(existsSync(join(dir, href)), `${href} exists in the repo`);
    }
    assert.match(html, /<meta name="theme-color" content="#18211d">/, 'theme-color matches the atelier dark background');
  });
}

test('home page carries the showcase imagery', () => {
  const html = read('index.html');
  const images = [...html.replace(/<template\b[\s\S]*?<\/template>/g, '').matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(images.filter((tag) => /class="shot-img shot-desk"/.test(tag)).length, 2, 'each project has a desktop overview');
  assert.equal(images.filter((tag) => /class="shot-img shot-mob"/.test(tag)).length, 2, 'each project has a phone inset');
  assert.equal([...html.matchAll(/class="thumb(?: sel)?"/g)].length, 7, 'four FOA choices and three Sam choices');
  assert.doesNotMatch(html, /class="(?:m-step|teaser)"|Tap to enlarge|thumb-desk|thumb-mob/, 'no duplicate gallery controls or closing contact panel');
  assert.match(html, /class="intro-contact" href="contact\/"/, 'an early enquiry link is present');
  assert.doesNotMatch(html, /class="case-role"|My role:/, 'projects omit the redundant role copy');
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


test('every public page uses the approved portfolio stream, never the FOA stream', () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<script src="(?:\.\.\/)?assets\/js\/analytics\.js" defer data-measurement-id="G-J3J3NS19ZS"><\/script>/);
    assert.doesNotMatch(html, /G-V2X8ZMQ5XZ/);
  }
});


test('analytics registers its cross-tab withdrawal handler only once', () => {
  const script = read('assets/js/analytics.js');
  assert.equal((script.match(/window\.addEventListener\('storage'/g) || []).length, 1);
});


test('experience page: pre-NatWest roles foreground website delivery', () => {
  const html = read('experience/index.html');
  const roles = [...html.matchAll(/<article class="role">[\s\S]*?<\/article>/g)].map((m) => m[0]);
  const byTitle = (name) => roles.find((r) => (r.match(/<h3 class="role-title">([^<]+)<\/h3>/) || [])[1]?.includes(name)) || '';
  // Nick's direction (26 October 2026): the earlier roles lead with the
  // website-building angle; the 100,000+ visitors and 2-to-23 states figures
  // come from his original CV copy. The NatWest Boxed entry stays unchanged.
  assert.match(byTitle('Oddschecker'), /website serving 100,000\+ monthly visitors/);
  assert.match(byTitle('Oddschecker'), /Scaled the website from 2 to 23 US state jurisdictions/);
  assert.match(byTitle('Moogsoft'), /web platform/);
  assert.match(byTitle('Alfa'), /enterprise web platform/);
  assert.match(byTitle('NatWest Boxed'), /Core banking platforms, customer onboarding and account services/);
});

test('web manifest icons exist in the repo', () => {
  const manifest = JSON.parse(read('site.webmanifest'));
  assert.ok(manifest.icons.length >= 2, '192 and 512 icons declared');
  for (const icon of manifest.icons) {
    assert.ok(existsSync(join(root, icon.src)), `${icon.src} exists in the repo`);
  }
});
