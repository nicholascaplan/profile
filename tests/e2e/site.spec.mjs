// Browser checks for the three-page site (home / experience / contact) across
// Chromium, Firefox, WebKit and mobile Chrome.
// Usage: npx playwright test   (npm run test:e2e)

import { test } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const shotsDir = join(process.cwd(), 'test-results', 'screenshots');
async function shot(page, name, project) {
  mkdirSync(shotsDir, { recursive: true });
  await page.screenshot({ path: join(shotsDir, `${name}-${project}.png`) });
}

// WCAG contrast ratio of the hero/muted body text against the page background.
function heroTextContrast() {
  const lum = (rgb) => {
    const c = rgb.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map((v) => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const bg = getComputedStyle(document.body).backgroundColor;
  const text = getComputedStyle(document.querySelector('.hero p, .page-hero p, main p')).color;
  const a = lum(bg); const b = lum(text);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// The site settles its theme colours over a 0.45s transition; always wait past it
// before reading computed colours or screenshots.
const settle = (page) => page.waitForTimeout(1100);

// Desktop checks run at 1440x900. Public phone styling starts at 600px;
// the fixed preview frame requires an explicit development-toggle choice.
const DESKTOP = { width: 1440, height: 900 };
const desktopOnly = (isMobile) => test.skip(isMobile, 'desktop chrome and keyboard check');

// Text enlargement emulation: double every px font-size in the shared
// stylesheet (the site's fonts are all px; unitless line-heights scale with
// them) while the layout viewport stays the same width, matching browser
// text-only zoom.
async function enlargeText(page) {
  await page.evaluate(async () => {
    const link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => l.href.includes('/assets/css/site.css'));
    const css = await (await fetch(link.href)).text();
    const doubled = css.replace(/(font-size\s*:\s*)([^;}]+)/g,
      (all, prop, val) => prop + val.replace(/(\d+(?:\.\d+)?)px/g, (m, n) => (parseFloat(n) * 2) + 'px'));
    const s = document.createElement('style');
    s.textContent = doubled;
    document.head.appendChild(s);
  });
}

test('desktop: dark by default, toggle switches to light with sufficient contrast', async ({ page, isMobile }, testInfo) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  const state = await page.evaluate(() => ({
    visibleH1: [...document.querySelectorAll('h1')].filter((h) => h.offsetParent !== null).length,
    theme: document.body.dataset.theme,
    pressed: document.querySelector('.theme-toggle').getAttribute('aria-pressed'),
    label: document.querySelector('.theme-toggle').getAttribute('aria-label'),
    hasMobileToggle: !!document.querySelector('.mobile-toggle'),
  }));
  assert.equal(state.visibleH1, 1, 'exactly one h1 is rendered');
  assert.equal(state.theme, 'dark', 'new visitors get the dark theme by default');
  assert.equal(state.pressed, 'true');
  assert.equal(state.label, 'Switch to light mode');
  assert.equal(state.hasMobileToggle, true, 'mobile preview toggle present on a local host');
  await page.locator('.theme-toggle').click();
  await settle(page);
  const light = await page.evaluate(() => {
    const lum = (rgb) => {
      const c = rgb.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map((v) => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const bg = lum(getComputedStyle(document.body).backgroundColor);
    const fg = lum(getComputedStyle(document.querySelector('.hero h1')).color);
    return {
      theme: document.body.dataset.theme,
      pressed: document.querySelector('.theme-toggle').getAttribute('aria-pressed'),
      headlineContrast: (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05),
    };
  });
  assert.equal(light.theme, 'light', 'toggle switches a new visitor to light');
  assert.equal(light.pressed, 'false');
  assert.ok(light.headlineContrast >= 4.5, `light theme headline contrast ${light.headlineContrast.toFixed(2)}:1 meets 4.5:1`);
  await shot(page, 'browser-desktop-light', testInfo.project.name);
});

test('dark system preference: page opens dark and the toggle shows it', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await settle(page);
  const state = await page.evaluate(() => ({
    theme: document.body.dataset.theme,
    pressed: document.querySelector('.theme-toggle').getAttribute('aria-pressed'),
    label: document.querySelector('.theme-toggle .theme-label').textContent,
  }));
  assert.equal(state.theme, 'dark');
  assert.equal(state.pressed, 'true');
  assert.equal(state.label, 'Light mode');
  const contrast = await page.evaluate(heroTextContrast);
  assert.ok(contrast >= 4.5, `dark theme body text contrast ${contrast.toFixed(2)}:1 meets 4.5:1`);
  await shot(page, 'browser-desktop-dark', testInfo.project.name);
});

test('theme toggle: click switches to light, reload restores it', async ({ page, isMobile }, testInfo) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.locator('.theme-toggle').click();
  const after1 = await page.evaluate(() => ({ theme: document.body.dataset.theme, stored: localStorage.getItem('nick-theme') }));
  assert.equal(after1.theme, 'light');
  assert.equal(after1.stored, 'light');
  await settle(page);
  const renderedBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const renderedContrast = await page.evaluate(heroTextContrast);
  assert.equal(renderedBg, 'rgb(238, 233, 226)', 'light background is actually painted');
  assert.ok(renderedContrast >= 4.5, `light body text contrast ${renderedContrast.toFixed(2)}:1 meets 4.5:1`);
  await shot(page, 'browser-desktop-light-toggled', testInfo.project.name);
  await page.reload();
  await settle(page);
  const after2 = await page.evaluate(() => document.body.dataset.theme);
  assert.equal(after2, 'light', 'stored choice survives a reload');
});

