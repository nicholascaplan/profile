import {test, expect} from '@playwright/test';

// Swipe and horizontal-scroll gestures step through the screenshot choices,
// on the shots themselves and on the page-name row. The underline buttons
// remain the accessible control.
// Real TouchEvent objects where the browser defines them (Chrome); a plain
// Event carrying touches/changedTouches elsewhere, so the handler's behavior
// is asserted on every browser project rather than skipped where the
// constructors are absent (desktop Firefox and WebKit).
const swipe = (page, selector, from, to, steps = 0) => page.evaluate(([selector, from, to, steps]) => {
  const area = document.querySelector(selector);
  const touchEvent = (type, x, y, changed) => {
    // Real touch events where the constructors work; a plain Event carrying
    // touches/changedTouches where they are missing (desktop Firefox) or not
    // constructible (desktop WebKit), so the handler stays asserted on every
    // browser project.
    try {
      const point = new Touch({identifier: 7, target: area, clientX: x, clientY: y});
      area.dispatchEvent(new TouchEvent(type, {
        touches: changed ? [] : [point],
        changedTouches: [point],
        bubbles: true,
        cancelable: true,
      }));
      return;
    } catch (error) {}
    const event = new Event(type, {bubbles: true, cancelable: true});
    const point = {identifier: 7, target: area, clientX: x, clientY: y};
    event.touches = changed ? [] : [point];
    event.changedTouches = [point];
    area.dispatchEvent(event);
  };
  touchEvent('touchstart', from.x, from.y, false);
  for (let i = 1; i <= steps; i += 1) {
    const x = from.x + ((to.x - from.x) * i) / (steps + 1);
    const y = from.y + ((to.y - from.y) * i) / (steps + 1);
    touchEvent('touchmove', x, y, false);
  }
  touchEvent('touchend', to.x, to.y, true);
}, [selector, from, to, steps]);

const pressedLabel = (page, caseIndex) => page.locator('.case').nth(caseIndex)
  .locator('.thumb[aria-pressed="true"]').getAttribute('data-label');

test('horizontal swipe steps through the visible screenshots and wraps', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.addInitScript(() => localStorage.setItem('websites-by-nick-cookie-preferences', 'essential'));
  await page.goto('/');
  const firstCase = page.locator('.case').first();
  await expect(firstCase.locator('.thumb[aria-pressed="true"]')).toHaveAttribute('data-label', 'Fundraising');

  // Left swipe on the shot advances; on phone widths all four FOA choices show.
  await swipe(page, '.case .shot', {x: 300, y: 500}, {x: 80, y: 508});
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fireworks');
  await swipe(page, '.case .shot', {x: 300, y: 500}, {x: 80, y: 508});
  await expect.poll(() => pressedLabel(page, 0)).toBe('What’s On');
  await swipe(page, '.case .shot', {x: 300, y: 500}, {x: 80, y: 508});
  await expect.poll(() => pressedLabel(page, 0)).toBe('Menu');
  // Wraps back to the first choice.
  await swipe(page, '.case .shot', {x: 300, y: 500}, {x: 80, y: 508});
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fundraising');
  // Right swipe goes back, wrapping to the last choice from the first.
  await swipe(page, '.case .shot', {x: 80, y: 500}, {x: 300, y: 508});
  await expect.poll(() => pressedLabel(page, 0)).toBe('Menu');
  await swipe(page, '.case .shot', {x: 80, y: 500}, {x: 300, y: 508});
  await expect.poll(() => pressedLabel(page, 0)).toBe('What’s On');

  // A mostly vertical swipe is page scrolling and changes nothing.
  await swipe(page, '.case .shot', {x: 200, y: 600}, {x: 220, y: 250});
  await page.waitForTimeout(150);
  await expect.poll(() => pressedLabel(page, 0)).toBe('What’s On');

  // The page-name row accepts the same swipe.
  await swipe(page, '.case .thumbs', {x: 300, y: 30}, {x: 80, y: 38});
  await expect.poll(() => pressedLabel(page, 0)).toBe('Menu');

  // The second case gestures independently.
  await expect.poll(() => pressedLabel(page, 1)).toBe('Homepage');
  await swipe(page, '.case:nth-of-type(2) .shot', {x: 300, y: 500}, {x: 80, y: 508});
  await expect.poll(() => pressedLabel(page, 1)).toBe('Works catalogue');
});

