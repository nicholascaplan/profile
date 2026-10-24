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
  function select(index) {
    current = (index + thumbs.length) % thumbs.length;
    thumbs.forEach((thumb, j) => {
      thumb.classList.toggle('sel', j === current);
      thumb.setAttribute('aria-pressed', String(j === current));
    });
    const chosen = thumbs[current];
    desk.src = chosen.dataset.srcDesk;
    desk.alt = chosen.dataset.altDesk;
    mob.src = chosen.dataset.srcMob;
    mob.alt = chosen.dataset.altMob;
    pillLabel.textContent = `${current + 1} OF ${thumbs.length} · ${chosen.dataset.label} · `;
    counter.textContent = `${current + 1} OF ${thumbs.length}`;
  }
  thumbs.forEach((thumb, j) => thumb.addEventListener('click', () => select(j)));
  caseEl.querySelectorAll('.m-step .arr').forEach((arrow) => {
    arrow.addEventListener('click', () => select(current + Number(arrow.dataset.step)));
  });
});
