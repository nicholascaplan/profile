// MOCK ONLY - shot-height comparison control for the compact case mock.
(function () {
  var bar = document.createElement('div');
  bar.className = 'mock-bar';
  bar.innerHTML = '<span class="mk">Mock · mobile shot height</span>' +
    '<button type="button" data-v="" aria-pressed="false">Full (current)</button>' +
    '<button type="button" data-v="crop540" aria-pressed="true">Crop · 540</button>' +
    '<button type="button" data-v="crop430" aria-pressed="false">Crop · 430</button>';
  function apply(v) {
    if (v) document.body.dataset.shot = v; else delete document.body.dataset.shot;
    bar.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === v)); });
    try { sessionStorage.setItem('mock-shot', v); } catch (e) {}
  }
  bar.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) apply(b.dataset.v); });
  var showcase = document.querySelector('.showcase');
  if (showcase) showcase.prepend(bar);
  var saved = null;
  try { saved = sessionStorage.getItem('mock-shot'); } catch (e) {}
  apply(saved === null ? 'crop540' : saved);
})();
