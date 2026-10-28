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
    const widths = !/-(home|fireworks|fundraising)-/.test(src) ? [] : [400, 800];
    return [...widths.map((w) => `${directory}${responsiveFiles[filename.replace(/^\d+-/, '').replace('.webp', `-${w}w.webp`)] || filename.replace('.webp', `-${w}w.webp`)} ${w}w`), `${src} 1280w`].join(', ');
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
  function select(index) {
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
    // decode() resolves only once the image is actually ready to paint;
    // fall back to load/error events where decode is unavailable.
    const ready = (img, src, kind) => new Promise((resolve) => {
      const pre = new Image();
      pre.onload = () => {
        if (typeof pre.decode === 'function') pre.decode().then(() => resolve(true), () => resolve(false));
        else resolve(true);
      };
      pre.onerror = () => resolve(false);
      apply(pre, src, kind);
    });
    Promise.all([ready(desk, srcD, 'Desk'), ready(mob, srcM, 'Mob')]).then((readyPair) => {
      if (mySeq !== swapSeq) return;
      if (!readyPair.every(Boolean)) {
        // Keep the displayed pair as the theme-swap target after a failed
        // swap; an explicit thumbnail click still retries the failed tab.
        wanted = current;
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
  thumbs.forEach((thumb, j) => thumb.addEventListener('click', () => select(j)));
});
