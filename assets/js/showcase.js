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
    Desk: '(max-width: 600px) calc(100vw - 42px), (max-width: 960px) calc(100vw - 66px), 600px',
    Mob: '(max-width: 600px) 22vw, (max-width: 960px) 24vw, 150px',
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
  "sam-home-desk-400w.webp": "13-sam-home-desk-400w.webp",
  "sam-home-desk-800w.webp": "14-sam-home-desk-800w.webp",
  "sam-home-desk-dark-400w.webp": "15-sam-home-desk-dark-400w.webp",
  "sam-home-desk-dark-800w.webp": "16-sam-home-desk-dark-800w.webp",
  "sam-home-mob-160w.webp": "17-sam-home-mob-160w.webp",
  "sam-home-mob-320w.webp": "18-sam-home-mob-320w.webp",
  "sam-home-mob-dark-160w.webp": "19-sam-home-mob-dark-160w.webp",
  "sam-home-mob-dark-320w.webp": "20-sam-home-mob-dark-320w.webp"
};
  const sources = (src, kind) => {
    const widths = !src.includes('-home-') ? [] : kind === 'Desk' ? [400, 800] : [160, 320];
    const fullWidth = kind === 'Desk' ? 1280 : 600;
    return [...widths.map((w) => `${src.slice(0, src.lastIndexOf('/') + 1)}${responsiveFiles[src.split('/').pop().replace('.webp', `-${w}w.webp`)]} ${w}w`), `${src} ${fullWidth}w`].join(', ');
  };
  const apply = (img, src, kind) => {
    img.sizes = sizes[kind];
    img.srcset = sources(src, kind);
    img.src = src;
  };
  // Populate initial sources in one pass, already matching the saved theme.
  const initial = thumbs[0];
  apply(desk, variant(initial, 'Desk'), 'Desk');
  apply(mob, variant(initial, 'Mob'), 'Mob');
  if (caseEl === document.querySelector('.case')) desk.fetchPriority = 'high';
  let current = 0;
  let swapSeq = 0;
  function select(index) {
    const requested = (index + thumbs.length) % thumbs.length;
    const chosen = thumbs[requested];
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
      if (mySeq !== swapSeq || !readyPair.every(Boolean)) return;
      current = requested;
      thumbs.forEach((thumb, j) => {
        thumb.classList.toggle('sel', j === current);
        thumb.setAttribute('aria-pressed', String(j === current));
      });
      pillLabel.textContent = chosen.dataset.label;

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
      select(current);
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

  thumbs.forEach((thumb, j) => thumb.addEventListener('click', () => select(j)));
});
