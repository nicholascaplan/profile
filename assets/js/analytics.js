/* Optional GA4, inspired by FOA: no Google connection before explicit consent.
   Use this site's own GA4 web-stream ID, never another site's property.
   Preview/local hosts keep the consent UI but never load production analytics. */
(function () {
  'use strict';
  var storageKey = 'websites-by-nick-cookie-preferences';
  var script = document.currentScript;
  var measurementId = script && script.dataset.measurementId;
  var canTrack = /^(www\.)?websitesbynick\.co\.uk$/.test(location.hostname) && /^G-[A-Z0-9]+$/.test(measurementId || '');
  var preference = null;
  var storageReady = false;
  var rejectionCookie = 'websites-by-nick-analytics-rejected';
  var sessionRejection = false;
  try { sessionRejection = sessionStorage.getItem(storageKey) === 'essential'; } catch (error) {}
  var cookieRejection = document.cookie.split(';').some(function (cookie) { return cookie.trim() === rejectionCookie + '=1'; });
  try {
    // Never trust a saved Allow if a later withdrawal cannot be persisted.
    localStorage.setItem(storageKey + '-check', '1');
    localStorage.removeItem(storageKey + '-check');
    preference = localStorage.getItem(storageKey);
    storageReady = true;
  } catch (error) {}
  if (storageReady && (sessionRejection || cookieRejection)) preference = 'essential';
  var channel = null;
  try { channel = new BroadcastChannel(storageKey); } catch (error) {}
  var returnFocus = null;
  var loaded = false;
  var panel = document.createElement('aside');
  panel.id = 'cookie-consent-panel';
  panel.className = 'cookie-banner';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'cookie-banner-title');
  var privacyURL = new URL('../../privacy/', script.src).href;
  panel.innerHTML = '<div><h2 id="cookie-banner-title">Analytics cookies</h2><p>Optional Google Analytics stays off unless you allow it. <a href="' + privacyURL + '">Privacy notice</a></p></div><div class="cookie-actions"><button type="button" class="button button-primary" data-cookie-choice="analytics">Allow analytics</button><button type="button" class="button button-secondary" data-cookie-choice="essential">Reject analytics</button></div>';
  document.body.appendChild(panel);
  /** Keep footer controls scrollable above the visible consent panel. */
  function reserveSpace() { document.body.style.paddingBottom = panel.hidden ? '' : panel.getBoundingClientRect().height + 'px'; }
  new ResizeObserver(reserveSpace).observe(panel);

  /** Remove GA cookies on this host and its apex domain. */
  function removeCookies() {
    var host = location.hostname;
    var domains = ['', host, host.replace(/^www\./, '')];
    document.cookie.split(';').forEach(function (cookie) {
      var name = cookie.trim().split('=')[0];
      if (!/^_ga(?:_|$)/.test(name)) return;
      domains.forEach(function (domain) {
        document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax' + (domain ? '; domain=' + domain : '');
      });
    });
  }
  /** Persist a rejection through independent browser stores when a write fails. */
  function rememberRejection() {
    var saved = false;
    try { localStorage.setItem(storageKey, 'essential'); saved = true; } catch (error) {
      try { localStorage.removeItem(storageKey); saved = true; } catch (error) {}
    }
    try { sessionStorage.setItem(storageKey, 'essential'); } catch (error) {}
    document.cookie = rejectionCookie + '=1; Max-Age=31536000; path=/; SameSite=Lax; Secure';
    return saved || document.cookie.split(';').some(function (cookie) { return cookie.trim() === rejectionCookie + '=1'; });
  }
  /** Explain a failed save without suggesting that every browser store worked. */
  function showSaveWarning() {
    var warning = document.getElementById('cookie-save-warning');
    if (!warning) {
      warning = document.createElement('p');
      warning.id = 'cookie-save-warning';
      warning.className = 'cookie-save-warning';
      warning.setAttribute('role', 'status');
      warning.textContent = 'Your browser could not save your cookie choice normally. Analytics is off here. If you block all browser storage, close other tabs and check your choice when you return.';
      document.body.appendChild(warning);
    }
  }
  /** Enable this production stream after opt-in, loading the tag only once. */
  function loadAnalytics() {
    if (!canTrack || preference !== 'analytics') return;
    // An unsaved withdrawal leaves the existing tag loaded but disabled.
    window['ga-disable-' + measurementId] = false;
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    // gtag expects Arguments objects, not arrays.
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      // Do not send URL query strings, fragments or referrer query data.
      page_location: location.origin + location.pathname,
      page_referrer: ''
    });
    var tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    tag.dataset.googleAnalytics = 'true';
    document.head.appendChild(tag);
  }
  panel.querySelectorAll('[data-cookie-choice]').forEach(function (button) {
    button.addEventListener('click', function () {
      preference = button.dataset.cookieChoice;
      var preferenceStored = false;
      try {
        localStorage.setItem(storageKey, preference);
        preferenceStored = true;
      } catch (error) {}
      panel.hidden = true;
      reserveSpace();
      if (returnFocus) returnFocus.focus();
      returnFocus = null;
      if (preference === 'analytics') {
        try { sessionStorage.removeItem(storageKey); } catch (error) {}
        document.cookie = rejectionCookie + '=; Max-Age=0; path=/; SameSite=Lax; Secure';
        var warning = document.getElementById('cookie-save-warning');
        if (warning) warning.remove();
        loadAnalytics();
      }
      else {
        if (measurementId) window['ga-disable-' + measurementId] = true;
        removeCookies();
        if (!preferenceStored) { rememberRejection(); showSaveWarning(); }
        if (channel) channel.postMessage('essential');
        // Do not send denied-consent pings: unload the script entirely.
        if (loaded && preferenceStored) location.reload();
      }
    });
  });
  document.querySelectorAll('[data-cookie-preferences]').forEach(function (button) {
    button.addEventListener('click', function () {
      returnFocus = button;
      panel.hidden = false;
      reserveSpace();
      panel.querySelector('button').focus();
    });
  });
  // Withdrawal applies to every open tab, including localStorage.clear().
  window.addEventListener('storage', function (event) {
    if (event.storageArea !== localStorage || (event.key !== storageKey && event.key !== null)) return;
    if (event.newValue === 'analytics') return;
    preference = event.newValue;
    if (measurementId) window['ga-disable-' + measurementId] = true;
    removeCookies();
    if (loaded) location.reload();
  });
  if (channel) channel.onmessage = function (event) {
    if (event.data !== 'essential') return;
    preference = 'essential';
    if (measurementId) window['ga-disable-' + measurementId] = true;
    removeCookies();
    var saved = rememberRejection();
    if (loaded && saved) location.reload();
    else if (loaded) showSaveWarning();
  };
  if (preference === 'analytics') loadAnalytics();
  else if (preference === 'essential') removeCookies();
  else panel.hidden = false;
  reserveSpace();
})();
