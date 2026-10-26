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
  try {
    // Never trust a saved Allow if a later withdrawal cannot be persisted.
    localStorage.setItem(storageKey + '-check', '1');
    localStorage.removeItem(storageKey + '-check');
    preference = localStorage.getItem(storageKey);
  } catch (error) {}
  var returnFocus = null;
  var loaded = false;
  var panel = document.createElement('aside');
  panel.id = 'cookie-consent-panel';
  panel.className = 'cookie-banner';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'cookie-banner-title');
  var privacyURL = new URL('../../privacy/', script.src).href;
  panel.innerHTML = '<div><h2 id="cookie-banner-title">Analytics cookies</h2><p>I would like to use Google Analytics to understand how visitors use this site. It stays off unless you allow it. <a href="' + privacyURL + '">Privacy notice</a></p></div><div class="cookie-actions"><button type="button" class="button button-primary" data-cookie-choice="analytics">Allow analytics cookies</button><button type="button" class="button button-secondary" data-cookie-choice="essential">Reject analytics cookies</button></div>';
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
  /** Load this production stream once, after an explicit opt-in. */
  function loadAnalytics() {
    if (!canTrack || loaded || preference !== 'analytics') return;
    loaded = true;
    window['ga-disable-' + measurementId] = false;
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
      if (preference === 'analytics') loadAnalytics();
      else {
        if (measurementId) window['ga-disable-' + measurementId] = true;
        removeCookies();
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
  if (preference === 'analytics') loadAnalytics();
  else if (preference === 'essential') removeCookies();
  else panel.hidden = false;
  reserveSpace();
})();