test('theme and layout apply before first paint, before external scripts run', async ({ page }) => {
  // Delay the external scripts well past first paint; the inline bootstrap must
  // already hold the final theme and frame so the page never flashes.
  const prepaintState = () => ({
    bg: getComputedStyle(document.body).backgroundColor,
    theme: document.body.dataset.theme,
    mobile: document.body.dataset.mobile,
    shellWidth: Math.round(document.querySelector('.site-shell').getBoundingClientRect().width),
    siteJsRan: document.body.dataset.motion === 'on',
  });
  await page.route('**/assets/js/*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.continue();
  });
  const painted = () => page.waitForFunction(() => getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)');
  // Background can paint before the parser reaches .site-shell; wait for the node itself
  // (the delayed site.js route still holds, so the prepaint assertions keep their meaning).

  await page.setViewportSize(DESKTOP);
  await page.goto('/', { waitUntil: 'commit' });
  await painted();
  await page.waitForSelector('.site-shell', { state: 'attached' });
  const desktop = await page.evaluate(prepaintState);
  assert.equal(desktop.siteJsRan, false, 'external site.js has not run yet');
  assert.equal(desktop.theme, 'dark', 'dark default is set before first paint');
  assert.equal(desktop.bg, 'rgb(24, 33, 29)', 'dark background is the first thing painted');
  assert.equal(desktop.mobile, 'false');
  await page.waitForLoadState('load');
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'dark', 'site.js agrees with the bootstrap - no flip');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'commit' });
  await painted();
  await page.waitForSelector('.site-shell', { state: 'attached' });
  const phone = await page.evaluate(prepaintState);
  assert.equal(phone.siteJsRan, false, 'external site.js has not run yet');
  assert.equal(phone.mobile, 'true', 'phone frame is set before first paint');
  assert.equal(phone.shellWidth, 390, 'phone frame already fills the painted viewport');

  await page.addInitScript(() => { try { window.localStorage.setItem('nick-theme', 'light'); } catch (error) {} });
  await page.setViewportSize(DESKTOP);
  await page.goto('/', { waitUntil: 'commit' });
  await painted();
  await page.waitForSelector('.site-shell', { state: 'attached' });
  const stored = await page.evaluate(prepaintState);
  assert.equal(stored.siteJsRan, false, 'external site.js has not run yet');
  assert.equal(stored.theme, 'light', 'a stored light choice is set before first paint');
  assert.equal(stored.bg, 'rgb(238, 233, 226)', 'light background is the first thing painted');
  await page.waitForLoadState('load');
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'light', 'site.js agrees with the stored choice - no flip');
});

test('footer CTA: heading links to the contact action on every page', async ({ page }) => {
  await page.goto('/');
  assert.equal(await page.locator('.footer-cta').getAttribute('href'), 'contact/');
  await page.goto('/experience/');
  assert.equal(await page.locator('.footer-cta').getAttribute('href'), '../contact/');
  await page.goto('/contact/');
  const cta = page.locator('.footer-cta');
  assert.equal(await cta.getAttribute('href'), '#contact-form');
  await cta.click();
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => {
    const form = document.querySelector('#contact-form');
    const r = form.getBoundingClientRect();
    return { hash: window.location.hash, active: document.activeElement && document.activeElement.id, inView: r.top < window.innerHeight && r.bottom > 0 };
  });
  assert.equal(state.hash, '#contact-form');
  assert.equal(state.active, 'contact-form', 'focus moves to the form');
  assert.equal(state.inView, true, 'form scrolled into view');
});

test('navigation: every page is reachable by its real URL from the nav', async ({ page, isMobile }, testInfo) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.locator('.nav-links a[href="experience/"]').click();
  await page.waitForURL('**/experience/');
  assert.equal(await page.evaluate(() => document.querySelector('h1').textContent.trim()), 'Selected experience.');
  assert.equal(await page.evaluate(() => document.querySelector('.nav-links a[aria-current="page"]').textContent.trim()), 'Experience');
  await page.locator('.nav-links a[href="../contact/"]').click();
  await page.waitForURL('**/contact/');
  assert.equal(await page.evaluate(() => document.querySelector('h1').textContent.trim()), 'Have a website in mind?');
  await page.locator('.nav-links a[href="../"]').first().click();
  await page.waitForURL('**/');
  assert.match(await page.evaluate(() => document.querySelector('h1').textContent), /Websites that earn/);
  await shot(page, 'browser-nav-roundtrip', testInfo.project.name);
});

