'use strict';

(function (root) {
  let pendingCheckout = null;
  function checkoutFailure(code, en) {
    if (code === 'PAYMENT_PROVIDER_DISABLED') {
      return en ? 'Unable to connect to the payment service at the moment. Please retry later or contact support. No checkout was created and no payment was taken for this attempt.'
        : '暂时无法连接支付服务，请稍后重试或联系支持。本次未创建结账，也未扣款。';
    }
    if (code === 'PAYMENT_PRODUCT_UNCONFIGURED') {
      return en ? 'Payment setup is incomplete. No checkout was created and no payment was taken for this attempt. Please retry later or contact support.'
        : '支付服务尚未配置完成，本次未创建结账，也未扣款。请稍后重试或联系支持。';
    }
    if (code === 'PAYMENT_PLAN_NOT_FOUND') return en ? 'This pack is unavailable. No checkout was created. Please choose another pack or contact support.' : '该套餐不可用，本次未创建结账。请重新选择套餐或联系支持。';
    if (code === 'PURCHASE_AGE_REQUIRED') return en ? 'You must confirm that you are at least 18 before purchasing.' : '购买前请确认已年满 18 岁。';
    if (code === 'AUTH_REQUIRED') return en ? 'Please sign in again before purchasing.' : '请重新登录后购买。';
    return en ? 'We could not confirm the checkout or payment status. Check your purchase history before retrying; do not pay again if payment is already pending or complete. Contact support for help.'
      : '暂时无法确认结账或付款状态。请先核对购买记录再重试；如付款已在处理或已完成，请勿重复付款。需要帮助请联系支持。';
  }
  async function requestCheckout(planId) {
    // readJson discards non-2xx bodies; checkout needs the server error code to distinguish known failures from unknown outcomes.
    const response = await root.fetch('/api/billing/orders', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, ageConfirmed: true }), signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok || result?.ok !== true) return { ok: false, code: result?.code };
    const target = new URL(result.checkoutUrl);
    if (target.protocol !== 'https:' || !(target.hostname === 'checkout.stripe.com' || target.hostname === 'creem.io' || target.hostname.endsWith('.creem.io'))) throw Error('Invalid checkout URL');
    return { ok: true, checkoutUrl: target.href };
  }
  function orderMessage(order) {
    const labels = {
      paid: '付款已确认，积分已到账', refunded: '已退款，积分已调整',
      partially_refunded: '已部分退款，积分已调整', refund_pending: '退款处理中',
      checkout_failed: '订单创建未完成，尚未确认付款',
    };
    return labels[order?.status] || '尚未收到付款确认，积分未入账。可稍后查询，无需重复付款。';
  }
  function returnedOrder() {
    const params = new URLSearchParams(root.location.search);
    const id = params.get('order') || '';
    return /^[A-Za-z0-9_-]{1,120}$/.test(id) ? id : '';
  }
  function requestedPlan(plans, search = root.location.search) {
    const id = new URLSearchParams(search).get('plan');
    if (!id) return { id: plans[0]?.id || '', missing: false };
    return { id: plans.some(plan => plan.id === id) ? id : '', missing: !plans.some(plan => plan.id === id) };
  }
  async function mount(parent, { signal, refresh }) {
    const en = root.__haiI18n?.lang === 'en';
    const t = (zh, english) => en ? english : zh;
    const node = (tag, text, className) => {
      const el = document.createElement(tag);
      if (text) el.textContent = text;
      if (className) el.className = className;
      return el;
    };
    const wrap = node('section', '', 'account-payments'); parent.appendChild(wrap);
    const read = url => root.HAIStudioSession.readJson(url, { signal, cache: 'no-store' });
    const orderId = returnedOrder();
    if (orderId) {
      const status = node('p', '正在查询付款结果…', 'account-note'); status.setAttribute('role', 'status');
      const check = node('button', '查询付款结果'); check.type = 'button';
      wrap.append(status, check);
      const query = async (refreshAfter = false) => {
        check.disabled = true;
        try {
          const data = await read(`/api/billing/orders/${encodeURIComponent(orderId)}`);
          if (signal.aborted) return;
          status.textContent = data.ok && data.order ? orderMessage(data.order) : '未能查询到本账号的订单，请稍后重试或联系支持。';
          if (refreshAfter && ['paid', 'partially_refunded', 'refunded'].includes(data.order?.status)) await refresh();
        } catch { if (!signal.aborted) status.textContent = '付款结果暂时无法查询，请稍后重试，勿重复付款。'; }
        finally { check.disabled = false; }
      };
      check.onclick = () => query(true); await query();
    }
    try {
      const data = await read('/api/billing/plans');
      if (signal.aborted) return;
      if (data.ok !== true) throw Error('Plans unavailable');
      if (!Array.isArray(data.plans) || !/^[A-Z]{3}$/.test(data.currency || '')) throw Error('Invalid plans');
      wrap.appendChild(node('h4', t('购买积分', 'Buy credits')));
      const plans = data.plans.filter(plan => plan && typeof plan.id === 'string' && plan.id.trim()
        && Number.isSafeInteger(plan.amountMinor) && plan.amountMinor > 0 && Number.isFinite(plan.credits) && plan.credits > 0);
      if (plans.length) {
        const requested = requestedPlan(plans);
        if (requested.missing) wrap.appendChild(node('p', t('原先选择的套餐暂不可用，请重新选择。', 'The selected pack is unavailable. Please select another pack.'), 'account-note'));
        const form = node('form');
        const list = node('fieldset', '', 'account-credit-packs'); list.appendChild(node('legend', t('选择积分套餐', 'Select a credit pack')));
        const locale = root.__haiI18n?.lang === 'en' ? 'en-US' : 'zh-CN';
        for (const plan of plans) {
          const row = node('label', '', 'account-pack');
          const radio = node('input'); radio.type = 'radio'; radio.name = 'creditPack'; radio.value = plan.id; radio.checked = plan.id === requested.id; radio.required = true;
          radio.onchange = () => {
            const url = new URL(root.location.href); url.searchParams.set('plan', plan.id);
            root.history.replaceState(null, '', url.pathname + url.search + url.hash);
          };
          const price = new Intl.NumberFormat(locale, { style: 'currency', currency: data.currency }).format(plan.amountMinor / 100);
          const copy = node('span'); copy.append(node('strong', `${plan.credits.toLocaleString(locale)} ${locale === 'en-US' ? 'credits' : '积分'}`), node('small', price));
          row.append(radio, copy); list.appendChild(row);
        }
        const button = node('button', '', 'account-primary'); button.type = 'submit';
        const canCheckout = () => plans.some(plan => plan.id === form.querySelector('input[name="creditPack"]:checked')?.value);
        const updateCheckout = () => {
          if (signal.aborted) return;
          button.disabled = Boolean(pendingCheckout) || !canCheckout();
          form.setAttribute('aria-busy', String(Boolean(pendingCheckout)));
          list.disabled = Boolean(pendingCheckout); age.disabled = Boolean(pendingCheckout);
          button.textContent = pendingCheckout ? t('正在创建结账…', 'Creating checkout…')
            : data.mode === 'test' ? t('前往测试结账', 'Continue to test checkout') : t('前往安全结账', 'Continue to secure checkout');
        };
        form.addEventListener('change', updateCheckout);
        const eligibility = node('label', '', 'account-confirm');
        const age = node('input'); age.type = 'checkbox'; age.name = 'ageConfirmed'; age.required = true;
        eligibility.append(age, node('span', locale === 'en-US' ? 'I confirm that I am at least 18 years old.' : '我确认已年满 18 岁。'));
        const checkoutStatus = node('p', '', 'account-note'); checkoutStatus.setAttribute('role', 'status');
        form.onsubmit = event => {
          event.preventDefault();
          const selected = form.querySelector('input[name="creditPack"]:checked');
          if (signal.aborted || pendingCheckout || !selected || !age.checked || !canCheckout()) return;
          checkoutStatus.textContent = ''; checkoutStatus.setAttribute('role', 'status');
          pendingCheckout = requestCheckout(selected.value).then(result => {
            if (signal.aborted) return;
            if (result.ok) root.location.assign(result.checkoutUrl);
            else {
              checkoutStatus.setAttribute('role', 'alert');
              checkoutStatus.textContent = checkoutFailure(result.code, en);
            }
          }).catch(() => {
            if (!signal.aborted) {
              checkoutStatus.setAttribute('role', 'alert');
              checkoutStatus.textContent = checkoutFailure('', en);
            }
          }).finally(() => { pendingCheckout = null; updateCheckout(); });
          updateCheckout();
        };
        form.append(list, node('p', data.mode === 'test' ? t('测试交易，不产生真实扣款。', 'Test transaction; no real payment is taken.') : t('一次性购买，无自动续费。适用税费以结账页为准。', 'One-time purchase, no automatic renewal. Applicable taxes are shown at checkout.'), 'account-note'),
          node('p', locale === 'en-US' ? 'Purchased credits do not automatically expire. Refund requests are reviewed individually; statutory rights remain unaffected.' : '已购积分不自动过期。退款逐单人工审核，法定权利不受影响。', 'account-note'), eligibility, button);
        const links = node('p', '', 'account-note');
        for (const [id, zh, en] of [['terms', '服务条款', 'Terms of Service'], ['privacy', '隐私政策', 'Privacy Policy'], ['refunds', '退款政策', 'Refund Policy'], ['support', '联系支持', 'Contact support']]) {
          if (links.childNodes.length) links.append(document.createTextNode(' · '));
          const link = node('a', locale === 'en-US' ? en : zh);
          link.href = `/${id}${locale === 'en-US' ? '-en' : ''}.html`;
          link.target = '_blank'; link.rel = 'noopener'; links.appendChild(link);
        }
        form.append(checkoutStatus, links);
        updateCheckout();
        if (pendingCheckout) pendingCheckout.finally(updateCheckout);
        wrap.appendChild(form);
      } else wrap.appendChild(node('p', t('暂无有效套餐，请稍后重试或联系支持。', 'No valid packs were found. Please retry later or contact support.'), 'account-note'));
    } catch { if (!signal.aborted) wrap.appendChild(node('p', t('积分套餐暂时无法读取，请稍后重试。', 'Credit packs could not be loaded. Please retry later.'), 'account-note')); }
    if (signal.aborted) return;
    wrap.appendChild(node('h4', t('购买记录', 'Purchase history')));
    try {
      const data = await read('/api/billing/orders');
      if (signal.aborted) return;
      if (!data.ok) throw Error('Orders unavailable');
      const rows = data.orders || [];
      if (!rows.length) wrap.appendChild(node('p', t('暂无购买记录', 'No purchases yet'), 'account-note'));
      const list = node('ol', '', 'account-ledger account-orders');
      for (const order of rows) {
        const row = node('li'), copy = node('div');
        copy.append(node('strong', order.planName), node('small', orderMessage(order)));
        const amount = new Intl.NumberFormat(root.__haiI18n?.lang === 'en' ? 'en-US' : 'zh-CN', { style: 'currency', currency: order.currency }).format(order.amountMinor / 100);
        row.append(copy, node('span', amount)); list.appendChild(row);
      }
      if (rows.length) wrap.appendChild(list);
    } catch { if (!signal.aborted) wrap.appendChild(node('p', t('购买记录暂时无法读取', 'Purchase history is currently unavailable'), 'account-note')); }
  }
  const api = { mount, orderMessage, returnedOrder, requestedPlan, checkoutFailure, requestCheckout };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HAIStudioPayments = api;
})(typeof window === 'undefined' ? globalThis : window);
