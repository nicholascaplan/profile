// Lightweight visual teasers: labelled buttons choose a paired screenshot.
// The live-site link is the primary route for exploring each project.
document.querySelectorAll('.case').forEach((caseEl) => {
  const thumbs = [...caseEl.querySelectorAll('.thumb')];
  // Inert markup prevents the preload scanner downloading dark captures before
  // the saved light theme is known. Static no-JS captures remain in noscript.
  caseEl.querySelectorAll('.shot-template').forEach((template) => {
    template.replaceWith(template.content.cloneNode(true));
  });
  const desk = caseEl.querySelector('.shot-desk');
  const mob = caseEl.querySelector('.shot-mob');
  const pillLabel = caseEl.querySelector('.shotbar .pill .pill-label');
  if (!thumbs.length || !desk || !mob || !pillLabel) return;
  const sizes = {
    Desk: '(max-width: 600px) calc(100vw - 42px), (max-width: 960px) calc(100vw - 66px), (max-width: 1279px) 600px, (max-width: 1479px) calc(60vw - 86px), 802px',
    Mob: '(max-width: 352px) 85vw, (max-width: 960px) 300px, 150px',
  };
  const responsiveFiles = {
  "foa-home-desk-400w.webp": "5-foa-home-desk-400w.webp",
  "foa-home-desk-800w.webp": "6-foa-home-desk-800w.webp",
  "foa-home-desk-dark-400w.webp": "7-foa-home-desk-dark-400w.webp",
  "foa-home-desk-dark-800w.webp": "8-foa-home-desk-dark-800w.webp",
  "foa-home-mob-160w.webp": "9-foa-home-mob-160w.webp",
  "foa-home-mob-320w.webp": "10-foa-home-mob-320w.webp",
  "foa-home-mob-dark-160w.webp": "11-foa-home-mob-dark-160w.webp",
  "foa-home-mob-dark-320w.webp": "12-foa-home-mob-dark-320w.webp",
  "sam-home-desk-400w.webp": "5-13-sam-home-desk-400w.webp",
  "sam-home-desk-800w.webp": "6-14-sam-home-desk-800w.webp",
  "sam-home-desk-dark-400w.webp": "7-15-sam-home-desk-dark-400w.webp",
  "sam-home-desk-dark-800w.webp": "8-16-sam-home-desk-dark-800w.webp",
  "sam-home-mob-160w.webp": "9-17-sam-home-mob-160w.webp",
  "sam-home-mob-320w.webp": "10-18-sam-home-mob-320w.webp",
  "sam-home-mob-dark-160w.webp": "11-19-sam-home-mob-dark-160w.webp",
  "sam-home-mob-dark-320w.webp": "12-20-sam-home-mob-dark-320w.webp"
};
  const mobileCaptures = {
  "foa-fundraising-mob.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "foa-fundraising-mob-160w.webp",
      "320": "foa-fundraising-mob-320w.webp",
      "600": "foa-fundraising-mob-600w.webp",
      "960": "foa-fundraising-mob-960w.webp"
    }
  },
  "foa-fundraising-mob-dark.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "foa-fundraising-mob-dark-160w.webp",
      "320": "foa-fundraising-mob-dark-320w.webp",
      "600": "foa-fundraising-mob-dark-600w.webp",
      "960": "foa-fundraising-mob-dark-960w.webp"
    }
  },
  "foa-fireworks-mob.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "foa-fireworks-mob-160w.webp",
      "320": "foa-fireworks-mob-320w.webp",
      "600": "foa-fireworks-mob-600w.webp",
      "960": "foa-fireworks-mob-960w.webp"
    }
  },
  "foa-fireworks-mob-dark.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "foa-fireworks-mob-dark-160w.webp",
      "320": "foa-fireworks-mob-dark-320w.webp",
      "600": "foa-fireworks-mob-dark-600w.webp",
      "960": "foa-fireworks-mob-dark-960w.webp"
    }
  },
  "foa-home-mob.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "foa-home-mob-160w.webp",
      "320": "foa-home-mob-320w.webp",
      "600": "foa-home-mob-600w.webp",
      "960": "foa-home-mob-960w.webp"
    }
  },
  "foa-home-mob-dark.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "foa-home-mob-dark-160w.webp",
      "320": "foa-home-mob-dark-320w.webp",
      "600": "foa-home-mob-dark-600w.webp",
      "960": "foa-home-mob-dark-960w.webp"
    }
  },
  "foa-whatson-mob.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "foa-whatson-mob-160w.webp",
      "320": "foa-whatson-mob-320w.webp",
      "600": "foa-whatson-mob-600w.webp",
      "960": "foa-whatson-mob-960w.webp"
    }
  },
  "foa-whatson-mob-dark.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "foa-whatson-mob-dark-160w.webp",
      "320": "foa-whatson-mob-dark-320w.webp",
      "600": "foa-whatson-mob-dark-600w.webp",
      "960": "foa-whatson-mob-dark-960w.webp"
    }
  },
  "foa-menu-mob.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "foa-menu-mob-160w.webp",
      "320": "foa-menu-mob-320w.webp",
      "600": "foa-menu-mob-600w.webp",
      "960": "foa-menu-mob-960w.webp"
    }
  },
  "foa-menu-mob-dark.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "foa-menu-mob-dark-160w.webp",
      "320": "foa-menu-mob-dark-320w.webp",
      "600": "foa-menu-mob-dark-600w.webp",
      "960": "foa-menu-mob-dark-960w.webp"
    }
  },
  "2-sam-home-mob.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "2-sam-home-mob-160w.webp",
      "320": "2-sam-home-mob-320w.webp",
      "600": "2-sam-home-mob-600w.webp",
      "960": "2-sam-home-mob-960w.webp"
    }
  },
  "1-sam-home-mob-dark.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "1-sam-home-mob-dark-160w.webp",
      "320": "1-sam-home-mob-dark-320w.webp",
      "600": "1-sam-home-mob-dark-600w.webp",
      "960": "1-sam-home-mob-dark-960w.webp"
    }
  },
  "sam-works-mob.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "sam-works-mob-160w.webp",
      "320": "sam-works-mob-320w.webp",
      "600": "sam-works-mob-600w.webp",
      "960": "sam-works-mob-960w.webp"
    }
  },
  "sam-works-mob-dark.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "sam-works-mob-dark-160w.webp",
      "320": "sam-works-mob-dark-320w.webp",
      "600": "sam-works-mob-dark-600w.webp",
      "960": "sam-works-mob-dark-960w.webp"
    }
  },
  "sam-watch-mob.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "sam-watch-mob-160w.webp",
      "320": "sam-watch-mob-320w.webp",
      "600": "sam-watch-mob-600w.webp",
      "960": "sam-watch-mob-960w.webp"
    }
  },
  "sam-watch-mob-dark.webp": {
    "width": 1170,
    "height": 2106,
    "variants": {
      "160": "sam-watch-mob-dark-160w.webp",
      "320": "sam-watch-mob-dark-320w.webp",
      "600": "sam-watch-mob-dark-600w.webp",
      "960": "sam-watch-mob-dark-960w.webp"
    }
  }
};
  const sources = (src, kind) => {
    const filename = src.split('/').pop();
    const directory = src.slice(0, src.lastIndexOf('/') + 1);
    const capture = mobileCaptures[filename];
    if (kind === 'Mob' && capture) {
      return [...Object.entries(capture.variants).map(([width, file]) => `${directory}${file} ${width}w`), `${src} ${capture.width}w`].join(', ');
    }
    const widths = [400, 800, 1280, 1920];
    const files = widths.map((w) => `${directory}${responsiveFiles[filename.replace(/^\d+-/, '').replace('.webp', `-${w}w.webp`)] || filename.replace('.webp', `-${w}w.webp`)} ${w}w`);
    return [...files, `${src} 2560w`].join(', ');
  };
  // The desktop mobile preview renders the phone capture at the small-screen
  // solo size; its hint follows the toggle so the preview stays sharp.
  const mobSizes = () => (document.body.dataset.mobile === 'true' ? '300px' : sizes.Mob);
  const apply = (img, src, kind) => {
    img.sizes = kind === 'Mob' ? mobSizes() : sizes[kind];
    img.srcset = sources(src, kind);
    img.src = src;
  };
  new MutationObserver(() => { mob.sizes = mobSizes(); }).observe(document.body, { attributes: true, attributeFilter: ['data-mobile'] });
  const phoneQuery = matchMedia('(max-width: 960px)');
  const phoneLayout = () => phoneQuery.matches || document.body.dataset.mobile === 'true';
  // Populate initial sources in one pass, already matching the saved theme.
  const initial = thumbs[0];
  if (caseEl === document.querySelector('.case')) desk.fetchPriority = 'high';
  apply(desk, variant(initial, 'Desk'), 'Desk');
  apply(mob, variant(initial, 'Mob'), 'Mob');
  let current = 0;
  let wanted = 0;
  let swapSeq = 0;
  const syncPresentedChoice = () => {
    // Keep the decoded pair on failure. A hidden phone-only choice can
    // share its desktop capture with a visible choice (Menu uses Fundraising).
    // Label that actual desktop image, then restore Menu on return to phone.
    const matchingDesktop = thumbs.findIndex((thumb) => !thumb.hidden &&
      [thumb.dataset.srcDesk, thumb.dataset.srcDeskDark].filter(Boolean).some((src) =>
        new URL(src, document.baseURI).href === desk.src));
    const visibleIndex = thumbs[current].hidden ? matchingDesktop : current;
    if (visibleIndex < 0) return;
    thumbs.forEach((thumb, j) => {
      thumb.classList.toggle('sel', j === visibleIndex);
      thumb.setAttribute('aria-pressed', String(j === visibleIndex));
    });
    pillLabel.textContent = thumbs[visibleIndex].dataset.label;
  };
  const shotEl = caseEl.querySelector('.shot');
  // Capture paging (Nick, 29 October 2026): the swap must read as one
  // continuous slide, not a fade to blank. The incoming capture lives on
  // its own layer and chases the outgoing one across a clipping stage; both
  // captures keep their own frame/bezel styles, and the stage clips only
  // mid-slide so the phone glow and the page layout are untouched at rest.
  // All motion is skipped under prefers-reduced-motion or without WAAPI,
  // keeping the plain instant swap.
  const stage = document.createElement('div');
  stage.className = 'shot-stage';
  shotEl.parentNode.insertBefore(stage, shotEl);
  stage.appendChild(shotEl);
  const motionOk = () => !matchMedia('(prefers-reduced-motion: reduce)').matches && typeof shotEl.animate === 'function';
  const stageWidth = () => stage.clientWidth || 1;
  let trackAnims = [];
  let settleSeq = 0;
  let layer = null;
  let layerSign = 0;
  let layerChoice = -1;
  let layerReady = null;
  let dragOffset = 0;
  const setTrack = (offset) => {
    dragOffset = offset;
    shotEl.style.transform = offset ? `translateX(${offset}px)` : '';
    if (layer) {
      layer.style.transform = `translateX(${layerSign * stageWidth() + offset}px)`;
      followIndicator(offset);
    }
  };
  const cancelTrack = () => { settleSeq++; trackAnims.forEach((animation) => animation.cancel()); trackAnims = []; };
  const removeLayer = () => { if (layer) layer.remove(); layer = null; layerReady = null; layerChoice = -1; };
  const restoreShot = () => {
    cancelTrack();
    removeLayer();
    dragOffset = 0;
    shotEl.style.transform = '';
    stage.classList.remove('sliding');
    moveIndicator();
  };
  // The on-screen position while an animation holds it (a grab mid-slide
  // continues from exactly where the captures are).
  const visualOffset = () => {
    const transform = getComputedStyle(shotEl).transform;
    const match = transform && transform !== 'none' && transform.match(/matrix\(([^)]+)\)/);
    return match ? parseFloat(match[1].split(',')[4]) || 0 : 0;
  };
  // Load a capture pair into the layer. BOTH form factors must be decoded
  // before the slide runs, so the pair can never paint mismatched - the same
  // atomic guarantee the instant swap has always given. Decoding goes
  // through a detached preloader (the old swap's proven path: an
  // in-document display:none image's decode() can stall); the layer image
  // paints from the same fetch.
  const loadInto = (img, source, kind) => {
    apply(img, source, kind);
    const pre = new Image();
    apply(pre, source, kind);
    if (typeof pre.decode === 'function') return pre.decode().then(() => true, () => false);
    return new Promise((resolve) => { pre.onload = () => resolve(true); pre.onerror = () => resolve(false); });
  };
  const buildLayer = (sign, j) => {
    if (layer && layerSign === sign && layerChoice === j) return;
    removeLayer();
    const chosen = thumbs[j];
    layer = document.createElement('div');
    layer.className = 'shot shot-layer';
    layer.setAttribute('aria-hidden', 'true');
    const bar = shotEl.querySelector('.shotbar');
    if (bar) {
      const barClone = bar.cloneNode(true);
      const pill = barClone.querySelector('.pill-label');
      if (pill) pill.textContent = chosen.dataset.label;
      layer.appendChild(barClone);
    }
    const deskImg = document.createElement('img');
    deskImg.className = 'shot-img shotlay-desk';
    deskImg.alt = chosen.dataset.altDesk;
    const mobImg = document.createElement('img');
    mobImg.className = 'shot-img shotlay-mob';
    mobImg.alt = chosen.dataset.altMob;
    layer.append(deskImg, mobImg);
    layerSign = sign;
    layerChoice = j;
    layerReady = Promise.all([
      loadInto(deskImg, variant(chosen, 'Desk'), 'Desk'),
      loadInto(mobImg, variant(chosen, 'Mob'), 'Mob'),
    ]).then((pair) => pair.every(Boolean));
    stage.appendChild(layer);
    stage.classList.add('sliding');
    layer.style.transform = `translateX(${layerSign * stageWidth() + dragOffset}px)`;
  };
  // A cancelled gesture returns both captures to rest with the same paired
  // motion, then clears all track state.
  const settleBack = (offset) => {
    if (!motionOk()) { restoreShot(); return; }
    cancelTrack();
    const width = stageWidth();
    const anims = [shotEl.animate([
      { transform: `translateX(${offset}px)` },
      { transform: 'translateX(0px)' },
    ], { duration: 200, easing: 'ease-out' })];
    if (layer) {
      anims.push(layer.animate([
        { transform: `translateX(${layerSign * width + offset}px)` },
        { transform: `translateX(${layerSign * width}px)` },
      ], { duration: 200, easing: 'ease-out' }));
    }
    anims.push(animateIndicator(current));
    trackAnims = anims;
    const settling = ++settleSeq;
    Promise.all(anims.map((animation) => animation.finished)).then(() => {
      if (settling === settleSeq) restoreShot();
    }, () => {});
  };
  // Preload the neighbouring captures (current theme and form factor only)
  // so the first swipe can slide immediately. Bounded to two captures and
  // skipped entirely under Save-Data.
  const preloaded = new Set();
  const preloadNeighbors = () => {
    if (navigator.connection && navigator.connection.saveData) return;
    const order = visibleIndexes();
    const position = order.indexOf(wanted);
    if (position < 0) return;
    const kinds = phoneLayout() ? ['Mob'] : ['Desk'];
    [position - 1, position + 1].forEach((p) => {
      const j = order[(p + order.length) % order.length];
      if (j === undefined) return;
      kinds.forEach((kind) => {
        const source = variant(thumbs[j], kind);
        if (preloaded.has(source)) return;
        preloaded.add(source);
        apply(new Image(), source, kind);
      });
    });
  };
  window.addEventListener('load', () => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    idle(preloadNeighbors);
  });
  // The paired slide: the incoming capture chases the outgoing one across
  // the stage, continuing the gesture's direction. No opacity fades and no
  // blank states - the outgoing capture stays fully visible until the
  // incoming one covers it.
  const runSlide = (chosen, srcD, srcM, direction, fromOffset, mySeq, patient) => {
    buildLayer(direction, wanted);
    const startOffset = fromOffset || dragOffset || visualOffset();
    setTrack(startOffset);
    // A deliberate selection (thumbnail click, wheel step) waits for the
    // pair however long it takes, exactly as the instant swap always has -
    // the current capture stays on screen meanwhile. A gesture commit gives
    // the pair a brief window instead, so a slow network settles the
    // gesture back rather than leaving the finger's release hanging.
    const gate = patient
      ? layerReady
      : Promise.race([layerReady, new Promise((resolve) => setTimeout(() => resolve('slow'), 600))]);
    gate.then((readiness) => {
      if (mySeq !== swapSeq) return;
      if (readiness !== true) {
        // The incoming capture is not paintable: settle back to the current
        // choice and treat the gesture as not taken, so requested and
        // displayed never drift apart.
        settleBack(dragOffset || visualOffset());
        wanted = current;
        syncPresentedChoice();
        if (readiness === false) {
          restoreShot();
          caseEl.dispatchEvent(new Event('showcase:swap-failed'));
        }
        return;
      }
      cancelTrack();
      const width = stageWidth();
      const animOut = shotEl.animate([
        { transform: `translateX(${startOffset}px)` },
        { transform: `translateX(${-direction * width}px)` },
      ], { duration: 200, easing: 'ease-out', fill: 'forwards' });
      const animIn = layer.animate([
        { transform: `translateX(${direction * width + startOffset}px)` },
        { transform: 'translateX(0px)' },
      ], { duration: 200, easing: 'ease-out', fill: 'forwards' });
      trackAnims = [animOut, animIn, animateIndicator(wanted)];
      Promise.all(trackAnims.map((animation) => animation.finished)).then(() => {
        if (mySeq !== swapSeq) return;
        current = wanted;
        apply(desk, srcD, 'Desk');
        desk.alt = chosen.dataset.altDesk;
        apply(mob, srcM, 'Mob');
        mob.alt = chosen.dataset.altMob;
        syncPresentedChoice();
        restoreShot();
        preloadNeighbors();
      }, () => {});
    });
  };
  function select(index, direction = 0, fromOffset = 0, patient = false) {
    wanted = (index + thumbs.length) % thumbs.length;
    if (thumbs[wanted].dataset.mobileOnly && !phoneLayout()) wanted = 0;
    const chosen = thumbs[wanted];
    // Swap the two shots atomically: only once BOTH new images have loaded,
    // so the desktop and mobile screenshots never visibly change at
    // different times. The latest choice wins if thumbnails are clicked
    // in quick succession.
    const mySeq = ++swapSeq;
    const srcD = variant(chosen, 'Desk');
    const srcM = variant(chosen, 'Mob');
    if (direction && motionOk()) { runSlide(chosen, srcD, srcM, direction, fromOffset, mySeq, patient); return; }
    // Instant path: always clear any held track state first so the capture
    // can never be left mid-slide or invisible (theme toggle, reduced
    // motion, rapid mixed input).
    restoreShot();
    // decode() resolves only once the image is actually ready to paint;
    // fall back to load/error events where decode is unavailable.
    const ready = (source, kind) => new Promise((resolve) => {
      const pre = new Image();
      pre.onload = () => {
        if (typeof pre.decode === 'function') pre.decode().then(() => resolve(true), () => resolve(false));
        else resolve(true);
      };
      pre.onerror = () => resolve(false);
      apply(pre, source, kind);
    });
    Promise.all([ready(srcD, 'Desk'), ready(srcM, 'Mob')]).then((readyPair) => {
      if (mySeq !== swapSeq) return;
      if (!readyPair.every(Boolean)) {
        // Keep the displayed pair as the theme-swap target after a failed
        // swap; an explicit thumbnail click still retries the failed tab.
        wanted = current;
        restoreShot();
        syncPresentedChoice();
        caseEl.dispatchEvent(new Event('showcase:swap-failed'));
        return;
      }
      current = wanted;
      syncPresentedChoice();
      apply(desk, srcD, 'Desk');
      desk.alt = chosen.dataset.altDesk;
      apply(mob, srcM, 'Mob');
      mob.alt = chosen.dataset.altMob;
      preloadNeighbors();
    });
  }
  // Screenshots follow the page theme: a site captured in both modes
  // (data-src-*-dark on its thumbnails) swaps variants when data-theme
  // flips; sites with only one mode keep their single capture set.
  function variant(thumb, kind) {
    if (document.body.dataset.theme === 'dark' && thumb.dataset[`src${kind}Dark`]) {
      return thumb.dataset[`src${kind}Dark`];
    }
    return thumb.dataset[`src${kind}`];
  }
  new MutationObserver((records) => {
    if (records.some((r) => r.attributeName === 'data-theme')) {
      select(wanted);
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

  const syncChoices = () => {
    // Remember focus before hiding: browsers may move it to body immediately.
    const focused = thumbs.find((thumb) => thumb === document.activeElement);
    thumbs.forEach((thumb) => { if (thumb.dataset.mobileOnly) thumb.hidden = !phoneLayout(); });
    syncPresentedChoice();
    if (thumbs[wanted].dataset.mobileOnly && !phoneLayout()) select(0);
    if (focused?.hidden) {
      const visibleChoice = thumbs[current].hidden ? thumbs[0] : thumbs[current];
      visibleChoice.focus();
    }
  };
  phoneQuery.addEventListener('change', syncChoices);
  new MutationObserver(syncChoices).observe(document.body, { attributes: true, attributeFilter: ['data-mobile'] });
  syncChoices();
  const thumbsEl = caseEl.querySelector('.thumbs');
  const visibleIndexes = () => thumbs.map((thumb, j) => (thumb.hidden ? -1 : j)).filter((j) => j >= 0);
  const clickDirection = (j) => {
    const order = visibleIndexes();
    return Math.sign(order.indexOf(j) - order.indexOf(wanted));
  };
  let suppressClick = false;
  // A swallowed click may never arrive (a drag on the shot dispatches none),
  // so the guard also expires shortly after each gesture ends.
  let suppressTimer = 0;
  const expireSuppress = () => {
    clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => { suppressClick = false; }, 350);
  };
  thumbs.forEach((thumb, j) => thumb.addEventListener('click', () => {
    // A drag that ends on the row is a swipe, not a tap on a button.
    if (suppressClick) { suppressClick = false; return; }
    select(j, clickDirection(j), 0, true);
  }));

  // The selected choice's underline slides to the newly selected button
  // instead of jumping, giving the page-name row the same motion feedback.
  const indicator = document.createElement('span');
  indicator.className = 'thumb-ind';
  indicator.setAttribute('aria-hidden', 'true');
  thumbsEl.classList.add('thumbs-anim');
  thumbsEl.appendChild(indicator);
  const indicatorBox = (index) => {
    const button = thumbs[index];
    return {left: button.offsetLeft + 12, top: button.offsetTop + button.offsetHeight - 2,
      width: Math.max(0, button.offsetWidth - 24)};
  };
  const paintIndicator = (box) => {
    for (const key of ['left', 'top', 'width']) indicator.style[key] = `${box[key]}px`;
  };
  const moveIndicator = () => {
    if (!layer && !trackAnims.length) paintIndicator(indicatorBox(current));
  };
  const followIndicator = (offset) => {
    if (!layer) return;
    const fraction = Math.min(1, Math.max(0, -layerSign * offset / stageWidth()));
    const from = indicatorBox(current);
    const to = indicatorBox(layerChoice);
    paintIndicator(Object.fromEntries(['left', 'top', 'width'].map(key =>
      [key, from[key] + (to[key] - from[key]) * fraction])));
  };
  const animateIndicator = (index) => {
    const style = getComputedStyle(indicator);
    const from = {left: style.left, top: style.top, width: style.width};
    const to = Object.fromEntries(Object.entries(indicatorBox(index)).map(([key, value]) => [key, `${value}px`]));
    return indicator.animate([from, to], {duration: 200, easing: 'ease-out', fill: 'forwards'});
  };
  new MutationObserver(moveIndicator).observe(thumbsEl, { attributes: true, subtree: true, attributeFilter: ['class', 'hidden'] });
  window.addEventListener('resize', moveIndicator);
  if (document.fonts?.ready) document.fonts.ready.then(moveIndicator).catch(() => {});
  moveIndicator();

  // Swipe or horizontal-scroll moves between the screenshots too (Nick,
  // 29 October 2026): a visitor tried scrolling the page-name row and the
  // shots themselves. The buttons stay the accessible control; gestures
  // only step through the visible choices and never block page scrolling.
  const step = (direction, fromOffset = 0) => {
    const visible = visibleIndexes();
    if (visible.length < 2) return;
    // Step from the requested choice, not the displayed one: while a swap
    // is still loading, rapid swipes must queue ahead instead of repeating
    // the same next choice.
    const position = Math.max(0, visible.indexOf(wanted));
    select(visible[(position + direction + visible.length) % visible.length], direction, fromOffset, fromOffset === 0);
  };
  // The captures page like a carousel (Nick, 29 October 2026): during a
  // horizontal drag the incoming capture's edge tracks the finger, and on
  // release the pair slides on or settles back together.
  // touch-action: pan-y (site.css) keeps vertical swipes scrolling the page
  // natively; listeners stay passive.
  const gestureAreas = [shotEl, thumbsEl].filter(Boolean);
  let drag = null;
  const clearDrag = () => { drag = null; };
  const invalidateSlide = () => { swapSeq++; wanted = current; };
  // The drag target: continuing the direction of an incoming layer the
  // gesture itself brought on stage keeps that capture; once it is the
  // committed choice (or the direction flips), page the neighbour instead.
  const dragTarget = (direction) => {
    if (drag) {
      if (drag.lock === 'h' && drag.base && direction === drag.heldSign && drag.heldChoice >= 0) return drag.heldChoice;
      const visible = visibleIndexes();
      const position = Math.max(0, visible.indexOf(drag.origin));
      return visible[(position + direction + visible.length) % visible.length];
    }
    if (layer && direction === layerSign && layerChoice !== wanted) return layerChoice;
    const visible = visibleIndexes();
    const position = Math.max(0, visible.indexOf(wanted));
    return visible[(position + direction + visible.length) % visible.length];
  };
  gestureAreas.forEach((area) => {
    area.addEventListener('touchstart', (event) => {
      suppressClick = false;
      clearTimeout(suppressTimer);
      // A second finger cancels the drag: settle the pair back first so it
      // does not stay shifted with no handler left to restore it.
      if (event.touches.length !== 1) {
        if (drag) { invalidateSlide(); settleBack(dragOffset); }
        clearDrag();
        return;
      }
      // Grabbing mid-slide takes over from the on-screen position, so the
      // captures never jump when a new touch lands.
      const held = motionOk() ? visualOffset() : 0;
      if (held) {
        swapSeq++;
        const style = getComputedStyle(indicator);
        const box = {left: parseFloat(style.left), top: parseFloat(style.top), width: parseFloat(style.width)};
        cancelTrack();
        paintIndicator(box);
      }
      drag = { x: event.touches[0].clientX, y: event.touches[0].clientY, base: held, lock: null, origin: held ? current : wanted, resume: wanted, heldChoice: layerChoice, heldSign: layerSign };
      if (held) setTrack(held);
      else dragOffset = 0;
    }, { passive: true });
    area.addEventListener('touchmove', (event) => {
      if (!drag) return;
      // The finger's travel is measured from the grab point; drag.base is the
      // track position the grab took over, so the pair moves to base + travel
      // and a mid-slide grab continues without a jump.
      const dx = event.touches[0].clientX - drag.x;
      const dy = event.touches[0].clientY - drag.y;
      if (!drag.lock) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          drag.lock = 'h';
          invalidateSlide();
        }
        else if (Math.abs(dy) > 8) drag.lock = 'v';
      }
      if (drag.lock !== 'h') return;
      if (Math.abs(dx) > 10) suppressClick = true;
      if (!motionOk()) return;
      const offset = drag.base + dx;
      const direction = offset < 0 ? 1 : -1;
      // Bring the incoming capture to the trailing edge so it tracks the
      // finger; its pair starts loading the moment the drag turns horizontal.
      if (visibleIndexes().length > 1) buildLayer(direction, dragTarget(direction));
      const width = stageWidth();
      setTrack(Math.max(-width, Math.min(width, drag.base + dx)));
    }, { passive: true });
    area.addEventListener('touchend', (event) => {
      if (!drag) return;
      const dx = event.changedTouches[0].clientX - drag.x;
      const dy = event.changedTouches[0].clientY - drag.y;
      const { lock, base, resume } = drag;
      // A flick with no move events queues from the requested choice. A
      // real drag takes over the visible pair and keeps its incoming page.
      if (!lock) drag.origin = resume;
      const target = dragTarget(dx < 0 ? 1 : -1);
      clearDrag();
      expireSuppress();
      // Only a clearly horizontal swipe switches; vertical swipes scroll the
      // page exactly as before.
      const horizontal = Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.5;
      if (lock === 'h' && !horizontal) { invalidateSlide(); settleBack(dragOffset); return; }
      if (horizontal) {
        // Reversing a held slide first returns to the displayed page. Only
        // after crossing its resting position can it reveal the other side.
        if (lock === 'h' && base && Math.sign(dx) !== Math.sign(base) && (Math.sign(base + dx) === Math.sign(base) || base + dx === 0)) {
          invalidateSlide();
          settleBack(base + dx);
          return;
        }
        const direction = dx < 0 ? 1 : -1;
        // The slide continues from where the finger left the track: a locked
        // drag leaves it at base + dx, an untouched grab still holds base.
        select(target, direction, lock === 'h' ? base + dx : base);
        return;
      }
      // A tap that grabbed a mid-slide track (no drag) resumes the
      // interrupted slide rather than leaving the pair frozen.
      if (base) {
        if (resume === current) settleBack(base);
        else select(resume, base < 0 ? 1 : -1, base);
      }
    }, { passive: true });
    area.addEventListener('touchcancel', () => {
      if (!drag) return;
      invalidateSlide();
      clearDrag();
      expireSuppress();
      settleBack(dragOffset);
    }, { passive: true });
    // A trackpad horizontal scroll over a shot or the tab row steps one
    // screenshot per gesture instead of doing nothing.
    let wheelDelta = 0;
    let wheelTimer = 0;
    // One step per gesture: a trackpad scroll fires many events, so latch
    // until it goes quiet instead of skipping several screenshots.
    let wheelLatch = false;
    area.addEventListener('wheel', (event) => {
      // deltaMode 1 reports lines and 2 pages, not pixels; normalize so a
      // line-mode wheel can still reach the threshold.
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? area.clientWidth : 1;
      const dx = event.deltaX * unit;
      const dy = event.deltaY * unit;
      if (Math.abs(dx) <= Math.abs(dy)) return;
      event.preventDefault();
      wheelDelta += dx;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { wheelDelta = 0; wheelLatch = false; }, 150);
      if (!wheelLatch && Math.abs(wheelDelta) >= 60) {
        wheelLatch = true;
        step(wheelDelta > 0 ? 1 : -1);
        wheelDelta = 0;
      }
    }, { passive: false });
  });
});
