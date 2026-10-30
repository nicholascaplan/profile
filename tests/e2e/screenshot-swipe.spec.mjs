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
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
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
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
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
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
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
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
  const caseEl = page.locator('.case').first();
  await caseEl.locator('.thumb[data-label="Fireworks"]').click();
  await expect.poll(()=>pressedLabel(page,0)).toBe('Fireworks');
  await caseEl.locator('.thumb[data-label="Fundraising"]').click();
  await expect.poll(()=>pressedLabel(page,0)).toBe('Fundraising');
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
  const tandem = await caseEl.evaluate(el => {
    const indicator = el.querySelector('.thumb-ind');
    const buttons = el.querySelectorAll('.thumb');
    const from = buttons[0].offsetLeft + 12;
    const to = buttons[1].offsetLeft + 12;
    return {fraction: (parseFloat(indicator.style.left) - from) / (to - from),
      clip: getComputedStyle(el.querySelector('.shot-stage')).clipPath};
  });
  expect(tandem.fraction).toBeCloseTo(95 / state.stageWidth, 4);
  // Phone outline/glow extend beyond its border box. The moving stage must
  // clip sideways only, keeping vertical paint space without shifting layout.
  expect(tandem.clip).toBe('inset(-48px 0px)');
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
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
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
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
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
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
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
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
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
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
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
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
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

test('underline and capture release share one animation clock', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/');
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
  await page.evaluate(() => {
    window.releaseClocks={};
    const animate=Element.prototype.animate;
    Element.prototype.animate=function(...args){
      const animation=animate.apply(this,args);
      if(this.matches('.case:first-child .shot:not(.shot-layer)')) window.releaseClocks.shot=animation;
      if(this.matches('.case:first-child .thumb-ind')) window.releaseClocks.indicator=animation;
      return animation;
    };
  });
  await page.locator('.case:first-child .thumb[data-label="Fireworks"]').click();
  await page.waitForFunction(()=>window.releaseClocks.shot && window.releaseClocks.indicator);
  const clocks=await page.evaluate(()=>{
    const {shot,indicator}=window.releaseClocks;
    return {shotStart:shot.startTime,indicatorStart:indicator.startTime,shotDuration:shot.effect.getTiming().duration,indicatorDuration:indicator.effect.getTiming().duration,shotEasing:shot.effect.getTiming().easing,indicatorEasing:indicator.effect.getTiming().easing};
  });
  expect(clocks.shotStart).toBe(clocks.indicatorStart);
  expect(clocks.shotDuration).toBe(clocks.indicatorDuration);
  expect(clocks.shotEasing).toBe(clocks.indicatorEasing);
});

test('a short drag cancels a pending selection without a late slide or skipped choice', async ({page}) => {
  await page.setViewportSize({width:390, height:844});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
  await page.evaluate(() => {
    window.delayedDecodes = [];
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      return decode.call(this).then(() => new Promise(resolve => window.delayedDecodes.push(resolve)));
    };
  });
  await page.locator('.case:first-child .thumb[data-label="Menu"]').click();
  await page.waitForFunction(() => window.delayedDecodes.length >= 2);
  await swipe(page, '.case .shot', {x:280,y:500}, {x:250,y:503}, 3);
  await expect(page.locator('.case:first-child .shot-layer')).toHaveCount(0);
  await page.evaluate(() => window.delayedDecodes.splice(0).forEach(resolve => resolve()));
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
  expect(await pressedLabel(page,0)).toBe('Fundraising');
  await swipe(page, '.case .shot', {x:300,y:500}, {x:90,y:503}, 3);
  await page.waitForFunction(() => window.delayedDecodes.length >= 2);
  await page.evaluate(() => window.delayedDecodes.splice(0).forEach(resolve => resolve()));
  await expect.poll(() => pressedLabel(page,0)).toBe('Fireworks');
});

