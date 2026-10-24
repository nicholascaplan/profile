// Theme (dark/light) and mobile preview behaviour, shared by every page.
const themeToggle = document.querySelector('.theme-toggle');
const mobileToggle = document.querySelector('.mobile-toggle');
const themeLabel = themeToggle.querySelector('.theme-label');
const themeIcon = themeToggle.querySelector('.theme-icon');
const storedTheme = window.localStorage.getItem('nick-theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

function setTheme(theme) {
  const isDark = theme === 'dark';
  document.body.dataset.theme = theme;
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  themeLabel.textContent = isDark ? 'Light mode' : 'Dark mode';
  themeIcon.textContent = isDark ? '☀' : '☾';
  window.localStorage.setItem('nick-theme', theme);
}

setTheme(storedTheme || (prefersDark ? 'dark' : 'light'));
themeToggle.addEventListener('click', () => {
  setTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
});

const isLocalEnvironment = ['localhost', '127.0.0.1', '[::1]', ''].includes(window.location.hostname);

function setMobileMode(isMobile) {
  document.body.dataset.mobile = String(isMobile);
  mobileToggle.setAttribute('aria-pressed', String(isMobile));
  mobileToggle.setAttribute('aria-label', isMobile ? 'Switch to desktop mode' : 'Switch to mobile mode');
  mobileToggle.title = isMobile ? 'Switch to desktop mode' : 'Switch to mobile mode';
  if (isLocalEnvironment) {
    window.localStorage.setItem('nick-mobile', String(isMobile));
  }
}

if (isLocalEnvironment) {
  const storedMobile = window.localStorage.getItem('nick-mobile');
  setMobileMode(storedMobile === null ? window.matchMedia('(max-width: 1280px)').matches : storedMobile === 'true');
  mobileToggle.addEventListener('click', () => {
    setMobileMode(document.body.dataset.mobile !== 'true');
  });
} else {
  mobileToggle.remove();
  const mobileViewport = window.matchMedia('(max-width: 1280px)');
  setMobileMode(mobileViewport.matches);
  mobileViewport.addEventListener('change', (event) => {
    setMobileMode(event.matches);
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