test('footer privacy stays bottom right with consistent small-print typography', async ({ page }) => {
  for (const path of ['/', '/experience/', '/contact/', '/privacy/']) {
    for (const width of [320, 698, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const footer = await page.locator('.footer-bottom').evaluate((el) => {
        const source = el.querySelector('.github-link');
        const privacy = el.querySelector('a[href$="privacy/"]');
        const rect = privacy.getBoundingClientRect();
        const bounds = el.getBoundingClientRect();
        const font = (node) => {
          const style = getComputedStyle(node);
          return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight, style.letterSpacing];
        };
        return {
          right: rect.right,
          edge: bounds.right,
          bottom: rect.bottom,
          sourceBottom: source.getBoundingClientRect().bottom,
          fonts: [font(source), font(privacy)],
          overflow: el.scrollWidth > el.clientWidth,
        };
      });
      assert.ok(Math.abs(footer.right - footer.edge) < 1, `privacy is right-aligned on ${path} at ${width}px`);
      assert.ok(footer.bottom >= footer.sourceBottom - 2, `privacy is on the bottom row on ${path} at ${width}px`);
      assert.deepEqual(footer.fonts[0], footer.fonts[1], 'footer links share the same typography');
      assert.equal(footer.overflow, false, 'footer does not overflow');
    }
  }
});

test('hero portrait grows on desktop without changing the tablet size', async ({ page }) => {
  for (const [width, expected] of [[1440, 320], [1024, 256], [768, 190]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const size = await page.locator('.hero-grid .portrait-wrap').evaluate((el) => el.getBoundingClientRect().width);
    assert.equal(size, expected, `portrait width at ${width}px`);
  }
});

test('hero heading keeps earn and their on the same line', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 390, 698, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const words = await page.locator('.hero h1').evaluate((heading) => {
      const node = heading.firstChild;
      return ['earn', 'their'].map((word) => {
        const start = node.textContent.indexOf(word);
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + word.length);
        const rect = range.getBoundingClientRect();
        return { top: rect.top, left: rect.left, right: rect.right };
      });
    });
    assert.equal(words[0].top, words[1].top, `earn their stays together at ${width}px`);
    assert.ok(words[0].left >= 0 && words[1].right <= width, `earn their fits at ${width}px`);
  }
});

test('keyboard: full page tab order reaches nav, toggles and hero actions', async ({ page, isMobile }) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  const seen = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const name = await page.evaluate(() => {
      const el = document.activeElement;
      return el.id || (typeof el.className === 'string' && el.className) || el.tagName;
    });
    if (seen.length > 3 && name === seen[0]) break;
    seen.push(name);
  }
  const joined = seen.join('|');
  for (const expected of ['wordmark', 'theme-toggle', 'mobile-toggle', 'button-primary']) {
    assert.ok(joined.includes(expected), `tab order reaches ${expected} (saw: ${joined.slice(0, 200)})`);
  }
});

test('keyboard: Enter on a nav link navigates, Enter and Space toggle the theme', async ({ page, isMobile }) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.locator('.nav-links a[href="experience/"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/experience/');

  await page.locator('.theme-toggle').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'light', 'Enter on the focused toggle switches the theme');

  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'dark', 'Space on the focused toggle switches back');
});

test('keyboard: contact form can be completed and submitted by keyboard (submission intercepted)', async ({ page, isMobile }) => {
  desktopOnly(isMobile);
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      window.__submitted = false;
      document.querySelector('.contact-form')?.addEventListener('submit', (e) => { e.preventDefault(); window.__submitted = true; });
    });
  });
  await page.setViewportSize(DESKTOP);
  await page.goto('/contact/');
  await page.locator('#contact-name').focus();
  await page.keyboard.type('Test Person');
  await page.keyboard.press('Tab');
  await page.keyboard.type('test@example.com');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Hello from the keyboard');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.className);
  assert.match(String(focused), /button|submit/, `keyboard flow ends on the submit button (focused: ${focused})`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => ({ submitted: window.__submitted, valid: document.querySelector('.contact-form').checkValidity() }));
  assert.equal(state.valid, true, 'form is valid after keyboard entry');
  assert.equal(state.submitted, true, 'Enter on the submit button fires submission (intercepted, nothing sent)');
});

for (const [name, path] of [['home', '/'], ['experience', '/experience/'], ['contact', '/contact/']]) {
  test(`mobile 390px (${name}): one visible h1, no horizontal scrolling, visible nav chips`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    const state = await page.evaluate(() => ({
      visibleH1: [...document.querySelectorAll('h1')].filter((h) => h.offsetParent !== null).length,
      mobileMode: document.body.dataset.mobile,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      chips: [...document.querySelectorAll('.nav-chips a')].filter((a) => a.offsetParent !== null).length,
      chipDelta: Math.max(...[...document.querySelectorAll('.nav-chips a')].filter((a) => a.offsetParent !== null).map((a) => {
        const range = document.createRange();
        range.selectNodeContents(a);
        const t = range.getBoundingClientRect();
        const b = a.getBoundingClientRect();
        return Math.abs((t.top + t.bottom) / 2 - (b.top + b.bottom) / 2);
      })),
      menuButton: !!document.querySelector('[aria-label*="menu" i], .hamburger'),
    }));
    assert.equal(state.visibleH1, 1, 'exactly one h1 is rendered');
    assert.equal(state.mobileMode, 'true', 'mobile layout active at 390px');
    assert.ok(state.overflow <= 1, `no horizontal scroll (overflow ${state.overflow}px)`);
    assert.equal(state.chips, 3, 'Work / Experience / Contact chips all visible on mobile');
    assert.ok(state.chipDelta <= 2, `chip labels vertically centred (delta ${state.chipDelta.toFixed(1)}px)`);
    assert.equal(state.menuButton, false, 'no hidden menu button');
    await settle(page);
    await shot(page, `browser-mobile-390-${name}`, testInfo.project.name);
  });
}