test('grabbing a moving capture keeps its incoming choice instead of skipping it', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
  // Pin only the test clock mid-slide, to make this race reproducible.
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this,args);
      if (this.matches('.shot, .thumb-ind')) { animation.pause(); animation.currentTime = 80; }
      return animation;
    };
    window.originalAnimate = animate;
  });
  await page.locator('.case:first-child .thumb[data-label="Fireworks"]').click();
  await page.waitForFunction(() => document.querySelector('.case .shot').getAnimations().length > 0);
  await page.evaluate(() => { Element.prototype.animate = window.originalAnimate; });
  // A further left drag takes over A->B. B must stay the incoming page.
  await swipe(page,'.case .shot',{x:300,y:500},{x:210,y:503},3);
  await expect.poll(() => pressedLabel(page,0)).toBe('Fireworks');
  await expect(page.locator('.case:first-child .shot-layer')).toHaveCount(0);
});

test('reversing a moving pair returns to the displayed page before paging past it', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this,args);
      if (this.matches('.shot, .thumb-ind')) { animation.pause(); animation.currentTime=100; }
      return animation;
    };
    window.originalAnimate=animate;
  });
  await page.locator('.case:first-child .thumb[data-label="Fireworks"]').click();
  await page.waitForFunction(() => document.querySelector('.case .shot').getAnimations().length>0);
  await page.evaluate(() => { Element.prototype.animate=window.originalAnimate; });
  await swipe(page,'.case .shot',{x:90,y:500},{x:150,y:503},3);
  await expect(page.locator('.case:first-child .shot-layer')).toHaveCount(0);
  expect(await pressedLabel(page,0)).toBe('Fundraising');
  await expect(page.locator('.case:first-child .shot-mob')).toHaveAttribute('src',/fundraising/);
});

for (const reverse of [false,true]) test(`a held pair remains coherent across direction and zero crossing ${reverse}`, async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
  if (reverse) {
    await page.locator('.case:first-child .thumb[data-label="Fireworks"]').click();
    await expect.poll(()=>pressedLabel(page,0)).toBe('Fireworks');
  }
  await page.evaluate(() => {
    window.originalAnimate=Element.prototype.animate;
    Element.prototype.animate=function(...args){const a=window.originalAnimate.apply(this,args);if(this.matches('.shot, .thumb-ind')){a.pause();a.currentTime=70;}return a;};
  });
  await page.locator(`.case:first-child .thumb[data-label="${reverse?'Fundraising':'Fireworks'}"]`).click();
  await page.waitForFunction(()=>document.querySelector('.case .shot').getAnimations().length>0);
  await page.evaluate(()=>{Element.prototype.animate=window.originalAnimate;});
  // Reverse far enough to cross the original position, revealing the other
  // neighbour. Both polarities use the same current/layer/track invariant.
  await swipe(page,'.case .shot',reverse?{x:320,y:500}:{x:30,y:500},reverse?{x:30,y:503}:{x:320,y:503},8);
  await expect.poll(()=>pressedLabel(page,0)).toBe(reverse?'What’s On':'Menu');
  await expect(page.locator('.case:first-child .shot-layer')).toHaveCount(0);
});

test('no-move flicks queue ahead even while the preceding pair is visibly held', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
  await page.evaluate(() => {
    window.originalAnimate=Element.prototype.animate;
    Element.prototype.animate=function(...args){const a=window.originalAnimate.apply(this,args);if(this.matches('.shot, .thumb-ind')){a.pause();a.currentTime=80;}return a;};
  });
  await page.locator('.case:first-child .thumb[data-label="Fireworks"]').click();
  await page.waitForFunction(()=>document.querySelector('.case .shot').getAnimations().length>0);
  await page.evaluate(()=>{Element.prototype.animate=window.originalAnimate;});
  await swipe(page,'.case .shot',{x:300,y:500},{x:90,y:503});
  await expect.poll(()=>pressedLabel(page,0)).toBe('What’s On');
});