test('rapid repeated swipes queue ahead instead of repeating a choice', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.addInitScript(() => localStorage.setItem('websites-by-nick-cookie-preferences', 'essential'));
  await page.goto('/');
  await expect(page.locator('.case').first().locator('.thumb[aria-pressed="true"]')).toHaveAttribute('data-label', 'Fundraising');
  // Two swipes back to back, before the first swap finishes loading.
  await swipe(page, '.case .shot', {x: 300, y: 500}, {x: 80, y: 508});
  await swipe(page, '.case .shot', {x: 300, y: 500}, {x: 80, y: 508});
  await expect.poll(() => pressedLabel(page, 0)).toBe('What’s On');
  // Three quick swipes back: Fundraising, wrapping through Menu.
  await swipe(page, '.case .shot', {x: 80, y: 500}, {x: 300, y: 508});
  await swipe(page, '.case .shot', {x: 80, y: 500}, {x: 300, y: 508});
  await swipe(page, '.case .shot', {x: 80, y: 500}, {x: 300, y: 508});
  await expect.poll(() => pressedLabel(page, 0)).toBe('Menu');
});

test('the capture follows a horizontal drag and springs back under the threshold', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.addInitScript(() => localStorage.setItem('websites-by-nick-cookie-preferences', 'essential'));
  await page.goto('/');
  const shot = page.locator('.case .shot').first();
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fundraising');
  // Full drag with moves commits and animates.
  await swipe(page, '.case .shot', {x: 300, y: 500}, {x: 80, y: 506}, 3);
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fireworks');
  await expect.poll(async () => shot.evaluate(el => el.style.transform)).toBe('');
  // A short drag below the threshold keeps the choice and the capture settles back.
  await swipe(page, '.case .shot', {x: 260, y: 500}, {x: 230, y: 504}, 2);
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fireworks');
  await expect.poll(async () => shot.evaluate(el => el.style.transform)).toBe('');
  // A horizontal drag ending on the tab row does not also fire its button.
  await swipe(page, '.case .thumbs', {x: 300, y: 30}, {x: 90, y: 34}, 3);
  await expect.poll(() => pressedLabel(page, 0)).toBe('What’s On');
});