test('portrait: headline and portrait share the hero without overlap or horizontal scroll', async ({ page }, testInfo) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const r = await page.evaluate(() => {
      const h1 = document.querySelector('.hero h1');
      const p = document.querySelector('.hero .portrait');
      if (!h1 || !p || p.offsetParent === null) return { missing: true };
      const a = h1.getBoundingClientRect();
      const b = p.getBoundingClientRect();
      const overlap = !(b.right <= a.left || b.left >= a.right || b.bottom <= a.top || b.top >= a.bottom);
      return {
        overlap,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        portraitWidth: Math.round(b.width),
      };
    });
    assert.ok(!r.missing, `portrait renders at ${width}px`);
    assert.equal(r.overlap, false, `headline and portrait must not overlap at ${width}px`);
    assert.ok(r.overflow <= 1, `no horizontal scroll at ${width}px (overflow ${r.overflow}px)`);
  }
  await settle(page);
  await shot(page, 'browser-portrait-hero', testInfo.project.name);
});

test('responsive public layout: tablet and laptop widths stay fluid on every page', async ({ page, baseURL }) => {
  // Serve local files behind a non-preview hostname to exercise the same branch
  // as production, without depending on or modifying the real deployed site.
  await page.route('https://portfolio.example/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await page.request.get(`${baseURL}${url.pathname}`);
    await route.fulfill({ response });
  });
  await page.addInitScript(() => localStorage.setItem('nick-mobile', 'true'));
  for (const path of ['/', '/experience/', '/contact/']) {
    await page.goto(`https://portfolio.example${path}`);
    for (const width of [1280, 768, 600, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction((phone) => document.body.dataset.mobile === String(phone), width <= 600);
      const state = await page.evaluate(() => ({
        shell: document.querySelector('.site-shell').getBoundingClientRect().width,
        preview: document.body.dataset.preview,
        toggle: document.querySelector('.mobile-toggle'),
        overflow: document.documentElement.scrollWidth - innerWidth,
      }));
      assert.equal(state.shell, width, `${path} fills ${width}px without a preview frame`);
      assert.equal(state.preview, 'false');
      assert.equal(state.toggle, null);
      assert.ok(state.overflow <= 1, `${path} has no horizontal scroll at ${width}px`);
    }
  }
});

test('phone: work appears before details, body text is readable and headline wraps comfortably', async ({ page }) => {
  for (const width of [320, 360, 390, 600]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const state = await page.evaluate(() => {
      const caseEl = document.querySelector('.case');
      const heading = caseEl.querySelector('.case-heading').getBoundingClientRect();
      const image = caseEl.querySelector('.case-shot').getBoundingClientRect();
      const details = caseEl.querySelector('.case-copy').getBoundingClientRect();
      const h1 = document.querySelector('.hero h1');
      const range = document.createRange();
      range.selectNodeContents(h1);
      const text = range.getBoundingClientRect();
      const portrait = document.querySelector('.portrait').getBoundingClientRect();
      return {
        headingBeforeImage: heading.bottom <= image.top,
        imageBeforeDetails: image.bottom <= details.top,
        imageTop: image.top,
        font: parseFloat(getComputedStyle(caseEl.querySelector('p')).fontSize),
        headlineLines: h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight),
        portraitBeside: portrait.left >= text.right - 1,
        portraitWidth: portrait.width,
        contactLink: document.querySelector('.intro-contact').getBoundingClientRect().height,
      };
    });
    assert.ok(state.headingBeforeImage && state.imageBeforeDetails, `heading → image → details at ${width}px`);
    assert.ok(state.font >= 16, `project body copy is at least 16px at ${width}px`);
    assert.ok(state.headlineLines <= 5.1, `headline has at most five lines at ${width}px (saw ${state.headlineLines})`);
    assert.ok(state.portraitBeside, `portrait remains beside the painted headline at ${width}px`);
    assert.ok(state.imageTop < 800, `first project image appears within 800px at ${width}px (saw ${state.imageTop})`);
    assert.ok(state.contactLink >= 44, 'early enquiry link has a comfortable target');
    if (width === 320) assert.ok(state.portraitWidth < 90, 'portrait scales down on narrow screens');
  }
});

