'use strict';

(function (root) {
  function checkoutUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port
        && (url.hostname === 'checkout.stripe.com' || url.hostname === 'creem.io' || url.hostname.endsWith('.creem.io')) ? url.href : '';
    } catch { return ''; }
  }
  function checkoutFailure(code, en = false) {
    if (['PAYMENT_PROVIDER_DISABLED', 'PAYMENT_PRODUCT_UNCONFIGURED', 'PAYMENT_RETURN_URL_UNCONFIGURED'].includes(code)) return en
      ? 'Checkout is temporarily unavailable. This attempt did not create a checkout or take payment. Please retry later or contact support.'
      : '暂时无法前往结账。本次未创建结账，也未扣款。请稍后重试或联系支持。';
    if (code === 'PAYMENT_PLAN_NOT_FOUND') return en ? 'This pack is no longer available. Please choose another pack.' : '此积分包暂不可用，请选择其他积分包。';
    if (code === 'PURCHASE_AGE_REQUIRED') return en ? 'Please confirm that you are at least 18 years old.' : '请确认已年满 18 岁。';
    if (code === 'AUTH_REQUIRED') return en ? 'Please sign in again to continue your purchase.' : '请重新登录后继续购买。';
    return en ? 'We could not confirm the checkout or payment status. Check your orders before retrying. Do not pay again for a pending or completed payment.'
      : '暂时无法确认结账或付款状态。请先查询购买记录再重试；如付款已在处理或已完成，请勿重复付款。';
  }
  function orderMessage(order, en = false) {
    const labels = {
      paid: ['付款已确认，积分已到账', 'Payment confirmed; credits added'],
      refunded: ['已退款，积分已调整', 'Refunded; credits adjusted'],
      partially_refunded: ['已部分退款，积分已调整', 'Partially refunded; credits adjusted'],
      refund_pending: ['退款处理中', 'Refund in progress'],
      checkout_failed: ['结账未完成，尚未确认付款', 'Checkout incomplete; payment not confirmed'],
    };
    return labels[order?.status]?.[en ? 1 : 0] || (en
      ? 'Payment has not been confirmed; credits have not been added. Check again later. No need to pay again.'
      : '尚未收到付款确认，积分未入账。可稍后查询，无需重复付款。');
  }
  function purchasePlans(data) {
    if (data?.ok !== true || !/^[A-Z]{3}$/.test(data.currency || '') || !Array.isArray(data.plans)) return [];
    const ids = new Set();
    return data.plans.filter(plan => {
      if (!plan || typeof plan.id !== 'string' || !plan.id.trim() || ids.has(plan.id)
        || !Number.isSafeInteger(plan.amountMinor) || plan.amountMinor <= 0 || !Number.isFinite(plan.credits) || plan.credits <= 0) return false;
      ids.add(plan.id); return true;
    });
  }
  function orderSupportUrl(order, en = false) {
    const id = /^[A-Za-z0-9_-]{1,120}$/.test(order?.orderId || '') ? order.orderId : '';
    const subject = en ? 'EvoronAI purchase support' : 'EvoronAI 购买求助';
    const body = [en ? 'Please help me check this purchase.' : '请协助核查这笔购买。',
      id ? (en ? 'Order reference: ' : '订单编号：') + id : '',
      en ? 'Issue (payment / credits / refund): ' : '遇到的问题（付款 / 积分 / 退款）：',
      en ? 'Please do not include passwords or full card details.' : '请勿填写密码或完整银行卡信息。'].filter(Boolean).join('\n');
    return `mailto:support@evoronai.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  async function requestCheckout(planId) {
    // readJson discards non-2xx bodies; checkout needs the server error code to distinguish known failures from unknown outcomes.
    const response = await root.fetch('/api/billing/orders', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, ageConfirmed: true }), signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok || result?.ok !== true) return { ok: false, code: result?.code };
    const target = checkoutUrl(result.checkoutUrl);
    if (!target) throw Error('Invalid checkout URL');
    return { ok: true, checkoutUrl: target };
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
  const api = { checkoutUrl, checkoutFailure, orderMessage, purchasePlans, returnedOrder, requestedPlan, requestCheckout, orderSupportUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HAIStudioPayments = api;
})(typeof window === 'undefined' ? globalThis : window);