test('a queued flick finishes the visible pair before waiting for the next decode', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
  await page.evaluate(() => {
    window.originalAnimate=Element.prototype.animate;
    Element.prototype.animate=function(...args){const a=window.originalAnimate.apply(this,args);if(this.matches('.shot, .thumb-ind')){a.pause();a.currentTime=80;}return a;};
  });
  await page.locator('.case:first-child .thumb[data-label="Fireworks"]').click();
  await page.waitForFunction(()=>document.querySelector('.case .shot').getAnimations().length>0);
  await page.evaluate(()=>{
    Element.prototype.animate=window.originalAnimate;
    const decode=HTMLImageElement.prototype.decode;
    window.nextDecodeReleases=[];
    HTMLImageElement.prototype.decode=function(){return decode.call(this).then(()=>this.src.includes('whatson')?new Promise(r=>window.nextDecodeReleases.push(r)):undefined);};
  });
  await swipe(page,'.case .shot',{x:300,y:500},{x:90,y:503});
  await page.waitForFunction(()=>window.nextDecodeReleases.length>=2);
  // The occupied incoming Fireworks pair has finished, not disappeared while
  // waiting for What's On. Labels and committed captures agree in between.
  expect(await pressedLabel(page,0)).toBe('Fireworks');
  await expect(page.locator('.case:first-child .shot-mob')).toHaveAttribute('src',/fireworks/);
  await expect(page.locator('.case:first-child .shot:not(.shot-layer)')).toHaveCSS('transform','none');
  await page.evaluate(()=>window.nextDecodeReleases.splice(0).forEach(r=>r()));
  await expect.poll(()=>pressedLabel(page,0)).toBe('What’s On');
});

for (const direction of [-1,1]) test(`underline wraps through opposite edges without traversing names ${direction}`,async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  if(direction===1){await page.locator('.case:first-child .thumb[data-label="Menu"]').click();await expect.poll(()=>pressedLabel(page,0)).toBe('Menu');}
  // This checks warmed drag motion; cold readiness is covered separately.
  const target=direction<0?'Menu':'Fundraising';
  await page.locator(`.case:first-child .thumb[data-label="${target}"]`).click();
  await expect.poll(()=>pressedLabel(page,0)).toBe(target);
  const origin=direction<0?'Fundraising':'Menu';
  await page.locator(`.case:first-child .thumb[data-label="${origin}"]`).click();
  await expect.poll(()=>pressedLabel(page,0)).toBe(origin);
  const a=direction<0?90:300,z=direction<0?190:200;
  await page.evaluate(([a,z])=>{
    const s=document.querySelector('.case .shot');for(const [type,x]of[['touchstart',a],['touchmove',z]]){const t={identifier:1,target:s,clientX:x,clientY:500};const e=new Event(type,{bubbles:true});e.touches=[t];e.changedTouches=[t];s.dispatchEvent(e);}
  },[a,z]);
  const state=await page.locator('.case').first().evaluate(el=>{
    const ind=el.querySelector('.thumb-ind'),wrap=el.querySelector('.thumb-ind-wrap');
    return{left:parseFloat(ind.style.left),entry:parseFloat(wrap.style.left),hidden:wrap.hidden,width:el.querySelector('.thumbs').clientWidth};
  });
  expect(state.hidden).toBe(false);
  if(direction<0){expect(state.left).toBeLessThan(12);expect(state.entry).toBeGreaterThan(state.width-80);}
  else{expect(state.left).toBeGreaterThan(state.width-80);expect(state.entry).toBeLessThan(12);}
});

test('each committed capture has its own explanation, including Biography',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  for(const card of await page.locator('.case').all())for(const button of await card.locator('.thumb:visible').all()){
    await button.click();await expect(button).toHaveAttribute('aria-pressed','true');
    await expect(card.locator('.shot-description')).toHaveText(await button.getAttribute('data-description'));
  }
  await expect(page.locator('.case').nth(1).locator('.shot-mob')).toHaveAttribute('src',/sam-bio/);
});

