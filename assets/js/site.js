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

function setMobileMode(isMobile, preview) {
  document.body.dataset.mobile = String(isMobile);
  document.body.dataset.preview = String(preview && isMobile);
  mobileToggle.setAttribute('aria-pressed', String(isMobile));
  mobileToggle.setAttribute('aria-label', isMobile ? 'Switch to desktop mode' : 'Switch to mobile mode');
  mobileToggle.title = isMobile ? 'Switch to desktop mode' : 'Switch to mobile mode';
}

const mobileViewport = window.matchMedia('(max-width: 600px)');
let previewChoice = allowsMobilePreview ? readStored('nick-mobile') : null;
function syncLayout() {
  setMobileMode(previewChoice === null ? mobileViewport.matches : previewChoice === 'true', previewChoice === 'true');
}
if (allowsMobilePreview) {
  mobileToggle.addEventListener('click', () => {
    previewChoice = String(document.body.dataset.mobile !== 'true');
    writeStored('nick-mobile', previewChoice);
    syncLayout();
  });
} else {
  mobileToggle.remove();
}
syncLayout();
mobileViewport.addEventListener('change', syncLayout);