test('a horizontal drag brings the incoming capture in from the edge', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.addInitScript(() => localStorage.setItem('websites-by-nick-cookie-preferences', 'essential'));
  await page.goto('/');
  const caseEl = page.locator('.case').first();
  const fire = (type, x) => page.evaluate(([type, x]) => {
    const shot = document.querySelector('.case .shot');
    const rect = shot.getBoundingClientRect();
    const y = Math.round(rect.top + rect.height / 2);
    // Real TouchEvent where constructible; a plain Event carrying the touch
    // lists elsewhere (desktop Firefox and WebKit), as in the swipe helper.
    try {
      const point = new Touch({identifier: 1, target: shot, clientX: x, clientY: y});
      shot.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' ? [] : [point],
        changedTouches: [point],
        bubbles: true,
        cancelable: true,
      }));
      return;
    } catch (error) {}
    const event = new Event(type, {bubbles: true, cancelable: true});
    const point = {identifier: 1, target: shot, clientX: x, clientY: y};
    event.touches = type === 'touchend' ? [] : [point];
    event.changedTouches = [point];
    shot.dispatchEvent(event);
  }, [type, x]);
  await fire('touchstart', 300);
  await fire('touchmove', 240);
  await fire('touchmove', 205);
  // Mid-drag: the incoming capture's layer is on stage ahead of the finger,
  // already showing the next choice.
  await expect(caseEl.locator('.shot-layer')).toHaveCount(1);
  const state = await page.evaluate(() => {
    const shot = document.querySelector('.case .shot');
    const layerEl = document.querySelector('.case .shot-layer');
    return {
      shotTransform: shot.style.transform,
      layerTransform: layerEl.style.transform,
      stageWidth: layerEl.parentElement.clientWidth,
      src: layerEl.querySelector('.shotlay-mob').src,
      label: layerEl.querySelector('.pill-label')?.textContent || '',
    };
  });
  expect(state.shotTransform).toBe('translateX(-95px)');
  expect(state.layerTransform).toBe(`translateX(${state.stageWidth - 95}px)`);
  expect(state.src).toContain('fireworks');
  // Dragging back under the commit threshold and releasing settles the pair back.
  await fire('touchmove', 270);
  await fire('touchend', 270);
  await expect(caseEl.locator('.shot-layer')).toHaveCount(0);
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fundraising');
  await expect.poll(async () => page.locator('.case .shot').first().evaluate(el => el.style.transform)).toBe('');
});

test('a theme change during an animated swap never leaves the capture hidden', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.addInitScript(() => localStorage.setItem('websites-by-nick-cookie-preferences', 'essential'));
  await page.goto('/');
  await page.locator('.case .thumbs .thumb').nth(1).click();
  // Flip the theme while the swap is still in flight.
  await page.evaluate(() => { document.body.dataset.theme = 'light'; });
  await page.evaluate(() => { document.body.dataset.theme = 'dark'; });
  await page.waitForTimeout(900);
  const state = await page.evaluate(() => {
    const shot = document.querySelector('.case .shot');
    const mob = shot.querySelector('.shot-mob');
    return {
      opacity: getComputedStyle(shot).opacity,
      transform: shot.style.transform,
      loaded: mob.complete && mob.naturalWidth > 0,
      layers: document.querySelectorAll('.case .shot-layer').length,
    };
  });
  expect(state.opacity).toBe('1');
  expect(state.transform).toBe('');
  expect(state.loaded).toBe(true);
  expect(state.layers).toBe(0);
  expect(await pressedLabel(page, 0)).toBe('Fireworks');
});

test('a swipe on the capture does not swallow the next tap on a choice', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.addInitScript(() => localStorage.setItem('websites-by-nick-cookie-preferences', 'essential'));
  await page.goto('/');
  await swipe(page, '.case .shot', {x: 300, y: 500}, {x: 80, y: 506}, 3);
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fireworks');
  // The drag set the click guard but no click followed on the row; the guard
  // must expire so the next tap selects on the first try.
  await page.waitForTimeout(400);
  await page.locator('.case .thumbs .thumb').nth(0).click();
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fundraising');
});

test('a second finger cancels the drag and settles the capture back', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.addInitScript(() => localStorage.setItem('websites-by-nick-cookie-preferences', 'essential'));
  await page.goto('/');
  const shot = page.locator('.case .shot').first();
  await page.evaluate(() => {
    const area = document.querySelector('.case .shot');
    const fire = (type, touches, changed) => {
      try {
        const pts = touches.map(([x, y], i) => new Touch({identifier: i + 1, target: area, clientX: x, clientY: y}));
        area.dispatchEvent(new TouchEvent(type, {touches: type === 'touchend' ? [] : pts, changedTouches: changed.map(([x, y], i) => new Touch({identifier: i + 1, target: area, clientX: x, clientY: y})), bubbles: true, cancelable: true}));
        return;
      } catch (error) {}
      const event = new Event(type, {bubbles: true, cancelable: true});
      const pts = touches.map(([x, y], i) => ({identifier: i + 1, target: area, clientX: x, clientY: y}));
      event.touches = type === 'touchend' ? [] : pts;
      event.changedTouches = changed.map(([x, y], i) => ({identifier: i + 1, target: area, clientX: x, clientY: y}));
      area.dispatchEvent(event);
    };
    fire('touchstart', [[300, 500]], [[300, 500]]);
    fire('touchmove', [[220, 504]], [[220, 504]]);
    // A second finger lands mid-drag.
    fire('touchstart', [[220, 504], [120, 300]], [[120, 300]]);
  });
  await expect.poll(async () => shot.evaluate(el => el.style.transform)).toBe('');
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fundraising');
  await expect(page.locator('.case .shot-layer')).toHaveCount(0);
});