for (const direction of [-1, 1]) test(`overlong drag releases from its displayed stage bound ${direction}`, async ({page}) => {
  await page.setViewportSize({width:320,height:844});
  await page.goto('/');
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
  const target=direction<0?'Fireworks':'Menu';
  await page.locator(`.case:first-child .thumb[data-label="${target}"]`).click();
  await expect.poll(()=>pressedLabel(page,0)).toBe(target);
  await page.locator('.case:first-child .thumb[data-label="Fundraising"]').click();
  await expect.poll(()=>pressedLabel(page,0)).toBe('Fundraising');
  const state = await page.evaluate(direction => {
    const shot = document.querySelector('.case .shot');
    const width = shot.parentElement.clientWidth;
    const point = x => ({identifier:7,target:shot,clientX:x,clientY:500});
    const send = (type,x,end=false) => {const e=new Event(type,{bubbles:true,cancelable:true});e.touches=end?[]:[point(x)];e.changedTouches=[point(x)];shot.dispatchEvent(e);};
    const animate = Element.prototype.animate;
    window.releaseFrames = [];
    Element.prototype.animate = function(frames,options) {
      if(this===shot) window.releaseFrames.push(frames);
      return animate.call(this,frames,options);
    };
    send('touchstart',160);
    send('touchmove',160+direction*width*1.5);
    const before = getComputedStyle(shot).transform;
    send('touchend',160+direction*width*1.5,true);
    return {width,before};
  },direction);
  await page.waitForFunction(()=>window.releaseFrames.length>0);
  const frames=await page.evaluate(()=>window.releaseFrames[0]);
  const start=Number(frames[0].transform.match(/translateX\(([-.\d]+)px\)/)[1]);
  expect(Math.abs(start)).toBeLessThanOrEqual(state.width);
  expect(start).toBe(direction*state.width);
});

for (const outcome of ['commit','cancel','timeout']) test(`cold first drag never reveals an undecoded capture: ${outcome}`,async({page})=>{
  await page.setViewportSize({width:412,height:915});
  await page.addInitScript(()=>{
    const decode=HTMLImageElement.prototype.decode;
    window.coldDecodeReleases=[];
    HTMLImageElement.prototype.decode=function(){return decode.call(this).then(()=>this.src.includes('fireworks')?new Promise(r=>window.coldDecodeReleases.push({release:r,speculative:!!this.dataset.speculative})):undefined)};
  });
  await page.goto('/');
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.case .shot-img')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.decode())));
  await page.evaluate(()=>document.querySelector('.case .shot-mob').decode());
  await page.evaluate(()=>{
    const el=document.querySelector('.case .shot');
    window.coldTouch=(type,x,end=false)=>{const e=new Event(type,{bubbles:true,cancelable:true});const q={identifier:7,target:el,clientX:x,clientY:500};e.touches=end?[]:[q];e.changedTouches=[q];el.dispatchEvent(e)};
    window.coldTouch('touchstart',310);window.coldTouch('touchmove',150);
  });
  await expect(page.locator('.case .shot:not(.shot-layer)').first()).toHaveCSS('transform','none');
  expect(await pressedLabel(page,0)).toBe('Fundraising');
  await page.evaluate(outcome=>window.coldTouch(outcome==='cancel'?'touchcancel':'touchend',150,true),outcome);
  await page.waitForFunction(()=>window.coldDecodeReleases.filter(r=>!r.speculative).length===2);
  if(outcome==='timeout')await page.waitForTimeout(850);
  await page.evaluate(()=>window.coldDecodeReleases.splice(0).forEach(r=>r.release()));
  await expect.poll(()=>pressedLabel(page,0)).toBe(outcome==='commit'?'Fireworks':'Fundraising');
  await expect(page.locator('.case .shot:not(.shot-layer)').first()).toHaveCSS('transform','none');
});

test('swipe while the initial visible capture is loading does not animate an empty phone',async({page})=>{
  await page.setViewportSize({width:412,height:915});
  let release;
  const pending=new Promise(r=>release=r);
  await page.route('**/*fundraising-mob*',async route=>{await pending;await route.continue()});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await swipe(page,'.case .shot',{x:310,y:500},{x:130,y:500},3);
  await expect(page.locator('.case .shot-layer')).toHaveCount(0);
  await expect(page.locator('.case .shot').first()).toHaveCSS('transform','none');
  expect(await pressedLabel(page,0)).toBe('Fundraising');
  release();
  await page.evaluate(()=>document.querySelector('.case .shot-mob').decode());
  await swipe(page,'.case .shot',{x:310,y:500},{x:130,y:500},3);
  await expect.poll(()=>pressedLabel(page,0)).toBe('Fireworks');
});

