'use strict';

(function (root) {
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

  function create({ onRefresh, returnFocus, container, onTabChange = () => {}, loginUrl = '/login.html' }) {
    let dialog = null, panel, status, navigation, user, pending = false, generation = 0, sessionEnded = false;
    let readController, consent;
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
      const password = field(form, 'password', user.hasPassword === false ? '原激活码' : '当前密码', { type: 'password', autocomplete: 'current-password' });
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
        panel.appendChild(node('p', '当前为本机直通模式，没有可在此修改的登录密码。', 'account-note')); return;
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
      panel.appendChild(node('h3', '积分与消费'));
      const data = await get('/api/billing/mine', signal);
      if (current !== generation || !dialog) return;
      const amount = node('section', undefined, 'account-balance');
      amount.append(node('span', '剩余积分'), node('strong', balanceText(data.balance)));
      panel.appendChild(amount);
      const details = node('dl');
      const number = value => Number.isFinite(value) ? value.toLocaleString('zh-CN') : '暂不可用';
      detail(details, '累计获得', number(data.balance && data.balance.granted));
      detail(details, '累计消耗', number(data.balance && data.balance.usedCredits));
      panel.appendChild(details);
      if (root.HAIStudioPayments) {
        await root.HAIStudioPayments.mount(panel, { signal, postJson, refresh: async () => {
          if (current !== generation || !dialog) return;
          await onRefresh();
          await show('credits');
        } });
        if (current !== generation || !dialog) return;
      }
      panel.appendChild(node('h4', '最近 50 条积分记录'));
      panel.appendChild(node('p', '记录积分的增加与调整；已使用积分见累计消耗。', 'account-note'));
      const rows = Array.isArray(data.rows) ? data.rows : [];
      if (!rows.length) { panel.appendChild(node('p', '暂无积分记录', 'account-note')); return; }
      const list = node('ol', undefined, 'account-ledger');
      const labels = { grant: '积分增加', adjust: '积分调整', redeem: '积分增加', refund: '退款调整', purchase: '购买入账' };
      rows.forEach(row => {
        const item = node('li');
        const copy = node('div'), reason = node('strong', labels[row.kind] || '积分变动');
        copy.appendChild(reason);
        const date = new Date(row.at);
        copy.appendChild(node('small', Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN') : '时间未记录'));
        const delta = Number.isFinite(row.delta) ? `${row.delta > 0 ? '+' : ''}${row.delta}` : '—';
        item.append(copy, node('span', delta, row.delta >= 0 ? 'account-positive' : 'account-negative'));
        list.appendChild(item);
      });
      panel.appendChild(list);
    }
    async function show(tab) {
      if (pending || sessionEnded || !dialog) return;
      if (!['profile', 'security', 'credits'].includes(tab)) tab = 'profile';
      onTabChange(tab);
      readController?.abort(); readController = new AbortController();
      const current = ++generation;
      panel.replaceChildren(); message('');
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
        message(error.name === 'AbortError' ? '读取超时，请重试' : error.message, true);
        const retry = node('button', '重新读取'); retry.type = 'button'; retry.onclick = () => show(tab); panel.appendChild(retry);
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
      const en = root.__haiI18n?.lang === 'en';
      for (const [id, label] of Object.entries({ pricing: '积分价格', privacy: '隐私政策', terms: '服务条款', 'acceptable-use': '可接受使用政策', refunds: '退款说明', support: '联系支持', policies: '政策中心与版本' })) {
        const link = node('a', label); link.href = `https://evoronai.com/${id}${en ? '-en' : ''}.html`;
        link.target = '_blank'; link.rel = 'noopener'; legal.appendChild(link);
      }
      const support = node('a', 'support@evoronai.com'); support.href = 'mailto:support@evoronai.com'; legal.appendChild(support);
      dialog.append(head, navigation, status, panel, legal); (container || document.body).appendChild(dialog);
      if (container) { show(tab); return; }
      dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(dialog.querySelectorAll('button, input, a[href]')).filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      dialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
      dialog.addEventListener('close', () => {
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
