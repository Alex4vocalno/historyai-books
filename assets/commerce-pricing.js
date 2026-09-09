'use strict';

(function () {
  function purchaseState(data, id) {
    if (data?.ok !== true || typeof data.checkoutEnabled !== 'boolean' || !Array.isArray(data.plans)) return { state: 'unavailable' };
    if (!data.checkoutEnabled) return { state: 'closed' };
    const plan = data.plans.find(row => row?.id === id);
    if (!plan || plan.checkoutEnabled !== true) return { state: 'closed' };
    if (!/^[A-Z]{3}$/.test(data.currency || '') || !Number.isSafeInteger(plan.amountMinor) || plan.amountMinor <= 0
      || !Number.isFinite(plan.credits) || plan.credits <= 0) return { state: 'unavailable' };
    return { state: 'ready', plan };
  }
  async function mount() {
    const en = document.documentElement.lang === 'en';
    const t = (zh, english) => en ? english : zh;
    const retry = document.querySelector('[data-pricing-retry]');
    const cards = [...document.querySelectorAll('[data-credit-plan]')];
    const load = async () => {
      retry.hidden = true;
      for (const card of cards) {
        const button = card.querySelector('button'); button.disabled = true;
        button.textContent = t('正在读取购买状态…', 'Checking availability…');
      }
      let data;
      try {
        const response = await fetch('/api/billing/plans', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(10000) });
        if (response.ok) data = await response.json();
      } catch { /* Keep purchase disabled until availability can be verified. */ }
      for (const card of cards) {
        const result = purchaseState(data, card.dataset.creditPlan);
        const button = card.querySelector('button');
        button.textContent = result.state === 'ready' ? t('选择套餐', 'Select pack')
          : result.state === 'closed' ? t('暂未开放购买', 'Purchases not yet available') : t('购买状态暂不可用', 'Availability unavailable');
        button.disabled = result.state !== 'ready';
        if (result.state === 'unavailable') retry.hidden = false;
        if (result.state !== 'ready') continue;
        card.querySelector('.price').textContent = new Intl.NumberFormat(en ? 'en-US' : 'zh-CN', { style: 'currency', currency: data.currency }).format(result.plan.amountMinor / 100) + ' ' + data.currency;
        card.querySelector('.credits').textContent = result.plan.credits.toLocaleString(en ? 'en-US' : 'zh-CN') + t(' 积分', ' credits');
        button.onclick = () => {
          const next = new URL('/account.html', location.origin);
          next.searchParams.set('tab', 'credits'); next.searchParams.set('plan', card.dataset.creditPlan);
          next.searchParams.set('lang', en ? 'en' : 'zh');
          location.assign(next.href);
        };
      }
    };
    retry.onclick = load;
    await load();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { purchaseState };
  else mount();
})();
