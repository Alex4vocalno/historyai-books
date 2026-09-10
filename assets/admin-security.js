'use strict';
(function () {
  const $ = id => document.getElementById(id);
  let lang;
  try { lang = localStorage.getItem('hai.lang') || navigator.language; } catch { lang = navigator.language; }
  const en = !/^zh/i.test(lang), t = (zh, english) => en ? english : zh;
  document.documentElement.lang = en ? 'en' : 'zh-CN';
  document.querySelectorAll('[data-en]').forEach(el => { el.textContent = en ? el.dataset.en : el.dataset.zh; });
  document.title = t('双重认证', 'Two-factor authentication') + ' · EVORON AI';
  $('qr').alt = t('验证器绑定二维码', 'Authenticator enrollment QR code');
  let busy = false, enabled = false, downloadUrl;
  function status(text, error = false) { $('status').textContent = text; $('status').dataset.error = String(error); }
  function message(data) {
    if (!en && data.error) return data.error;
    return ({ MFA_REQUIRED: 'Enter an authenticator code or recovery code.', MFA_INVALID: 'Invalid password or code. Use a new code and try again.',
      MFA_RATE_LIMITED: 'Too many attempts. Try again in 15 minutes.', MFA_SETUP_REQUIRED: 'Setup expired. Reload this page and start again.',
      MFA_STORE_UNAVAILABLE: 'Authentication storage is unavailable. Contact support.', AUTH_REQUIRED: 'Sign in with your account password first.',
    })[data.code] || t('操作未成功，请稍后重试。', 'Unable to complete the request. Please try again later.');
  }
  async function request(action, body) {
    const response = await fetch('/api/auth/mfa' + (action ? '/' + action : ''), {
      method: action ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin',
      ...(action ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw Error(message(data));
    return data;
  }
  function complete(data) {
    $('settings').hidden = true; $('enrollment').hidden = true; $('complete').hidden = false;
    $('setupKey').value = ''; $('qr').removeAttribute('src'); $('confirmForm').reset(); $('startForm').reset();
    const codes = data.recoveryCodes;
    $('recovery').hidden = !codes;
    $('signIn').hidden = Boolean(codes);
    if (codes) {
      const content = codes.join('\n'); $('recoveryCodes').value = content;
      downloadUrl = URL.createObjectURL(new Blob([content + '\n'], { type: 'text/plain' })); $('download').href = downloadUrl;
    }
    status(t('旧会话已失效，请重新登录。', 'Previous sessions have been revoked. Sign in again.'));
  }
  async function submit(event, action, body, onSuccess) {
    event.preventDefault(); if (busy) return;
    busy = true; document.querySelectorAll('button').forEach(el => { el.disabled = true; });
    status(t('正在验证…', 'Verifying…'));
    try { onSuccess(await request(action, body)); }
    catch (error) { status(error.message || t('未收到确认，请先核对结果。', 'No confirmation received. Check the result before retrying.'), true); }
    finally {
      $('currentPassword').value = ''; $('confirmPassword').value = ''; $('currentCode').value = ''; $('confirmCode').value = '';
      busy = false; document.querySelectorAll('button').forEach(el => { el.disabled = false; });
    }
  }
  $('startForm').onsubmit = event => submit(event, $('operation').value, { password: $('currentPassword').value, code: $('currentCode').value }, data => {
    if (data.signedOut) { complete(data); return; }
    $('settings').hidden = true; $('enrollment').hidden = false;
    $('setupKey').value = data.secret;
    $('qr').src = 'data:image/svg+xml;base64,' + btoa(data.qrSvg);
    status(t('设置有效期为 10 分钟。确认新动态码后生效。', 'Setup expires in 10 minutes. Confirm a code from the new authenticator to activate it.'));
    $('confirmPassword').focus();
  });
  $('confirmForm').onsubmit = event => submit(event, 'confirm', { password: $('confirmPassword').value, code: $('confirmCode').value }, complete);
  $('saved').onchange = () => { $('signIn').hidden = !$('saved').checked; };
  window.addEventListener('pagehide', () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    $('setupKey').value = ''; $('recoveryCodes').value = ''; $('qr').removeAttribute('src');
    $('startForm').reset(); $('confirmForm').reset();
  });
  request().then(data => {
    if (!data.eligible) { status(t('当前账号无需管理员双重认证。', 'This account does not require administrator two-factor authentication.')); return; }
    enabled = data.enabled;
    $('settings').hidden = false; $('currentCodeField').hidden = !enabled; $('currentCode').required = enabled;
    $('summary').textContent = enabled ? t(`已启用 · 剩余 ${data.recoveryRemaining} 条恢复码`, `Enabled · ${data.recoveryRemaining} recovery codes remaining`) : t('尚未绑定验证器', 'No authenticator enrolled');
    const options = [['start', enabled ? t('更换验证器', 'Replace authenticator') : t('绑定验证器', 'Enroll authenticator')]];
    if (enabled) options.push(['recovery-codes', t('重新生成恢复码', 'Regenerate recovery codes')]);
    if (enabled && !data.enforced) options.push(['disable', t('停用双重认证', 'Disable two-factor authentication')]);
    for (const [value, label] of options) { const option = document.createElement('option'); option.value = value; option.textContent = label; $('operation').appendChild(option); }
    status('');
  }).catch(error => status(error.message, true));
})();
