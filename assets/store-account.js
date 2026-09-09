/* global document, window, localStorage, location */
'use strict';
(function () {
  const en = document.documentElement.lang.startsWith('en') || (() => { try { return localStorage.getItem('hai.shelfLang') === 'en'; } catch { return false; } })();
  const t = (zh, english) => en ? english : zh;
  const links = window.EvoronAccountLinks;
  document.querySelectorAll('[data-account-label="write"]').forEach(el => { el.textContent = t('开始写作', 'Start writing'); });
  document.querySelectorAll('[data-account-label="pricing"]').forEach(el => { el.textContent = t('积分方案', 'Writing credits'); el.href = en ? '/pricing-en.html' : '/pricing.html'; });
  const entry = document.querySelector('[data-store-account]');
  if (!entry) return;
  const params = new URLSearchParams(location.search);
  const destination = links.safeReturn(params.get('returnTo') || location.pathname + location.hash, location.origin);
  entry.href = links.loginUrl(destination, location.origin);
  entry.textContent = t('登录 / 注册', 'Sign in / Register');
  if (params.get('login') === '1') { location.replace(entry.href); return; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
    .then(response => { if (!response.ok) throw Error('Account unavailable'); return response.json(); })
    .then(async data => {
      if (!data.ok) throw Error('Account unavailable');
      if (!data.user) return;
      const menu = document.createElement('details'); menu.className = 'store-account-menu';
      const summary = document.createElement('summary'); summary.textContent = links.displayName(data.user);
      summary.setAttribute('aria-label', t('账号菜单', 'Account menu')); summary.setAttribute('translate', 'no');
      const list = document.createElement('nav'); list.setAttribute('aria-label', t('账号管理', 'Account management'));
      for (const [url, label] of [
        ['/me.html', t('我的主页', 'My page')], ['/account.html?tab=profile', t('账号与邮箱', 'Account & email')],
        ['/account.html?tab=security', t('账号安全', 'Security')], ['/account.html?tab=credits', t('积分与购买记录', 'Credits & orders')],
        ['mailto:support@evoronai.com', t('联系支持', 'Contact support')],
      ]) { const a = document.createElement('a'); a.href = url; a.textContent = label; list.appendChild(a); }
      const out = document.createElement('button'); out.type = 'button'; out.textContent = t('退出登录', 'Sign out');
      out.onclick = async () => {
        out.disabled = true;
        try {
          const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
          if (!response.ok || !(await response.json()).ok) throw Error('Logout failed');
          location.reload();
        } catch { out.textContent = t('退出失败，重试', 'Sign out failed. Retry'); out.disabled = false; }
      };
      list.appendChild(out); menu.append(summary, list); entry.replaceWith(menu);
      document.addEventListener('click', event => { if (!menu.contains(event.target)) menu.open = false; });
      document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.open) { menu.open = false; summary.focus(); } });
      try {
        const response = await fetch('/api/reader/notifications?countOnly=1', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        const notifications = response.ok && await response.json();
        if (notifications?.ok && Number.isFinite(notifications.unread) && notifications.unread > 0) {
          const badge = document.createElement('span'); badge.className = 'store-unread'; badge.textContent = String(Math.min(99, notifications.unread));
          badge.setAttribute('aria-label', t('未读通知', 'Unread notifications')); summary.appendChild(badge);
        }
      } catch { /* The account menu stays usable if notifications are unavailable. */ }
    }).catch(() => { entry.textContent = t('账号暂不可用', 'Account unavailable'); entry.href = '/account.html'; })
    .finally(() => clearTimeout(timeout));
})();
