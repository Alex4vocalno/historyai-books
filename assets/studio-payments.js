'use strict';

(function (root) {
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
  async function mount(parent, { signal, postJson, refresh }) {
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
      if (!data.ok) throw Error('Plans unavailable');
      wrap.appendChild(node('h4', '购买积分'));
      if (!data.checkoutEnabled) wrap.appendChild(node('p', '积分购买暂未开放，已有积分可继续使用。如需帮助，请联系支持。', 'account-note'));
      const plans = (data.plans || []).filter(plan => plan.checkoutEnabled !== false);
      if (data.checkoutEnabled && plans.length) {
        const requested = requestedPlan(plans);
        if (requested.missing) wrap.appendChild(node('p', '原先选择的套餐暂不可用，请重新选择。', 'account-note'));
        const form = node('form');
        const list = node('fieldset', '', 'account-credit-packs'); list.appendChild(node('legend', '选择积分套餐'));
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
        const button = node('button', data.mode === 'test' ? '前往测试结账' : '前往安全结账', 'account-primary'); button.type = 'submit';
        form.onsubmit = event => {
          event.preventDefault();
          const selected = form.querySelector('input[name="creditPack"]:checked');
          if (!selected) return;
          postJson('/api/billing/orders', { planId: selected.value }, async result => {
            const target = new URL(result.checkoutUrl);
            if (target.protocol !== 'https:' || !(target.hostname === 'checkout.stripe.com' || target.hostname === 'creem.io' || target.hostname.endsWith('.creem.io'))) throw Error('无效支付地址');
            root.location.assign(target.href);
          }, false);
        };
        form.append(list, node('p', data.mode === 'test' ? '测试交易，不产生真实扣款。' : '一次性购买，无自动续费。适用税费以结账页为准。', 'account-note'), button);
        wrap.appendChild(form);
      }
    } catch { if (!signal.aborted) wrap.appendChild(node('p', '积分套餐暂时无法读取，请稍后重试。', 'account-note')); }
    if (signal.aborted) return;
    wrap.appendChild(node('h4', '购买记录'));
    try {
      const data = await read('/api/billing/orders');
      if (signal.aborted) return;
      if (!data.ok) throw Error('Orders unavailable');
      const rows = data.orders || [];
      if (!rows.length) wrap.appendChild(node('p', '暂无购买记录', 'account-note'));
      const list = node('ol', '', 'account-ledger account-orders');
      for (const order of rows) {
        const row = node('li'), copy = node('div');
        copy.append(node('strong', order.planName), node('small', orderMessage(order)));
        const amount = new Intl.NumberFormat(root.__haiI18n?.lang === 'en' ? 'en-US' : 'zh-CN', { style: 'currency', currency: order.currency }).format(order.amountMinor / 100);
        row.append(copy, node('span', amount)); list.appendChild(row);
      }
      if (rows.length) wrap.appendChild(list);
    } catch { if (!signal.aborted) wrap.appendChild(node('p', '购买记录暂时无法读取', 'account-note')); }
  }
  const api = { mount, orderMessage, returnedOrder, requestedPlan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HAIStudioPayments = api;
})(typeof window === 'undefined' ? globalThis : window);
