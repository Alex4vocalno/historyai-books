'use strict';

(function (root) {
  let checkoutInFlight = false;
  function passwordError(oldPassword, password, confirmation) {
    if (!oldPassword.trim()) return '请输入当前密码';
    if (password.trim().length < 6) return '新密码至少需要 6 位';
    if (password !== confirmation) return '两次输入的新密码不一致';
    return '';
  }
  function balanceText(balance) {
    if (!balance) return '暂不可用';
    if (balance.unlimited) return '不限额度';
    return Number.isFinite(balance.remaining) ? balance.remaining.toLocaleString('zh-CN') : '暂不可用';
  }

  function create({ onRefresh, returnFocus, container, onTabChange = () => {}, loginUrl = () => '/login.html?returnTo=' + encodeURIComponent(root.location.href) }) {
    let dialog = null, panel, status, navigation, user, pending = false, generation = 0, sessionEnded = false;
    let readController, consent;
    const en = () => (root.__haiI18n?.lang || new URLSearchParams(root.location?.search || '').get('lang')) === 'en';
    const t = (zh, english) => en() ? english : zh;
    function resumeCheckout(event) {
      if (!event.persisted || !dialog || !checkoutInFlight) return;
      checkoutInFlight = false; setPending(false); show('credits');
    }
    const node = (tag, text, className) => {
      const el = document.createElement(tag);
      if (text !== undefined) el.textContent = text;
      if (className) el.className = className;
      return el;
    };
    function message(text, error = false) {
      status.textContent = text;
      status.dataset.kind = error ? 'error' : 'success';
      status.setAttribute('role', error ? 'alert' : 'status');
    }
    function setPending(value) {
      pending = value;
      dialog.setAttribute('aria-busy', String(value));
      dialog.querySelectorAll('button, input').forEach(el => { el.disabled = value; });
      if (sessionEnded) navigation.querySelectorAll('button').forEach(el => { el.disabled = true; });
    }
    async function get(url, signal) {
      const data = await root.HAIStudioSession.readJson(url, { signal, cache: 'no-store' });
      if (!data.ok) throw Error(data.userError || data.error || '读取失败');
      return data;
    }
    async function postJson(url, body, success, refreshIdentity = true) {
      if (pending) return;
      setPending(true); message('正在提交…');
      let accepted = false;
      try {
        const data = await root.HAIStudioSession.readJson(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), timeoutMs: 20000,
        });
        if (!data.ok) {
          if (data.code === 'CONSENT_OUTDATED') {
            const current = await get('/api/auth/me');
            user = current.user; consent = current.consent;
            if (user) { panel.replaceChildren(); profile(); }
          }
          message(data.userError || data.error || '操作未成功，请检查后重试', true); return;
        }
        accepted = true;
        await success(data);
        if (refreshIdentity) await onRefresh();
      } catch {
        message(accepted ? '操作已成功，但最新资料读取失败。请重新打开面板核对，无需重复提交。' : '未收到确认，请先核对结果，勿立即重复提交。', true);
      } finally { setPending(false); }
    }
    function field(form, name, label, { type = 'text', autocomplete = 'off', maxLength, minLength } = {}) {
      const wrap = node('label', undefined, 'account-field');
      wrap.appendChild(node('span', label));
      const input = node('input'); input.name = name; input.type = type; input.autocomplete = autocomplete; input.required = true;
      if (maxLength) input.maxLength = maxLength;
      if (minLength) input.minLength = minLength;
      wrap.appendChild(input); form.appendChild(wrap); return input;
    }
    function action(form, label) {
      const button = node('button', label, 'account-primary'); button.type = 'submit'; form.appendChild(button);
    }
    function detail(parent, label, value, literal = false) {
      const row = node('div', undefined, 'account-detail'), content = node('dd', value || '未设置');
      if (literal && value) content.setAttribute('translate', 'no');
      row.append(node('dt', label), content); parent.appendChild(row);
    }
    function profile() {
      panel.appendChild(node('h3', '个人资料'));
      const details = node('dl');
      const identity = node('div', undefined, 'account-identity');
      const avatar = node('span', (user.penName || user.email || '创').slice(0, 1), 'account-avatar');
      avatar.setAttribute('translate', 'no');
      const title = node('strong', user.penName || '尚未设置笔名'); title.setAttribute('translate', 'no');
      identity.append(avatar, title); panel.appendChild(identity);
      detail(details, '邮箱', user.email ? `${user.email} · ${user.emailVerified ? '已验证' : '未验证'}` : '未绑定');
      detail(details, '账号类型', user.role === 'owner' ? '超级用户' : '创作账号');
      panel.appendChild(details);
      if (consent?.required && !consent.accepted && user.mode !== 'local-owner') policyConfirmation();
      if (!user.email && user.mode !== 'local-owner') emailBinding();
      if (user.penName) {
        detail(details, '笔名', user.penName, true);
        panel.appendChild(node('p', '笔名已绑定，不可更改。', 'account-note'));
        return;
      }
      const form = node('form');
      form.appendChild(node('h4', '绑定笔名'));
      const pen = field(form, 'penName', '发布署名', { maxLength: 24 });
      const confirm = node('label', undefined, 'account-confirm');
      const check = node('input'); check.type = 'checkbox'; check.required = true;
      confirm.append(check, node('span', '我确认使用此笔名，绑定后不可更改。')); form.appendChild(confirm);
      action(form, '确认绑定');
      form.onsubmit = event => {
        event.preventDefault();
        const name = pen.value.trim();
        if (!name || !check.checked) { message('请输入笔名并确认绑定规则', true); return; }
        postJson('/api/auth/pen-name', { penName: name }, async data => {
          user.penName = data.penName; panel.replaceChildren(); profile(); message('笔名已绑定');
        });
      };
      panel.appendChild(form);
    }
    function policyConfirmation() {
      const form = node('form');
      form.appendChild(node('h4', '服务政策更新'));
      const label = node('label', undefined, 'account-confirm');
      const check = node('input'); check.type = 'checkbox'; check.required = true;
      const text = node('span');
      const suffix = root.__haiI18n?.lang === 'en' ? '-en' : '';
      const terms = node('a', '服务条款'), privacy = node('a', '隐私政策');
      terms.href = `/terms${suffix}.html`; privacy.href = `/privacy${suffix}.html`;
      for (const link of [terms, privacy]) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      text.append(node('span', '我同意'), ' ', terms, ' ', node('span', '，并已阅读'), ' ', privacy);
      label.append(check, text); form.appendChild(label);
      action(form, '确认当前政策');
      form.onsubmit = event => {
        event.preventDefault();
        if (!check.checked) return;
        postJson('/api/auth/consent', { consent: { termsAccepted: true, privacyAcknowledged: true, version: consent.version, digest: consent.digest }, locale: root.__haiI18n?.lang || 'zh' }, async data => {
          consent = data.consent; panel.replaceChildren(); profile(); message('政策确认已保存。');
        });
      };
      panel.appendChild(form);
    }
    function emailBinding() {
      const form = node('form', undefined, 'account-email-binding');
      form.appendChild(node('h4', '绑定邮箱并激活'));
      form.appendChild(node('p', '验证后可用邮箱登录；原有书稿、笔名和积分保持不变。', 'account-note'));
      const email = field(form, 'email', '登录邮箱', { type: 'email', autocomplete: 'email' });
      email.value = user.pendingEmail || '';
      const password = field(form, 'password', user.hasPassword === false ? t('当前登录凭证', 'Current sign-in credential') : '当前密码', { type: 'password', autocomplete: 'current-password' });
      const newPassword = user.hasPassword === false ? field(form, 'newPassword', '设置登录密码', { type: 'password', autocomplete: 'new-password', minLength: 8 }) : null;
      action(form, '发送验证邮件');
      form.onsubmit = event => {
        event.preventDefault();
        postJson('/api/auth/email-binding/request', { email: email.value.trim(), password: password.value, newPassword: newPassword?.value, locale: root.__haiI18n?.lang || 'zh' }, async data => {
          password.value = ''; if (newPassword) newPassword.value = '';
          user.pendingEmail = data.pendingEmail; message('验证邮件已发送，请输入验证码完成绑定。');
        });
      };
      const verify = node('form');
      const code = field(verify, 'code', '邮箱验证码', { autocomplete: 'one-time-code', maxLength: 6 });
      code.inputMode = 'numeric'; code.pattern = '[0-9]{6}';
      action(verify, '验证并绑定');
      verify.onsubmit = event => {
        event.preventDefault();
        postJson('/api/auth/email-binding/confirm', { code: code.value.trim() }, async data => {
          user = data.user; panel.replaceChildren(); profile(); message('邮箱已验证，原有内容已保留。');
        });
      };
      panel.append(form, verify);
    }
    function security() {
      panel.appendChild(node('h3', '账号安全'));
      if (user.mode === 'local-owner') {
        panel.appendChild(node('p', t('此账号不支持在此修改登录密码。', 'This account’s sign-in password cannot be changed here.'), 'account-note')); return;
      }
      if (['owner', 'admin'].includes(user.role) || user.mfaEnabled) {
        const link = node('a', '管理双重认证', 'account-mfa-link');
        link.href = '/admin-security.html'; panel.appendChild(link);
      }
      const form = node('form');
      const old = field(form, 'oldPassword', '当前密码', { type: 'password', autocomplete: 'current-password' });
      const password = field(form, 'newPassword', '新密码', { type: 'password', autocomplete: 'new-password', minLength: 6 });
      const confirmation = field(form, 'confirmPassword', '确认新密码', { type: 'password', autocomplete: 'new-password', minLength: 6 });
      action(form, '修改密码');
      form.onsubmit = event => {
        event.preventDefault();
        const error = passwordError(old.value, password.value, confirmation.value);
        if (error) { message(error, true); confirmation.focus(); return; }
        postJson('/api/auth/password', { oldPassword: old.value, newPassword: password.value }, async () => {
          form.reset(); panel.replaceChildren(); sessionEnded = true;
          panel.appendChild(node('h3', '密码已修改'));
          panel.appendChild(node('p', '原登录会话已失效，请使用新密码重新登录。', 'account-note'));
          const link = node('a', '重新登录'); link.href = typeof loginUrl === 'function' ? loginUrl() : loginUrl; panel.appendChild(link);
          message('密码修改成功，请重新登录');
        }, false);
      };
      panel.appendChild(form);
    }
    async function credits(signal, current) {
      const payments = root.HAIStudioPayments;
      if (!payments || !['checkoutUrl', 'checkoutFailure', 'orderMessage', 'purchasePlans', 'requestCheckout', 'requestedPlan', 'returnedOrder'].every(key => typeof payments[key] === 'function')) {
        message(t('购买页面暂时无法加载，请重试或刷新页面。', 'The purchase page could not be loaded. Please retry or refresh the page.'), true);
        const retry = node('button', t('重新加载购买页面', 'Retry purchase page'));
        retry.type = 'button'; retry.onclick = () => show('credits'); panel.appendChild(retry); return;
      }
      const { checkoutUrl, checkoutFailure: purchaseError, orderMessage: purchaseStatus, purchasePlans } = payments;
      const active = () => !signal.aborted && current === generation && dialog;
      const locale = en() ? 'en-US' : 'zh-CN';
      const number = value => Number.isFinite(value) ? value.toLocaleString(locale) : t('暂不可用', 'Unavailable');
      const money = (amount, currency) => Number.isSafeInteger(amount) && amount >= 0 && /^[A-Z]{3}$/.test(currency || '')
        ? `${new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 100)} ${currency}` : t('金额暂不可用', 'Amount unavailable');
      panel.setAttribute('translate', 'no');
      panel.appendChild(node('h3', t('积分与购买', 'Credits & purchases')));
      const balance = node('section', undefined, 'account-credit-balance');
      const purchase = node('section', undefined, 'account-purchase');
      const orders = node('section', undefined, 'account-purchase-orders');
      const ledger = node('details', undefined, 'account-credit-ledger');
      ledger.appendChild(node('summary', t('积分明细', 'Credit activity')));
      const entries = node('div'); ledger.appendChild(entries);
      panel.append(balance, purchase, orders, ledger);
      const retryButton = (parent, label, run) => {
        const button = node('button', label); button.type = 'button';
        button.onclick = () => { if (!pending) run(); }; parent.appendChild(button); return button;
      };
      async function loadBalance() {
        balance.replaceChildren(node('p', t('正在读取余额…', 'Loading balance…'), 'account-note'));
        entries.replaceChildren();
        try {
          const data = await get('/api/billing/mine', signal);
          if (!active()) return;
          const amount = node('div', undefined, 'account-balance');
          amount.append(node('span', t('可用积分', 'Available credits')), node('strong', data.balance?.unlimited ? t('不限额度', 'Unlimited') : number(data.balance?.remaining)));
          const totals = node('p', t(`累计获得 ${number(data.balance?.granted)} · 累计消耗 ${number(data.balance?.usedCredits)}`,
            `Total added ${number(data.balance?.granted)} · Total used ${number(data.balance?.usedCredits)}`), 'account-note');
          balance.replaceChildren(amount, totals);
          const list = node('ol', undefined, 'account-ledger');
          const labels = { grant: '积分增加', adjust: '积分调整', redeem: '积分增加', refund: '退款调整', purchase: '购买入账' };
          const english = { grant: 'Credits added', adjust: 'Credit adjustment', redeem: 'Credits added', refund: 'Refund adjustment', purchase: 'Purchase credited' };
          for (const row of Array.isArray(data.rows) ? data.rows : []) {
            const item = node('li'), copy = node('div'), date = new Date(row.at);
            copy.append(node('strong', (en() ? english : labels)[row.kind] || t('积分变动', 'Credit change')),
              node('small', Number.isFinite(date.getTime()) ? date.toLocaleString(locale) : t('时间未记录', 'Date unavailable')));
            item.append(copy, node('span', Number.isFinite(row.delta) ? `${row.delta > 0 ? '+' : ''}${number(row.delta)}` : '—'));
            list.appendChild(item);
          }
          entries.append(node('p', t('最近 50 条积分增加与调整；已使用积分见累计消耗。', 'The latest 50 additions and adjustments. Credit usage is shown in Total used.'), 'account-note'), list);
          if (!list.children.length) entries.appendChild(node('p', t('暂无积分记录', 'No credit activity yet'), 'account-note'));
        } catch {
          if (!active()) return;
          balance.replaceChildren(node('p', t('余额暂时无法读取，请重试。', 'Your balance could not be loaded. Please retry.'), 'account-note'));
          retryButton(balance, t('重新读取余额', 'Retry balance'), loadBalance);
        }
      }
      async function loadOrders(refreshBalance = false) {
        orders.replaceChildren(node('h4', t('购买记录', 'Your orders')));
        const result = node('div'); orders.appendChild(result);
        const check = retryButton(orders, t('查询付款结果', 'Check payment status'), () => loadOrders(true)); check.disabled = true;
        result.appendChild(node('p', t('正在查询付款结果…', 'Checking payment status…'), 'account-note'));
        try {
          const orderId = payments.returnedOrder();
          if (orderId) {
            try {
              const returned = await get(`/api/billing/orders/${encodeURIComponent(orderId)}`, signal);
              if (!active()) return;
              result.replaceChildren(node('p', returned.order ? purchaseStatus(returned.order, en()) : t('未能查询到本账号的订单，请重试或联系支持。', 'This order could not be found for your account. Retry or contact support.'), 'account-return-status'));
            } catch {
              if (!active()) return;
              result.replaceChildren(node('p', t('未能确认本账号的付款结果，请重试或联系支持，勿重复付款。', 'We could not confirm this account’s payment. Retry or contact support; do not pay again.'), 'account-return-status'));
            }
          } else result.replaceChildren();
          const data = await get('/api/billing/orders', signal);
          if (!active()) return;
          if (!Array.isArray(data.orders)) throw Error('Invalid orders');
          const list = node('ol', undefined, 'account-ledger account-orders');
          for (const order of data.orders) {
            const row = node('li'), copy = node('div');
            copy.append(node('strong', order.planName || t('积分购买', 'Credit purchase')), node('small', purchaseStatus(order, en())));
            const date = new Date(order.createdAt);
            if (Number.isFinite(date.getTime())) copy.appendChild(node('small', date.toLocaleString(locale)));
            if (/^[A-Za-z0-9_-]{1,120}$/.test(order.orderId || '')) copy.appendChild(node('small', t('订单编号：', 'Order reference: ') + order.orderId));
            row.append(copy, node('span', money(order.amountMinor, order.currency))); list.appendChild(row);
          }
          result.appendChild(list);
          if (!data.orders.length) result.appendChild(node('p', t('暂无购买记录', 'No purchases yet'), 'account-note'));
          if (refreshBalance) { await loadBalance(); await onRefresh(); }
        } catch {
          if (active()) result.appendChild(node('p', t('购买记录暂时无法读取。请重新查询，勿重复付款。', 'Orders could not be loaded. Check again; do not pay again.'), 'account-note'));
        } finally { if (active()) check.disabled = pending; }
      }
      async function loadPlans() {
        purchase.replaceChildren(node('p', t('正在读取积分包…', 'Loading credit packs…'), 'account-note'));
        try {
          const data = await get('/api/billing/plans', signal);
          if (!active()) return;
          const plans = purchasePlans(data);
          if (!plans.length) throw Error('No valid plans');
          const requested = payments.requestedPlan(plans);
          let selected = plans.find(plan => plan.id === requested.id);
          purchase.replaceChildren();
          const form = node('form', undefined, 'account-purchase-form');
          const list = node('fieldset', undefined, 'account-pack-options');
          list.appendChild(node('legend', t('选择积分包', 'Choose a credit pack')));
          if (requested.missing) list.appendChild(node('p', t('原先选择的积分包暂不可用，请重新选择。', 'Your selected pack is no longer available. Please choose another.'), 'account-note'));
          const summary = node('section', undefined, 'account-order-summary');
          summary.appendChild(node('h4', t('订单摘要', 'Order summary')));
          const creditCount = node('p', '', 'account-order-credits');
          const total = node('strong', '', 'account-order-total');
          summary.append(creditCount, node('span', t('积分包金额', 'Pack price'), 'account-note'), total,
            node('p', data.mode === 'test' ? t('测试结账，不产生真实扣款。', 'Test checkout; no real payment is taken.')
              : t('一次性购买，无自动续费。适用税费及最终应付金额以结账页为准。', 'One-time purchase, no automatic renewal. Applicable taxes and the final total are shown at checkout.'), 'account-note'));
          const ageLabel = node('label', undefined, 'account-confirm');
          const age = node('input'); age.type = 'checkbox'; age.name = 'ageConfirmed'; age.required = true;
          ageLabel.append(age, node('span', t('我确认已年满 18 岁。', 'I confirm that I am at least 18 years old.')));
          const legal = node('div', undefined, 'account-purchase-legal');
          for (const [id, zh, english] of [['terms', '服务条款', 'Terms of Service'], ['privacy', '隐私政策', 'Privacy Policy'], ['refunds', '退款政策', 'Refund Policy']]) {
            const a = node('a', t(zh, english)); a.href = `/${id}${en() ? '-en' : ''}.html`; a.target = '_blank'; a.rel = 'noopener noreferrer'; legal.appendChild(a);
          }
          const button = node('button', '', 'account-primary'); button.type = 'submit';
          const feedback = node('div', undefined, 'account-checkout-feedback'); feedback.setAttribute('aria-live', 'polite');
          let failed = false;
          const update = () => {
            if (!active()) return;
            creditCount.textContent = selected ? `${number(selected.credits)} ${t('积分', 'credits')}` : t('尚未选择积分包', 'No pack selected');
            total.textContent = selected ? money(selected.amountMinor, data.currency) : '—';
            button.disabled = checkoutInFlight || !selected;
            list.disabled = checkoutInFlight; age.disabled = checkoutInFlight;
            button.textContent = checkoutInFlight ? t('正在前往结账…', 'Opening checkout…') : failed ? t('重试前往结账', 'Retry checkout')
              : data.mode === 'test' ? t('前往测试结账', 'Continue to test checkout')
                : data.provider === 'creem' ? t('前往 Creem 结账', 'Continue to Creem checkout') : t('前往安全结账', 'Continue to secure checkout');
          };
          for (const plan of plans) {
            const label = node('label', undefined, 'account-pack-option');
            const radio = node('input'); radio.type = 'radio'; radio.name = 'creditPack'; radio.value = plan.id; radio.checked = plan === selected; radio.required = true;
            const copy = node('span'); copy.append(node('strong', `${number(plan.credits)} ${t('积分', 'credits')}`), node('small', money(plan.amountMinor, data.currency)));
            label.append(radio, copy); list.appendChild(label);
            radio.onchange = () => {
              selected = plan;
              const url = new URL(root.location.href); url.searchParams.set('plan', plan.id); url.searchParams.set('lang', en() ? 'en' : 'zh');
              root.history.replaceState(null, '', url.pathname + url.search + url.hash); update();
            };
          }
          form.onsubmit = async event => {
            event.preventDefault();
            if (!active() || checkoutInFlight || !selected || !age.checked || form.querySelector('input[name="creditPack"]:checked')?.value !== selected.id) return;
            checkoutInFlight = true; setPending(true); update();
            feedback.setAttribute('role', 'status'); feedback.replaceChildren(node('p', t('正在创建结账，尚未完成付款。', 'Creating checkout. Payment is not complete.')));
            let redirecting = false;
            try {
              const result = await payments.requestCheckout(selected.id);
              if (!active()) return;
              const target = result.ok && checkoutUrl(result.checkoutUrl);
              if (target) { root.location.assign(target); redirecting = true; return; }
              failed = true; feedback.setAttribute('role', 'alert'); feedback.replaceChildren(node('p', purchaseError(result.code, en())));
              if (result.code === 'AUTH_REQUIRED') {
                const login = node('a', t('重新登录', 'Sign in again')); login.href = typeof loginUrl === 'function' ? loginUrl() : loginUrl; feedback.appendChild(login);
              }
            } catch {
              if (active()) { failed = true; feedback.setAttribute('role', 'alert'); feedback.replaceChildren(node('p', purchaseError('', en()))); }
            } finally {
              if (!redirecting) { checkoutInFlight = false; if (active()) { setPending(false); update(); } }
            }
          };
          summary.append(ageLabel, legal, button, feedback, node('p', t('付款经确认后积分才会入账。已购积分不自动过期；退款逐单人工审核，法定权利不受影响。', 'Credits are added only after payment is confirmed. Purchased credits do not automatically expire. Refunds are reviewed individually; statutory rights are unaffected.'), 'account-note'));
          form.append(list, summary); purchase.appendChild(form); update();
        } catch {
          if (!active()) return;
          purchase.replaceChildren(node('p', t('积分包暂时无法读取，请重试或联系支持。', 'Credit packs could not be loaded. Retry or contact support.'), 'account-note'));
          retryButton(purchase, t('重新读取积分包', 'Retry credit packs'), loadPlans);
        }
      }
      await Promise.all([loadBalance(), loadPlans(), loadOrders()]);
    }
    async function show(tab) {
      if (pending || sessionEnded || !dialog) return;
      if (!['profile', 'security', 'credits'].includes(tab)) tab = 'profile';
      dialog.dataset.tab = tab;
      onTabChange(tab);
      readController?.abort(); readController = new AbortController();
      const current = ++generation;
      panel.replaceChildren(); panel.removeAttribute('translate'); message('');
      navigation.querySelectorAll('button').forEach(button => {
        const selected = button.dataset.tab === tab;
        button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', 'account-tab-' + tab);
      try {
        if (!user) {
          panel.appendChild(node('p', '正在读取账号…', 'account-note'));
          const data = await get('/api/auth/me', readController.signal);
          if (current !== generation || !dialog) return;
          if (!data.user) {
            panel.replaceChildren();
            panel.appendChild(node('p', '登录后管理邮箱、笔名与写作积分。', 'account-note'));
            const link = node('a', '登录 / 注册'); link.href = typeof loginUrl === 'function' ? loginUrl() : loginUrl; panel.appendChild(link);
            return;
          }
          user = data.user; consent = data.consent; panel.replaceChildren();
        }
        if (tab === 'profile') profile();
        else if (tab === 'security') security();
        else if (tab === 'credits') await credits(readController.signal, current);
      } catch (error) {
        if (current !== generation || !dialog) return;
        message(error.name === 'AbortError' ? t('读取超时，请重试', 'Loading timed out. Please retry.') : t('暂时无法读取账号，请重试。', 'Your account could not be loaded. Please retry.'), true);
        const retry = node('button', t('重新读取', 'Retry')); retry.type = 'button'; retry.onclick = () => show(tab); panel.appendChild(retry);
      }
    }
    function open(tab = 'profile') {
      if (dialog) { show(tab); return; }
      user = null; sessionEnded = false;
      dialog = node(container ? 'section' : 'dialog', undefined, 'studio-account'); dialog.setAttribute('aria-labelledby', 'account-title');
      const head = node('header'); const title = node('h2', '账号中心'); title.id = 'account-title';
      const close = node('button', '×', 'account-close'); close.type = 'button'; close.setAttribute('aria-label', '关闭账号中心');
      close.onclick = () => { if (!pending) dialog.close(); }; head.append(title, close);
      if (container) close.remove();
      navigation = node('nav'); navigation.setAttribute('role', 'tablist'); navigation.setAttribute('aria-label', '账号设置');
      for (const [id, label] of Object.entries({ profile: '个人资料', security: '账号安全', credits: '积分' })) {
        const button = node('button', label); button.type = 'button'; button.dataset.tab = id; button.id = 'account-tab-' + id;
        button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'account-panel'); button.onclick = () => show(id); navigation.appendChild(button);
      }
      navigation.onkeydown = event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || pending) return;
        event.preventDefault(); const tabs = Array.from(navigation.children), at = tabs.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (at + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next].focus(); tabs[next].click();
      };
      panel = node('section', undefined, 'account-panel'); panel.id = 'account-panel'; panel.setAttribute('role', 'tabpanel');
      status = node('p', '', 'account-status'); status.setAttribute('aria-live', 'polite');
      const legal = node('footer', undefined, 'account-legal');
      const legalEnglish = { pricing: 'Credit pricing', privacy: 'Privacy Policy', terms: 'Terms of Service', 'acceptable-use': 'Acceptable Use Policy', refunds: 'Refund Policy', support: 'Help' };
      for (const [id, label] of Object.entries({ pricing: '积分价格', privacy: '隐私政策', terms: '服务条款', 'acceptable-use': '可接受使用政策', refunds: '退款说明', support: '联系支持' })) {
        const link = node('a', t(label, legalEnglish[id])); link.href = `https://evoronai.com/${id}${en() ? '-en' : ''}.html`;
        link.target = '_blank'; link.rel = 'noopener'; legal.appendChild(link);
      }
      const support = node('a', 'support@evoronai.com'); support.href = 'mailto:support@evoronai.com'; legal.appendChild(support);
      dialog.append(head, navigation, status, panel, legal); (container || document.body).appendChild(dialog);
      root.addEventListener('pageshow', resumeCheckout);
      if (container) { show(tab); return; }
      dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(dialog.querySelectorAll('button, input, a[href], summary')).filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      dialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
      dialog.addEventListener('close', () => {
        root.removeEventListener('pageshow', resumeCheckout);
        readController?.abort(); generation++; dialog.remove(); dialog = null; user = null; returnFocus()?.focus();
      });
      dialog.showModal(); close.focus(); show(tab);
    }
    return { open };
  }
  const api = { create, passwordError, balanceText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HAIStudioAccount = api;
})(typeof window === 'undefined' ? globalThis : window);
