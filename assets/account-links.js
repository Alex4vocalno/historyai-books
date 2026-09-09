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
  const api = { safeReturn, loginUrl, displayName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EvoronAccountLinks = api;
})(typeof window === 'undefined' ? globalThis : window);
