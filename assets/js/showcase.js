// Showcase screenshot selectors: labelled thumbnails choose the hero-sized
// screenshot; on mobile the arrows and counter step through the same set.
document.querySelectorAll('.case').forEach((caseEl) => {
  const thumbs = [...caseEl.querySelectorAll('.thumb')];
  const desk = caseEl.querySelector('.shot-desk');
  const mob = caseEl.querySelector('.shot-mob');
  const pillLabel = caseEl.querySelector('.shotbar .pill .pill-label');
  const counter = caseEl.querySelector('.m-step .cnt');
  if (!thumbs.length || !desk || !mob || !pillLabel || !counter) return;
  let current = 0;
  let swapSeq = 0;
  function select(index) {
    current = (index + thumbs.length) % thumbs.length;
    thumbs.forEach((thumb, j) => {
      thumb.classList.toggle('sel', j === current);
      thumb.setAttribute('aria-pressed', String(j === current));
    });
    const chosen = thumbs[current];
    pillLabel.textContent = `${chosen.dataset.label} · `;
    counter.textContent = `${current + 1} OF ${thumbs.length}`;
    // Swap the two shots atomically: only once BOTH new images have loaded,
    // so the desktop and mobile screenshots never visibly change at
    // different times. The latest choice wins if thumbnails are clicked
    // in quick succession.
    const mySeq = ++swapSeq;
    const srcD = chosen.dataset.srcDesk;
    const srcM = chosen.dataset.srcMob;
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
  thumbs.forEach((thumb, j) => thumb.addEventListener('click', () => select(j)));
  caseEl.querySelectorAll('.m-step .arr').forEach((arrow) => {
    arrow.addEventListener('click', () => select(current + Number(arrow.dataset.step)));
  });
});