test('a rejected first decode does not permanently block gestures after a successful swap',async({page})=>{
  await page.setViewportSize({width:412,height:915});
  await page.addInitScript(()=>{
    const decode=HTMLImageElement.prototype.decode;
    let rejected=false;
    HTMLImageElement.prototype.decode=function(){
      if(!rejected && this.matches('.case:first-child .shot-mob')){rejected=true;return Promise.reject(new Error('source changed during first decode'));}
      return decode.call(this);
    };
  });
  await page.goto('/');
  await page.locator('.case:first-child .thumb[data-label="Fireworks"]').click();
  await expect.poll(()=>pressedLabel(page,0)).toBe('Fireworks');
  await swipe(page,'.case .shot',{x:310,y:500},{x:130,y:500},3);
  await expect.poll(()=>pressedLabel(page,0)).toBe('What’s On');
});

for (const fail of [false, true]) test(`hidden desktop ${fail ? 'failure' : 'delay'} never blocks mobile release; resize guarded`, async ({page}) => {
  await page.setViewportSize({width:412,height:915});
  await page.addInitScript(() => {
    localStorage.setItem('websites-by-nick-cookie-preferences', 'essential');
    localStorage.setItem('nick-theme', 'light');
  });
  let release;
  const pending = new Promise(resolve => {release = resolve;});
  await page.route(/foa-fireworks-desk.*\.webp/, async route => {
    await pending;
    if (fail) await route.abort(); else await route.continue();
  });
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await page.evaluate(async () => {
    const box=document.querySelector('.case');
    await box.querySelector('.shot-mob').decode();
    const choice=box.querySelectorAll('.thumb')[1];
    const img=new Image(); img.src=choice.dataset.srcMob; await img.decode();
    const old=Element.prototype.animate;
    window.motionStart=null;
    Element.prototype.animate=function(...args){if(this.matches('.case:first-of-type .shot:not(.shot-layer)'))window.motionStart=performance.now(); return old.apply(this,args);};
  });
  const releaseAt=await page.evaluate(()=>performance.now());
  await swipe(page,'.case .shot',{x:300,y:500},{x:100,y:500},3);
  // The server deliberately never answers the desktop request until after
  // these assertions. Old both-form gating would time out and spring back.
  await expect.poll(()=>pressedLabel(page,0),{timeout:1500}).toBe('Fireworks');
  const elapsed=await page.evaluate(t=>window.motionStart-t,releaseAt);
  expect(elapsed).toBeLessThan(250);
  const first=page.locator('.case').first();
  await expect(first.locator('.shot-mob')).toHaveAttribute('src',/foa-fireworks-mob.webp/);
  await expect(first.locator('.shot-desk')).toHaveAttribute('src',/foa-fireworks-desk.webp/);
  await page.setViewportSize({width:1280,height:900});
  await expect(first).toHaveClass(/capture-loading/);
  await expect(first.locator('.shot').first()).toHaveCSS('visibility','hidden');
  release();
  if(fail) {
    await expect(first).toHaveAttribute('data-capture-error','true');
    // Returning to a warm form must recover even after hidden-form failure.
    await page.setViewportSize({width:412,height:915});
  }
  await expect(first).not.toHaveClass(/capture-loading/);
  await expect(first.locator('.shot').first()).toHaveCSS('visibility','visible');
  await expect.poll(()=>pressedLabel(page,0)).toBe('Fireworks');
});

test('layout change during a held drag cancels its stale release',async({page})=>{
  await page.setViewportSize({width:412,height:915});
  await page.goto('/');
  await page.evaluate(async()=>{
    const image=document.querySelector('.case .shot-mob');await image.decode();
    const area=document.querySelector('.case .shot');
    const dispatch=(type,x)=>{const event=new Event(type,{bubbles:true,cancelable:true});const p={clientX:x,clientY:400};event.touches=[p];event.changedTouches=[p];area.dispatchEvent(event);};
    dispatch('touchstart',300);dispatch('touchmove',180);
  });
  await page.setViewportSize({width:1280,height:900});
  await page.evaluate(()=>{const area=document.querySelector('.case .shot');const e=new Event('touchend',{bubbles:true});e.touches=[];e.changedTouches=[{clientX:100,clientY:400}];area.dispatchEvent(e);});
  await expect.poll(()=>pressedLabel(page,0)).toBe('Fundraising');
  await expect(page.locator('.case .shot-layer')).toHaveCount(0);
  await expect(page.locator('.case .shot').first()).toHaveCSS('transform','none');
});
