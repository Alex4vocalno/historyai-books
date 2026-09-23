'use strict';

(function (root) {
  function safeReturn(value, origin) {
    try {
      const url = new URL(value || '/', origin);
      const trusted = url.origin === origin || ['https://evoronai.com', 'https://write.evoronai.com'].includes(url.origin);
      if (!trusted || url.username || url.password || !['http:', 'https:'].includes(url.protocol)) return '/';
      if (/\/login\.html$/.test(url.pathname)) return '/';
      return url.origin === origin ? url.pathname + url.search + url.hash : url.href;
    } catch { return '/'; }
  }
  function loginUrl(returnTo, origin) {
    const base = origin === 'https://evoronai.com' ? 'https://write.evoronai.com' : origin;
    return base + '/login.html?returnTo=' + encodeURIComponent(new URL(safeReturn(returnTo, origin), origin).href);
  }
  function displayName(user) { return user?.penName || 'EVORON'; }
  function readingIntent(hash) {
    const params = new URLSearchParams(String(hash || '').slice(1));
    const topic = params.get('reading-topic') || '';
    if (!topic.trim() || topic.length > 200) return null;
    return { topic, language: ['zh', 'en'].includes(params.get('book-language')) ? params.get('book-language') : '',
      kind: ['fiction', 'nonfiction'].includes(params.get('book-kind')) ? params.get('book-kind') : '' };
  }
  function loginReturn(value, origin, hash) {
    const safe = safeReturn(value, origin);
    const url = new URL(safe, origin);
    if (readingIntent(hash) && ['/', '/studio.html'].includes(url.pathname)) url.hash = hash;
    return safeReturn(url.href, origin);
  }
  const api = { safeReturn, loginUrl, displayName, readingIntent, loginReturn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EvoronAccountLinks = api;
})(typeof window === 'undefined' ? globalThis : window);
