'use strict';

(function () {
  function unitPrice(plan, currency) {
    if (!Number.isSafeInteger(plan?.amountMinor) || plan.amountMinor <= 0 || !Number.isFinite(plan?.credits) || plan.credits <= 0 || !/^[A-Z]{3}$/.test(currency || '')) return '';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(plan.amountMinor / plan.credits);
  }
  function purchaseState(data, id) {
    if (typeof id !== 'string' || !id.trim()) return { state: 'unavailable' };
    if (data?.ok !== true || !Array.isArray(data.plans)) return { state: 'unavailable' };
    const plan = data.plans.find(row => row?.id === id);
    if (!plan) return { state: 'unavailable' };
    if (!/^[A-Z]{3}$/.test(data.currency || '') || !Number.isSafeInteger(plan.amountMinor) || plan.amountMinor <= 0
      || !Number.isFinite(plan.credits) || plan.credits <= 0) return { state: 'unavailable' };
    return { state: 'ready', plan };
  }
  async function mount() {
    const en = document.documentElement.lang === 'en';
    const t = (zh, english) => en ? english : zh;
    const retry = document.querySelector('[data-pricing-retry]');
    const cards = [...document.querySelectorAll('[data-credit-plan]')];
    for (const card of cards) {
      const status = document.createElement('p');
      status.dataset.packStatus = ''; status.setAttribute('role', 'status');
      card.appendChild(status);
    }
    const load = async () => {
      retry.hidden = true;
      for (const card of cards) {
        const button = card.querySelector('button'); button.disabled = true;
        button.onclick = null;
        card.querySelector('[data-pack-status]').textContent = '';
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
        button.textContent = result.state === 'ready' ? t('选择套餐', 'Select pack') : t('购买状态暂不可用', 'Availability unavailable');
        button.disabled = result.state === 'unavailable';
        if (result.state === 'unavailable') retry.hidden = false;
        if (result.state === 'unavailable') continue;
        const price = card.querySelector('.price');
        const currency = document.createElement('span'); currency.textContent = data.currency;
        price.replaceChildren(document.createTextNode(new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency }).format(result.plan.amountMinor / 100) + ' '), currency);
        card.querySelector('.credits').textContent = result.plan.credits.toLocaleString(en ? 'en-US' : 'zh-CN') + t(' 积分', ' credits');
        const unit = card.querySelector('[data-unit-price]');
        if (unit) unit.textContent = unitPrice(result.plan, data.currency) + t(' / 100 积分', ' / 100 credits');
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
  if (typeof module !== 'undefined' && module.exports) module.exports = { purchaseState, unitPrice };
  else mount();
})();
