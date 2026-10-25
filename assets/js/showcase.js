// Lightweight visual teasers: labelled buttons choose a paired screenshot.
// The live-site link is the primary route for exploring each project.
document.querySelectorAll('.case').forEach((caseEl) => {
  const thumbs = [...caseEl.querySelectorAll('.thumb')];
  const desk = caseEl.querySelector('.shot-desk');
  const mob = caseEl.querySelector('.shot-mob');
  const pillLabel = caseEl.querySelector('.shotbar .pill .pill-label');
  if (!thumbs.length || !desk || !mob || !pillLabel) return;
  let current = 0;
  let swapSeq = 0;
  function select(index) {
    current = (index + thumbs.length) % thumbs.length;
    thumbs.forEach((thumb, j) => {
      thumb.classList.toggle('sel', j === current);
      thumb.setAttribute('aria-pressed', String(j === current));
    });
    const chosen = thumbs[current];
    pillLabel.textContent = chosen.dataset.label;
    // Swap the two shots atomically: only once BOTH new images have loaded,
    // so the desktop and mobile screenshots never visibly change at
    // different times. The latest choice wins if thumbnails are clicked
    // in quick succession.
    const mySeq = ++swapSeq;
    const srcD = variant(chosen, 'Desk');
    const srcM = variant(chosen, 'Mob');
    // decode() resolves only once the image is actually ready to paint;
    // fall back to load/error events where decode is unavailable.
    const ready = (img, src) => img.currentSrc.endsWith(src) ? Promise.resolve() : new Promise((resolve) => {
      const pre = new Image();
      pre.onload = pre.onerror = () => resolve();
      pre.src = src;
      if (typeof pre.decode === 'function') pre.decode().then(() => resolve(), () => resolve());
    });
    Promise.all([ready(desk, srcD), ready(mob, srcM)]).then(() => {
      if (mySeq !== swapSeq) return;
      desk.src = srcD;
      desk.alt = chosen.dataset.altDesk;
      mob.src = srcM;
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
  select(0);
  thumbs.forEach((thumb, j) => thumb.addEventListener('click', () => select(j)));
});