test('contact: mobile fields avoid focus zoom and the message hint is accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/contact/');
  const state = await page.evaluate(() => ({
    fonts: [...document.querySelectorAll('.form-field input, .form-field textarea')].map((el) => parseFloat(getComputedStyle(el).fontSize)),
    describedBy: document.querySelector('#contact-message').getAttribute('aria-describedby'),
    hint: document.querySelector('#message-hint').textContent,
  }));
  assert.ok(state.fonts.every((size) => size >= 16), 'all input text is at least 16px');
  assert.equal(state.describedBy, 'message-hint');
  assert.match(state.hint, /what would you like the website to achieve/);
});

test('closing contact copy has sufficient contrast in both themes', async ({ page }) => {
  await page.goto('/');
  for (const theme of ['dark', 'light']) {
    if (await page.evaluate(() => document.body.dataset.theme) !== theme) await page.locator('.theme-toggle').click();
    await settle(page);
    const contrast = await page.evaluate(() => {
      const luminance = (rgb) => {
        const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
          v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
        });
        return .2126 * r + .7152 * g + .0722 * b;
      };
      const a = luminance(getComputedStyle(document.querySelector('.footer-intro')).color);
      const b = luminance(getComputedStyle(document.querySelector('.footer')).backgroundColor);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    assert.ok(contrast >= 4.5, `${theme} footer body contrast ${contrast.toFixed(2)}:1 meets 4.5:1`);
  }
});

test('desktop mobile preview: content fits the frame and matches a phone layout', async ({ page, isMobile }, testInfo) => {
  desktopOnly(isMobile);
  const layout = () => {
    const shell = document.querySelector('.site-shell').getBoundingClientRect();
    const clipped = [...document.querySelectorAll('main h1, main h2, main h3, main p, main a, main input, main textarea, main .portrait')]
      .filter((el) => el.getClientRects().length)
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left < shell.left - 1 || r.right > shell.right + 1;
      })
      .map((el) => el.className || el.tagName);
    const structures = [...document.querySelectorAll('.hero, .role, .lower-grid, .contact-grid')].map((el) => {
      const css = getComputedStyle(el);
      return { display: css.display, columns: css.gridTemplateColumns };
    });
    const hero = document.querySelector('.hero');
    const range = document.createRange();
    range.selectNodeContents(hero.querySelector('h1'));
    const text = range.getBoundingClientRect();
    const portrait = hero.querySelector('.portrait').getBoundingClientRect();
    const overlap = !(portrait.right <= text.left || portrait.left >= text.right || portrait.bottom <= text.top || portrait.top >= text.bottom);
    return { width: shell.width, clipped, structures, overlap };
  };
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.locator('.mobile-toggle').click();
  assert.equal(await page.locator('.mobile-toggle').getAttribute('aria-pressed'), 'true');
  const preview = await page.evaluate(layout);
  assert.equal(preview.width, 430);
  assert.deepEqual(preview.clipped, [], 'content must fit inside the frame, not just avoid document scrollbars');
  assert.equal(preview.overlap, false, 'headline and portrait must not overlap in the phone-width frame');
  await shot(page, 'browser-desktop-mobile-preview', testInfo.project.name);

  await page.setViewportSize({ width: 430, height: DESKTOP.height });
  await page.reload();
  const phone = await page.evaluate(layout);
  assert.deepEqual(preview.structures, phone.structures, 'preview and phone use the same responsive layouts');
  assert.deepEqual(phone.clipped, []);

  await page.setViewportSize(DESKTOP);
  await page.reload();
  assert.equal(await page.locator('.mobile-toggle').getAttribute('aria-pressed'), 'true', 'preview persists across reloads');
  await page.locator('.mobile-toggle').click();
  assert.equal(await page.locator('.mobile-toggle').getAttribute('aria-pressed'), 'false');
  assert.ok((await page.locator('.site-shell').boundingBox()).width > 430, 'toggle restores the desktop width');
  assert.equal(await page.locator('.hero-grid').evaluate((el) => getComputedStyle(el).display), 'grid', 'desktop hero returns to columns');
});

test('200% text at a laptop viewport: no horizontal scrolling', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `no horizontal scroll at 720px effective width (overflow ${overflow}px)`);
  await settle(page);
  await shot(page, 'browser-zoom-720', testInfo.project.name);
});

test('light-theme muted body text has at least 4.5:1 contrast', async ({ page }) => {
  await page.addInitScript(() => { try { window.localStorage.setItem('nick-theme', 'light'); } catch (error) {} });
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  const contrast = await page.evaluate(heroTextContrast);
  assert.ok(contrast >= 4.5, `muted body text contrast ${contrast.toFixed(2)}:1 is below 4.5:1`);
});

