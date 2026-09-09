'use strict';
(function () {
  const host = document.getElementById('account-root');
  const params = new URLSearchParams(location.search);
  const panel = window.HAIStudioAccount.create({
    container: host,
    returnFocus: () => null,
    loginUrl: () => window.EvoronAccountLinks.loginUrl(location.href, location.origin),
    onRefresh: async () => {
      const data = await window.HAIStudioSession.readJson('/api/auth/me', { cache: 'no-store' });
      if (!data.ok || !data.user) throw Error('Session expired');
    },
    onTabChange: tab => {
      const url = new URL(location.href); url.searchParams.set('tab', tab);
      history.replaceState(null, '', url.pathname + url.search);
    },
  });
  panel.open(window.HAIStudioPayments.returnedOrder() || params.has('plan') ? 'credits' : params.get('tab') || 'profile');
})();
