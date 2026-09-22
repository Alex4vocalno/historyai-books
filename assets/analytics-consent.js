'use strict';

(function (root) {
  const COOKIE = 'evoron_analytics_v1';
  const HOSTS = ['evoronai.com', 'www.evoronai.com', 'write.evoronai.com'];
  const EVENTS = new Set(['page_view', 'reading_start', 'chapter_end_reached', 'shelf_saved', 'sign_up', 'setup_confirmed', 'writing_requested']);

  function pageKind(location) {
    const path = location.pathname;
    if (/^\/books\/[^/]+\/(?:releases\/[^/]+\/)?(?:ch-\d+|read)\.html$/.test(path)) return 'reader';
    if (/^\/books\/[^/]+\/(?:releases\/[^/]+\/)?index\.html$/.test(path)) return 'book';
    if (/^\/read\//.test(path)) return 'private_reader';
    if (/^\/about(?:-[a-z]+)*\.html$/.test(path)) return 'about';
    if (/^\/(?:studio\.html)?$/.test(path) && location.hostname === 'write.evoronai.com' || path === '/studio.html') return 'studio';
    const name = path.replace(/^\//, '').replace(/-en(?=\.html$)/, '');
    return ({ '': 'library', 'index.html': 'library', 'shelf.html': 'shelf', 'rank.html': 'rank', 'feed.html': 'community', 'me.html': 'profile', 'account.html': 'account', 'login.html': 'login', 'pricing.html': 'pricing', 'about.html': 'about', 'privacy.html': 'policy', 'terms.html': 'policy', 'policies.html': 'policy', 'refunds.html': 'policy', 'acceptable-use.html': 'policy' })[name] || 'other';
  }

  function create(win, config) {
    const doc = win.document;
    const live = config.enabled === true && HOSTS.includes(win.location.hostname) && win.location.protocol === 'https:';
    let loaded = false;
    let active = false;
    let choice = readChoice();
    const seen = new Set();
    const id = 'G-T9PGH7DZFV';
    const disabled = 'ga-disable-' + id;
    win[disabled] = true;
    function readChoice() {
      const match = doc.cookie.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
      const value = match?.slice(COOKIE.length + 1);
      return value === 'granted' || value === 'denied' ? value : '';
    }
    function language() {
      if (/-en\.html$/.test(win.location.pathname)) return 'en';
      return win.EvoronLanguage?.state().language || (/^en/i.test(doc.documentElement.lang) ? 'en' : 'zh');
    }
    function fields() {
      const kind = pageKind(win.location);
      return { page_location: win.location.origin + '/analytics/' + kind, page_title: 'EvoronAI | ' + kind, page_referrer: '', page_type: kind, language: language() };
    }
    function command() { win.dataLayer.push(arguments); }
    function clearCookies() {
      const names = doc.cookie.split(';').map(s => s.trim().split('=')[0]).filter(n => /^_ga(?:_|$)/.test(n));
      for (const name of names) {
        for (const domain of ['', '; Domain=' + win.location.hostname, '; Domain=evoronai.com']) {
          doc.cookie = name + '=; Path=/; Max-Age=0; SameSite=Lax' + domain;
        }
      }
    }
    function revoke() {
      active = false;
      win[disabled] = true;
      if (loaded) win.dataLayer.length = 0;
      clearCookies();
    }
    function track(name) {
      if (!live || !loaded || readChoice() !== 'granted' || win[disabled] || !EVENTS.has(name)) return false;
      try {
        command('event', name, { ...fields(), send_to: id });
        return true;
      } catch { return false; }
    }
    function once(name) {
      if (!seen.has(name) && track(name)) seen.add(name);
    }
    function activate() {
      if (!live || choice !== 'granted' || active) return;
      active = true;
      win[disabled] = false;
      win.dataLayer = win.dataLayer || [];
      command('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      command('set', fields());
      command('config', id, { ...fields(), send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, cookie_domain: 'none', cookie_expires: 15552000, cookie_update: false });
      if (!loaded) {
        loaded = true;
        command('js', new Date());
        const script = doc.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
        script.referrerPolicy = 'no-referrer';
        doc.head.append(script);
      }
      once('page_view');
      if (pageKind(win.location) === 'reader') once('reading_start');
    }
    function refresh() {
      const next = readChoice();
      if (next === choice) return;
      choice = next;
      if (choice === 'granted') activate(); else revoke();
    }
    function choose(value) {
      if (!['granted', 'denied'].includes(value)) return;
      doc.cookie = COOKIE + '=' + value + '; Path=/; Max-Age=15552000; SameSite=Lax'
        + (HOSTS.includes(win.location.hostname) ? '; Domain=evoronai.com' : '')
        + (win.location.protocol === 'https:' ? '; Secure' : '');
      choice = readChoice();
      // Storage blocked: no persistent consent, so do not load analytics.
      if (choice === 'granted') activate(); else revoke();
    }
    if (choice === 'granted') activate(); else revoke();
    return { track, once, choose, refresh, language, state: () => readChoice() };
  }

  function install(win, config) {
    if (win.EvoronAnalytics) return;
    const preview = ['localhost', '127.0.0.1'].includes(win.location.hostname) && new URLSearchParams(win.location.search).get('analytics-preview') === '1';
    if (!config.enabled && !preview) return;
    const api = win.EvoronAnalytics = create(win, config);
    const doc = win.document;
    const panel = doc.createElement('section');
    panel.className = 'analytics-consent'; panel.setAttribute('role', 'region'); panel.setAttribute('aria-labelledby', 'analytics-heading');
    panel.innerHTML = '<h2 id="analytics-heading"></h2><p></p><a data-policy></a><div class="analytics-actions"><button type="button" data-deny></button><button type="button" data-accept></button></div>';
    const entry = doc.createElement('button');
    entry.type = 'button'; entry.className = 'analytics-settings';
    const footer = doc.querySelector('#rail,.settings,footer,.footer,.commerce-links');
    (footer || doc.body).append(entry);
    doc.body.append(panel);
    let returnFocus = null;
    function paint() {
      const en = api.language() === 'en';
      panel.querySelector('h2').textContent = en ? 'Your privacy, your choice' : '由你决定是否分享使用统计';
      panel.querySelector('p').textContent = en ? 'With your permission, Google Analytics helps us understand how people use our library and studio. We do not send your manuscripts, conversations or email. Declining will not affect reading or writing. You can withdraw at any time in Analytics settings.' : '经你同意，我们才使用 Google Analytics 了解书城与工作台的使用情况。不会发送你的书稿、对话或邮箱。拒绝不影响阅读和写作，可随时在“统计设置”中撤回。';
      panel.querySelector('[data-policy]').textContent = en ? 'Analytics & privacy' : '统计与隐私说明';
      panel.querySelector('[data-policy]').href = '/analytics-privacy' + (en ? '-en' : '') + '.html';
      panel.querySelector('[data-deny]').textContent = en ? 'Essential only' : '仅必要功能';
      panel.querySelector('[data-accept]').textContent = en ? 'Allow analytics' : '允许使用统计';
      entry.textContent = en ? 'Analytics settings' : '统计设置';
    }
    function close(value) { api.choose(value); panel.hidden = true; returnFocus?.focus(); }
    panel.querySelector('[data-deny]').addEventListener('click', () => close('denied'));
    panel.querySelector('[data-accept]').addEventListener('click', () => close('granted'));
    entry.addEventListener('click', () => { returnFocus = entry; paint(); panel.hidden = false; panel.querySelector('[data-deny]').focus(); });
    panel.hidden = Boolean(api.state()); paint();
    win.addEventListener('evoron:language', paint);
    win.addEventListener('focus', () => { api.refresh(); panel.hidden = Boolean(api.state()); });
    win.setInterval(api.refresh, 1000);
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { create, install, pageKind };
  else if (root.document.readyState !== 'complete') root.document.addEventListener('DOMContentLoaded', () => install(root, root.EvoronAnalyticsConfig || {}), { once: true });
  else install(root, root.EvoronAnalyticsConfig || {});
})(typeof window === 'undefined' ? globalThis : window);
