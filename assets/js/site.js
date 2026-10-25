// Theme (dark/light) and mobile preview behaviour, shared by every page.
const themeToggle = document.querySelector('.theme-toggle');
const mobileToggle = document.querySelector('.mobile-toggle');
const themeLabel = themeToggle.querySelector('.theme-label');
const themeIcon = themeToggle.querySelector('.theme-icon');
// Storage can throw in private modes; never let it break the page.
function readStored(key) {
  try { return window.localStorage.getItem(key); } catch (error) { return null; }
}
function writeStored(key, value) {
  try { window.localStorage.setItem(key, value); } catch (error) {}
}
const storedTheme = readStored('nick-theme');

function setTheme(theme, persist) {
  const isDark = theme === 'dark';
  document.body.dataset.theme = theme;
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  themeLabel.textContent = isDark ? 'Light mode' : 'Dark mode';
  themeIcon.textContent = isDark ? '☀' : '☾';
  if (persist) writeStored('nick-theme', theme);
}

// Dark is the default for new visitors; a saved choice always wins, and only a
// manual toggle writes it.
setTheme(storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark', false);
themeToggle.addEventListener('click', () => {
  setTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark', true);
});

// Enable theme transitions only once the page has painted, so the initial
// themed background appears instantly instead of fading in (some engines
// animate the pre-stylesheet -> themed change otherwise).
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('load', () => {
    requestAnimationFrame(() => { document.body.dataset.motion = 'on'; });
  });
}

const isLocalEnvironment = ['localhost', '127.0.0.1', '[::1]', ''].includes(window.location.hostname);
const isNetlifyDeployPreview = /^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/.test(window.location.hostname);
const allowsMobilePreview = isLocalEnvironment || isNetlifyDeployPreview;

function setMobileMode(isMobile, persist) {
  document.body.dataset.mobile = String(isMobile);
  mobileToggle.setAttribute('aria-pressed', String(isMobile));
  mobileToggle.setAttribute('aria-label', isMobile ? 'Switch to desktop mode' : 'Switch to mobile mode');
  mobileToggle.title = isMobile ? 'Switch to desktop mode' : 'Switch to mobile mode';
  if (persist && allowsMobilePreview) {
    writeStored('nick-mobile', String(isMobile));
  }
}

if (allowsMobilePreview) {
  const storedMobile = readStored('nick-mobile');
  setMobileMode(storedMobile === null ? window.matchMedia('(max-width: 1280px)').matches : storedMobile === 'true', false);
  mobileToggle.addEventListener('click', () => {
    setMobileMode(document.body.dataset.mobile !== 'true', true);
  });
} else {
  mobileToggle.remove();
  const mobileViewport = window.matchMedia('(max-width: 1280px)');
  setMobileMode(mobileViewport.matches, false);
  mobileViewport.addEventListener('change', (event) => {
    setMobileMode(event.matches, false);
  });
}

// Tap-to-enlarge lightbox for project screenshots.
document.querySelectorAll('.case-shot').forEach(cs => {
  const shot = cs.querySelector('.shot');
  const cue = document.createElement('button');
  cue.type = 'button';
  cue.className = 'zoom-cue';
  cue.textContent = 'Tap to enlarge';
  cue.setAttribute('aria-haspopup', 'dialog');
  shot.appendChild(cue);
  const open = (trigger) => {
    const mob = document.body.dataset.mobile === 'true';
    const img = cs.querySelector(mob ? '.shot-mob' : '.shot-desk');
    const ov = document.createElement('div');
    ov.className = 'shot-zoom';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Enlarged screenshot');
    const im = document.createElement('img');
    im.src = img.currentSrc || img.src; im.alt = img.alt || 'Enlarged screenshot';
    if (!mob) im.className = 'z-desk';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'z-close'; x.textContent = '×'; x.setAttribute('aria-label', 'Close enlarged screenshot');
    ov.append(im, x); document.body.appendChild(ov);
    const close = () => {
      document.removeEventListener('keydown', keys);
      ov.remove();
      if (trigger && typeof trigger.focus === 'function') trigger.focus();
    };
    function keys(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') { e.preventDefault(); x.focus(); }
    }
    x.addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    document.addEventListener('keydown', keys);
    x.focus();
  };
  cue.addEventListener('click', () => open(cue));
  cs.querySelectorAll('.shot-img').forEach(i => i.addEventListener('click', () => open(i)));
});