test('reduced motion keeps the swipe instant with no lingering transform', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.setViewportSize({width: 390, height: 844});
  await page.addInitScript(() => localStorage.setItem('websites-by-nick-cookie-preferences', 'essential'));
  await page.goto('/');
  const shot = page.locator('.case .shot').first();
  await swipe(page, '.case .shot', {x: 300, y: 500}, {x: 80, y: 506}, 3);
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fireworks');
  expect(await shot.evaluate(el => el.style.transform)).toBe('');
  expect(await shot.evaluate(el => el.getAnimations().length)).toBe(0);
  await expect(page.locator('.case .shot-layer')).toHaveCount(0);
});

test('the underline indicator slides to the selected choice', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.addInitScript(() => localStorage.setItem('websites-by-nick-cookie-preferences', 'essential'));
  await page.goto('/');
  const group = page.locator('.case .thumbs').first();
  const indicator = group.locator('.thumb-ind');
  const boxWithin = async () => {
    const ind = await indicator.boundingBox();
    const sel = await group.locator('.thumb.sel').boundingBox();
    return ind.x >= sel.x - 1 && ind.x + ind.width <= sel.x + sel.width + 1 &&
      Math.abs(ind.y + ind.height - (sel.y + sel.height)) <= 2;
  };
  expect(await boxWithin()).toBe(true);
  await swipe(page, '.case .shot', {x: 300, y: 500}, {x: 80, y: 506});
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fireworks');
  await expect.poll(boxWithin).toBe(true);
});

test('horizontal wheel scroll steps one screenshot per gesture', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 900});
  await page.addInitScript(() => localStorage.setItem('websites-by-nick-cookie-preferences', 'essential'));
  await page.goto('/');
  const wheel = (selector, deltaX, deltaY, deltaMode = 0) => page.evaluate(([selector, deltaX, deltaY, deltaMode]) => {
    document.querySelector(selector).dispatchEvent(new WheelEvent('wheel', {deltaX, deltaY, deltaMode, bubbles: true, cancelable: true}));
  }, [selector, deltaX, deltaY, deltaMode]);
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fundraising');
  // One continuous gesture fires many events but steps only once.
  await wheel('.case .shot', 40, 0);
  await wheel('.case .shot', 40, 0);
  await wheel('.case .shot', 40, 0);
  await wheel('.case .shot', 40, 0);
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fireworks');
  await page.waitForTimeout(300);
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fireworks');
  // Vertical wheel never switches screenshots.
  await wheel('.case .shot', 0, 240);
  await page.waitForTimeout(200);
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fireworks');
  // Separate gestures, each after a pause, step back through the choices and
  // wrap past the first to the last visible one.
  await wheel('.case .thumbs', -120, 0);
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fundraising');
  await page.waitForTimeout(250);
  await wheel('.case .thumbs', -120, 0);
  await expect.poll(() => pressedLabel(page, 0)).toBe('What’s On');
  // Line-mode deltas (deltaMode 1, common for Firefox wheels) still count:
  // four lines backward is about 64px and steps once.
  await page.waitForTimeout(250);
  await wheel('.case .shot', -4, 0, 1);
  await expect.poll(() => pressedLabel(page, 0)).toBe('Fireworks');
});