test('showcase: thumbnails choose the screenshot, desktop', async ({ page, isMobile }, testInfo) => {
  desktopOnly(isMobile);
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await settle(page);
  const before = await page.evaluate(() => ({
    src: document.querySelector('.case:first-child .shot-desk').src,
    pill: document.querySelector('.case:first-child .pill').textContent,
  }));
  assert.match(before.src, /foa-home-desk-dark\.webp$/, 'homepage screenshot shown by default (page opens dark)');
  assert.equal(before.pill, 'Homepage', 'pill labels the default shot');
  await page.locator('.case:first-child .thumb:nth-child(2)').click();
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({
    src: document.querySelector('.case:first-child .shot-desk').src,
    mobSrc: document.querySelector('.case:first-child .shot-mob').src,
    pill: document.querySelector('.case:first-child .pill').textContent,
    pressed: document.querySelector('.case:first-child .thumb:nth-child(2)').getAttribute('aria-pressed'),
    otherPill: document.querySelector('.case:last-child .pill').textContent,
  }));
  assert.match(after.src, /foa-whatson-desk-dark\.webp$/, 'main screenshot swaps to the chosen page');
  assert.match(after.mobSrc, /foa-whatson-mob-dark\.webp$/, 'mobile variant swaps too');
  assert.equal(after.pill, 'What’s On', 'pill follows the choice');
  assert.equal(after.pressed, 'true', 'chosen thumbnail is pressed');
  assert.equal(after.otherPill, 'Homepage', 'the other card is untouched');
  await shot(page, 'browser-showcase-thumb-pick', testInfo.project.name);
});

test('showcase: mobile page choices are readable, keyboard-accessible and independent', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await settle(page);
  const first = '.case:first-child';
  const buttons = page.locator(`${first} .thumb`);
  assert.equal(await buttons.count(), 3);
  for (const [index, expected] of [[1, 'whatson'], [2, 'fundraising'], [0, 'home']]) {
    await buttons.nth(index).focus();
    await page.keyboard.press(index === 2 ? 'Space' : 'Enter');
    await page.waitForFunction((name) => document.querySelector('.case:first-child .shot-mob').currentSrc.includes(`foa-${name}-mob`), expected);
    const state = await page.evaluate(() => ({
      pressed: [...document.querySelectorAll('.case:first-child .thumb')].map((b) => b.getAttribute('aria-pressed')),
      other: document.querySelector('.case:last-child .shot-mob').currentSrc,
    }));
    assert.deepEqual(state.pressed, [0, 1, 2].map((j) => String(j === index)));
    assert.match(state.other, /sam-home-mob-dark\.webp$/, 'choosing a page does not change the other project');
  }
  await shot(page, 'browser-showcase-mobile-choices', testInfo.project.name);
});

