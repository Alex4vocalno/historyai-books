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
    const button = document.querySelector('[data-pricing-continue]');
    const status = document.querySelector('[data-pricing-status]');
    const requested = new URL(location.href).searchParams.get('plan');
    let selected = requested || cards[0]?.dataset.creditPlan;
    let data;
    const money = amount => new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency }).format(amount / 100);
    const update = () => {
      const result = purchaseState(data, selected);
      button.disabled = result.state !== 'ready';
      const card = cards.find(row => row.dataset.creditPlan === selected);
      for (const row of cards) row.querySelector('input').checked = row === card;
      document.querySelector('[data-summary-name]').textContent = card?.querySelector('[data-plan-name]').textContent || t('请选择积分包', 'Choose a credit pack');
      const credits = document.querySelector('[data-summary-credits]');
      const total = document.querySelector('[data-summary-total]');
      if (result.state === 'ready') {
        const unit = document.createElement('span'); unit.textContent = t('创作积分', 'writing credits');
        credits.replaceChildren(document.createTextNode(result.plan.credits.toLocaleString(en ? 'en-US' : 'zh-CN') + ' '), unit);
        const currency = document.createElement('small'); currency.textContent = data.currency;
        total.replaceChildren(document.createTextNode(money(result.plan.amountMinor) + ' '), currency);
        status.textContent = '';
      } else {
        credits.textContent = total.textContent = '—';
        status.textContent = data?.ok === true
          ? t('这款积分包暂不可选，请选择其他积分包。', 'This pack is unavailable. Please choose another pack.')
          : t('暂时无法确认价格，请重新加载后继续。', 'We could not confirm prices. Please try again before continuing.');
      }
      const language = document.querySelector('[data-commerce-language]');
      if (language) {
        const next = new URL(language.href);
        if (selected) next.searchParams.set('plan', selected);
        language.href = next.href;
      }
    };
    for (const card of cards) card.querySelector('input').addEventListener('change', () => {
      selected = card.dataset.creditPlan;
      const url = new URL(location.href); url.searchParams.set('plan', selected);
      history.replaceState(null, '', url);
      update();
    });
    button.onclick = () => {
      if (purchaseState(data, selected).state !== 'ready') return;
      const next = new URL('/account.html', location.origin);
      next.searchParams.set('tab', 'credits'); next.searchParams.set('plan', selected);
      next.searchParams.set('lang', en ? 'en' : 'zh');
      location.assign(next.href);
    };
    const load = async () => {
      retry.hidden = true;
      button.disabled = true;
      status.textContent = '';
      button.textContent = t('正在获取价格…', 'Loading prices…');
      for (const card of cards) {
        card.querySelector('input').disabled = true;
      }
      data = undefined;
      try {
        const response = await fetch('/api/billing/plans', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(10000) });
        if (response.ok) data = await response.json();
      } catch { /* Keep purchase disabled until availability can be verified. */ }
      for (const card of cards) {
        const result = purchaseState(data, card.dataset.creditPlan);
        card.querySelector('input').disabled = result.state === 'unavailable';
        if (result.state === 'unavailable') retry.hidden = false;
        if (result.state === 'unavailable') continue;
        const price = card.querySelector('.price');
        const currency = document.createElement('span'); currency.textContent = data.currency;
        price.replaceChildren(document.createTextNode(money(result.plan.amountMinor) + ' '), currency);
        card.querySelector('.credits').textContent = result.plan.credits.toLocaleString(en ? 'en-US' : 'zh-CN') + t(' 积分', ' credits');
        const unit = card.querySelector('[data-unit-price]');
        if (unit) unit.textContent = unitPrice(result.plan, data.currency) + t(' / 100 积分', ' / 100 credits');
      }
      button.textContent = t('继续购买', 'Continue');
      update();
    };
    retry.onclick = load;
    await load();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { purchaseState, unitPrice };
  else mount();
})();
