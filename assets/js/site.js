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