test('showcase: composed overviews have a single readable set of controls at every width', async ({ page }) => {
  for (const width of [1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const state = await page.evaluate(() => ({
      shots: [...document.querySelectorAll('.shot-img')].filter((el) => el.offsetParent !== null).length,
      sizes: [...document.querySelectorAll('.thumb')].map((el) => ({ height: el.getBoundingClientRect().height, font: parseFloat(getComputedStyle(el.querySelector('span')).fontSize) })),
      duplicateControls: document.querySelectorAll('.m-step, .zoom-cue, .thumb img').length,
    }));
    assert.equal(state.shots, 4, `both device captures remain visible at ${width}px`);
    assert.equal(state.duplicateControls, 0, 'no competing arrows, thumbnail images or enlargement affordance');
    assert.equal(state.sizes.length, 6);
    for (const size of state.sizes) {
      assert.ok(size.height >= 44, `44px touch target at ${width}px`);
      assert.ok(size.font >= 12, `readable label at ${width}px`);
    }
  }
});

// Nick's rule (24 October 2026): a CTA symbol must never wrap away from the end
// of its label. Check every visible CTA with a symbol, narrow widths and enlarged text.
// Regression coverage for the paired screenshot swap (the composed card shows
// both shots, so a staggered change is visible): the desktop and mobile shots
// must change together, rapid choices must settle on the latest, and a failed
// image must not block the pair. Artificial per-image latency forces the
// windows open; assertions are on observable behaviour, not timing internals.
const pageOf = (file) => (file.match(/foa-(home|whatson|fundraising)-/) || [])[1] || '';
const shotPair = (page) => page.evaluate(() => ({
  desk: document.querySelector('.case:first-child .shot-desk').currentSrc.split('/').pop(),
  mob: document.querySelector('.case:first-child .shot-mob').currentSrc.split('/').pop(),
}));
const initialPairLoaded = () => {
  const d = document.querySelector('.case:first-child .shot-desk');
  const m = document.querySelector('.case:first-child .shot-mob');
  return d && m && d.complete && d.naturalWidth > 0 && m.complete && m.naturalWidth > 0;
};

test('showcase: screenshot pair swaps atomically under uneven image latency', async ({ page }) => {
  await page.route('**/assets/images/work/*-desk*.webp', async (route) => { await new Promise((r) => setTimeout(r, 700)); await route.continue(); });
  await page.route('**/assets/images/work/*-mob*.webp', async (route) => { await new Promise((r) => setTimeout(r, 100)); await route.continue(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(initialPairLoaded);
  await page.click('.case:first-child .thumb:nth-child(2)');
  const mismatches = [];
  for (let i = 0; i < 12; i++) {
    const pair = await shotPair(page);
    if (pageOf(pair.desk) !== pageOf(pair.mob)) mismatches.push(`${pair.desk} vs ${pair.mob}`);
    await page.waitForTimeout(80);
  }
  assert.deepEqual(mismatches, [], `pair changed at different times: ${mismatches.join('; ')}`);
  const finalPair = await shotPair(page);
  assert.equal(pageOf(finalPair.desk), 'whatson', 'desktop shot settled on the chosen page');
  assert.equal(pageOf(finalPair.mob), 'whatson', 'mobile shot settled on the chosen page');
});

test('showcase: rapid thumbnail changes settle on the latest choice', async ({ page }) => {
  await page.route('**/assets/images/work/*.webp', async (route) => { await new Promise((r) => setTimeout(r, 450)); await route.continue(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(initialPairLoaded);
  await page.click('.case:first-child .thumb:nth-child(2)');
  await page.waitForTimeout(120);
  await page.click('.case:first-child .thumb:nth-child(3)');
  await page.waitForFunction(() => {
    const d = document.querySelector('.case:first-child .shot-desk');
    const m = document.querySelector('.case:first-child .shot-mob');
    return d.currentSrc.includes('fundraising-desk') && m.currentSrc.includes('fundraising-mob');
  }, { timeout: 8000 });
  const state = await page.evaluate(() => ({
    pill: document.querySelector('.case:first-child .pill').textContent,
    selected: document.querySelector('.case:first-child .thumb.sel').textContent.trim(),
  }));
  assert.equal(state.pill, 'Fundraising', 'pill follows the latest choice');
  assert.equal(state.selected, 'Fundraising', 'selected label follows the latest choice');
});

test('showcase: a failed screenshot does not block the pair swap', async ({ page }) => {
  await page.route('**/assets/images/work/foa-fundraising-desk-dark.webp', (route) => route.fulfill({ status: 404, body: '' }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(initialPairLoaded);
  await page.click('.case:first-child .thumb:nth-child(3)');
  await page.waitForFunction(() => document.querySelector('.case:first-child .shot-mob').currentSrc.includes('fundraising-mob'), { timeout: 8000 });
  const state = await page.evaluate(() => ({
    deskSrc: document.querySelector('.case:first-child .shot-desk').currentSrc,
    deskAlt: document.querySelector('.case:first-child .shot-desk').alt,
    pill: document.querySelector('.case:first-child .pill').textContent,
  }));
  assert.ok(state.deskSrc.includes('fundraising-desk'), 'failed desktop image still commits its src');
  assert.match(state.deskAlt, /Fundraising/, 'alt text accompanies the failed image');
  assert.equal(state.pill, 'Fundraising');
});

test('showcase: screenshots follow the page light/dark theme', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await settle(page);
  const read = () => page.evaluate(() => {
    const first = document.querySelector('.case:first-child');
    const last = document.querySelector('.case:last-child');
    return {
      theme: document.body.dataset.theme,
      foaDesk: first.querySelector('.shot-desk').currentSrc.split('/').pop(),
      foaMob: first.querySelector('.shot-mob').currentSrc.split('/').pop(),
      foaSelected: first.querySelector('.thumb.sel').textContent.trim(),
      samDesk: last.querySelector('.shot-desk').currentSrc.split('/').pop(),
    };
  });
  const dark0 = await read();
  assert.equal(dark0.theme, 'dark', 'page opens dark by default');
  assert.equal(dark0.foaDesk, 'foa-home-desk-dark.webp', 'FOA shows its dark capture in dark mode');
  assert.equal(dark0.foaMob, 'foa-home-mob-dark.webp', 'mobile shot follows too');
  assert.equal(dark0.foaSelected, 'Homepage', 'page choice is labelled');
  assert.equal(dark0.samDesk, 'sam-home-desk-dark.webp', 'Sam shows its dark capture in dark mode too');
  await page.locator('button.theme-toggle').first().click();
  await page.waitForTimeout(300);
  const light = await read();
  assert.equal(light.theme, 'light');
  assert.equal(light.foaDesk, 'foa-home-desk.webp', 'FOA swaps to its light capture in light mode');
  assert.equal(light.foaMob, 'foa-home-mob.webp');
  assert.equal(light.foaSelected, 'Homepage', 'theme changes preserve the selected page');
  assert.equal(light.samDesk, 'sam-home-desk.webp', 'Sam swaps to its light capture in light mode');
  await page.locator('button.theme-toggle').first().click();
  await page.waitForTimeout(300);
  const dark1 = await read();
  assert.equal(dark1.foaDesk, 'foa-home-desk-dark.webp', 'toggling back restores the dark captures');
  assert.equal(dark1.samDesk, 'sam-home-desk-dark.webp', 'Sam dark captures return too');

  await page.locator('.case:first-child .thumb:nth-child(2)').click();
  const waitForSelectedPair = (suffix) => page.waitForFunction((ending) => {
    const first = document.querySelector('.case:first-child');
    return first.querySelector('.shot-desk').currentSrc.endsWith(`foa-whatson-desk${ending}.webp`)
      && first.querySelector('.shot-mob').currentSrc.endsWith(`foa-whatson-mob${ending}.webp`)
      && document.querySelector('.case:last-child .shot-desk').currentSrc.endsWith(`sam-home-desk${ending}.webp`);
  }, suffix);
  await waitForSelectedPair('-dark');

  for (const [theme, suffix] of [['light', ''], ['dark', '-dark']]) {
    await page.locator('.theme-toggle').click();
    await waitForSelectedPair(suffix);
    const selected = await read();
    assert.equal(selected.theme, theme);
    assert.equal(selected.foaDesk, `foa-whatson-desk${suffix}.webp`, `selected desktop capture follows ${theme} mode`);
    assert.equal(selected.foaMob, `foa-whatson-mob${suffix}.webp`, `selected mobile capture follows ${theme} mode`);
    assert.equal(selected.foaSelected, 'What’s On', 'theme changes preserve the selected page');
    assert.equal(await page.locator('.case:first-child .pill-label').textContent(), 'What’s On', 'displayed page label is preserved too');
    assert.equal(selected.samDesk, `sam-home-desk${suffix}.webp`, 'the other project keeps its own page selection');
  }
});

test('CTA symbols stay with the end of their label at narrow widths and enlarged text', async ({ page }, testInfo) => {
  const probe = () => {
    const bad = [];
    for (const el of document.querySelectorAll('.intro-contact, .hero-actions .button, .nav-contact, .case-copy .button, .contact-form button[type=submit], .github-link, .footer-cta')) {
      if (el.offsetParent === null) continue;
      const sym = el.querySelector('span[aria-hidden="true"], svg');
      if (!sym) continue;
      const textNodes = [];
      (function walk(n) {
        for (const c of n.childNodes) {
          if (c.nodeType === 3 && c.textContent.trim()) textNodes.push(c);
          else if (c.nodeType === 1 && c !== sym && !sym.contains(c)) walk(c);
        }
      })(el);
      if (!textNodes.length) continue;
      const range = document.createRange();
      range.selectNodeContents(textNodes[textNodes.length - 1]);
      const rects = [...range.getClientRects()];
      if (!rects.length) continue;
      const lastLine = rects[rects.length - 1];
      const sr = sym.getBoundingClientRect();
      const symMid = sr.top + sr.height / 2;
      const lineMid = lastLine.top + lastLine.height / 2;
      if (Math.abs(symMid - lineMid) > 4 || sr.left < lastLine.left) {
        bad.push({ cta: el.textContent.trim().slice(0, 30), symY: Math.round(symMid), lineY: Math.round(lineMid) });
      }
    }
    return bad;
  };
  const stranded = [];
  for (const path of ['/', '/contact/']) {
    for (const scenario of [{ width: 320, zoom: false }, { width: 390, zoom: false }, { width: 390, zoom: true }, { width: 320, zoom: true }]) {
      await page.setViewportSize({ width: scenario.width, height: 700 });
      await page.goto(path);
      if (scenario.zoom) await enlargeText(page);
      await settle(page);
      const bad = await page.evaluate(probe);
      for (const b of bad) stranded.push({ ...b, path, width: scenario.width, zoom: scenario.zoom });
      await shot(page, `browser-${scenario.width}${scenario.zoom ? '-text200' : ''}-cta-symbols${path === '/' ? '' : '-contact'}`, testInfo.project.name);
    }
  }
  assert.equal(stranded.length, 0, `CTA symbols separated from the end of their label: ${JSON.stringify(stranded)}`);
});

test('contact form: empty form is invalid, completed form is valid', async ({ page }) => {
  await page.goto('/contact/');
  const state = await page.evaluate(() => ({
    emptyValid: document.querySelector('.contact-form').checkValidity(),
    emailBad: (() => { const e = document.querySelector('#contact-email'); e.value = 'not-an-email'; return e.validity.typeMismatch; })(),
    filledValid: (() => {
      document.querySelector('#contact-name').value = 'Test Person';
      const e = document.querySelector('#contact-email'); e.value = 'test@example.com';
      document.querySelector('#contact-message').value = 'Hello';
      return document.querySelector('.contact-form').checkValidity();
    })(),
    action: document.querySelector('.contact-form').action,
  }));
  assert.equal(state.emptyValid, false, 'empty form fails native validation');
  assert.equal(state.emailBad, true, 'malformed email is rejected');
  assert.equal(state.filledValid, true, 'completed form passes native validation');
  assert.match(state.action, /^https:\/\//);
});

test('experience page: all four roles render', async ({ page }) => {
  await page.goto('/experience/');
  const roles = await page.evaluate(() => [...document.querySelectorAll('.role .role-title')].map((r) => r.textContent.trim()));
  assert.equal(roles.length, 4, 'four roles listed');
  for (const expected of ['NatWest Boxed', 'Oddschecker', 'Moogsoft', 'Alfa']) {
    assert.ok(roles.some((r) => r.includes(expected)), `role present: ${expected}`);
  }
});
