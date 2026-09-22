'use strict';

(function (root) {
  const valid = value => ['system', 'zh', 'en'].includes(value);
  function resolve(preference, navigator) {
    if (preference === 'zh' || preference === 'en') return preference;
    return /^zh(?:-|$)/i.test(navigator?.languages?.[0] || navigator?.language || 'en') ? 'zh' : 'en';
  }
  function create(win) {
    let preference = 'system', userId = null, revision = 0, sequence = 0, loaded = false, saving = false;
    const cookieName = 'evoron_ui_language';
    const channel = typeof win.BroadcastChannel === 'function' ? new win.BroadcastChannel('evoron-ui-language') : null;
    function guestPreference() {
      const match = win.document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(cookieName + '='));
      const value = match?.slice(cookieName.length + 1);
      return valid(value) ? value : 'system';
    }
    preference = guestPreference();
    const state = () => ({ preference, language: resolve(preference, win.navigator), authenticated: Boolean(userId), loaded });
    let lastAnnounced = JSON.stringify(state());
    function announce() {
      const next = JSON.stringify(state());
      if (next === lastAnnounced) return;
      lastAnnounced = next;
      win.dispatchEvent(new win.CustomEvent('evoron:language', { detail: state() }));
    }
    async function refresh() {
      if (saving) return state();
      const request = ++sequence;
      const controller = new win.AbortController();
      const timeout = win.setTimeout(() => controller.abort(), 10000);
      try {
        const response = await win.fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error('Account unavailable');
        const data = await response.json();
        if (!data.ok) throw Error('Account unavailable');
        if (request !== sequence) return state();
        userId = data.user?.mode !== 'local-owner' ? data.user?.id || null : null;
        revision = data.user?.uiLanguageRevision || 0;
        preference = userId && valid(data.user.uiLanguage) ? data.user.uiLanguage : guestPreference();
        loaded = true; announce(); return state();
      } finally { win.clearTimeout(timeout); }
    }
    async function save(value) {
      if (!valid(value) || saving) throw Error('Invalid preference');
      // Re-read identity before writing: never persist an unknown account's preference as a guest.
      await refresh();
      if (saving) throw Error('Preference save in progress');
      saving = true; sequence++;
      try {
        if (userId) {
          const controller = new win.AbortController();
          const timeout = win.setTimeout(() => controller.abort(), 10000);
          try {
            const response = await win.fetch('/api/auth/ui-language', {
              method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
              headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: value, revision }),
            });
            const data = await response.json();
            if (!response.ok || !data.ok) throw Object.assign(Error(data.error || 'Preference not saved'), { code: data.code });
            revision = data.revision;
          } finally { win.clearTimeout(timeout); }
        } else {
          const shared = ['evoronai.com', 'write.evoronai.com'].includes(win.location.hostname);
          win.document.cookie = cookieName + '=' + value + '; Path=/; Max-Age=31536000; SameSite=Lax' + (shared ? '; Domain=evoronai.com' : '') + (win.location.protocol === 'https:' ? '; Secure' : '');
          if (guestPreference() !== value) throw Error('Browser preference storage unavailable');
        }
        preference = value; announce(); channel?.postMessage('changed'); return state();
      } finally { saving = false; }
    }
    win.addEventListener('languagechange', announce);
    if (channel) channel.onmessage = event => { if (event.data === 'changed') refresh().catch(() => {}); };
    win.addEventListener('focus', () => refresh().catch(() => {}));
    win.document.addEventListener('visibilitychange', () => {
      if (win.document.visibilityState === 'visible') refresh().catch(() => {});
    });
    return { state, refresh, save };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { resolve, create };
  else {
    if (root.EvoronLanguage) return;
    root.EvoronLanguage = create(root);
    root.EvoronLanguage.refresh().catch(() => {});
  }
})(typeof window === 'undefined' ? globalThis : window);
