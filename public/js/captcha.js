const CAPTCHA = {
  currentToken: null,
  verified: false,
  modalOverlay: null,

  // Check if captcha is required for action, returns {required, type}
  async checkRequired(action) {
    try {
      return await API.request('POST', '/captcha/required', { action });
    } catch { return { required: false }; }
  },

  async loadImage() {
    try {
      const r = await API.request('GET', '/captcha/image');
      this.currentToken = r.token;
      return r;
    } catch { return null; }
  },

  async verify(answer) {
    if (!this.currentToken || !answer) return { success: false };
    try {
      const r = await API.request('POST', '/captcha/verify', { token: this.currentToken, answer });
      if (r.success) this.currentToken = null;
      return r;
    } catch { return { success: false }; }
  },

  // Show captcha modal, returns Promise<boolean>
  showModal(action) {
    return new Promise(async (resolve) => {
      const r = await this.checkRequired(action);
      if (!r.required) { resolve(true); return; }

      this._removeModal();
      const type = r.type;

      let powVerified = false;
      let powError = false;

      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay active';
      overlay.style.cssText = 'display:flex;z-index:9999';

      if (type === 'builtin') {
        overlay.innerHTML = `
          <div class="dialog" style="max-width:380px;text-align:center">
            <h3 style="margin-bottom:12px">验证码</h3>
            <div id="capModalImg" style="margin:0 auto 12px;max-width:280px"><div class="spinner" style="width:24px;height:24px;margin:16px auto"></div></div>
            <div style="display:flex;gap:8px;align-items:center;justify-content:center">
              <input type="text" id="capModalInput" placeholder="输入验证码" maxlength="6" style="flex:1;text-align:center;font-size:20px;letter-spacing:6px;text-transform:uppercase" autocomplete="off">
              <button class="btn btn-icon" id="capModalRefresh" title="刷新" style="flex-shrink:0"><span class="material-icons">refresh</span></button>
            </div>
            <div id="capModalError" style="color:var(--md-ref-error);font-size:13px;margin-top:8px;display:none"></div>
            <div id="powStatus" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;font-size:13px;color:var(--md-ref-on-surface-variant)">
              <span class="material-icons" id="powIcon" style="font-size:16px">smart_toy</span>
              <span id="powText">智能验证中...</span>
            </div>
            <div class="actions" style="justify-content:center;margin-top:16px">
              <button class="btn btn-text" id="capModalCancel">取消</button>
              <button class="btn btn-filled" id="capModalConfirm">确认</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        this.modalOverlay = overlay;

        const loadImg = async () => {
          const data = await this.loadImage();
          if (!data) return;
          const d = document.getElementById('capModalImg');
          if (d) { d.innerHTML = data.svg; const s = d.querySelector('svg'); if (s) s.style.cssText = 'width:100%;max-width:240px;height:auto;border-radius:8px;display:block'; }
        };
        await loadImg();

        // Start PoW in background
        let powDone = false;
        this._runPowWithUI().then(() => {
          powDone = true;
          const icon = document.getElementById('powIcon');
          const text = document.getElementById('powText');
          if (icon && text) {
            icon.textContent = 'check_circle';
            icon.style.color = '#4caf50';
            text.textContent = '智能验证通过';
            text.style.color = '#4caf50';
          }
        }).catch(() => {
          document.getElementById('powText') && (document.getElementById('powText').textContent = '智能验证不可用');
        });

        overlay.querySelector('#capModalRefresh').onclick = () => {
          document.getElementById('capModalInput').value = '';
          document.getElementById('capModalError').style.display = 'none';
          loadImg();
        };
        overlay.querySelector('#capModalCancel').onclick = () => { this._removeModal(); resolve(false); };
        overlay.querySelector('#capModalConfirm').onclick = async () => {
          // Check PoW first
          if (!powDone) {
            document.getElementById('capModalError').textContent = '智能验证尚未完成，请稍候...';
            document.getElementById('capModalError').style.display = 'block';
            return;
          }
          const val = document.getElementById('capModalInput').value.trim();
          if (!val || !this.currentToken) { document.getElementById('capModalError').textContent = '请输入验证码'; document.getElementById('capModalError').style.display = 'block'; return; }
          const v = await this.verify(val);
          if (v.success) { this._removeModal(); this.verified = true; resolve(true); }
          else {
            document.getElementById('capModalError').textContent = v.error || '验证码错误';
            document.getElementById('capModalError').style.display = 'block';
            this.currentToken = null;
            document.getElementById('capModalInput').value = '';
            loadImg();
          }
        };
        const inp = overlay.querySelector('#capModalInput');
        inp.onkeydown = (e) => { if (e.key === 'Enter') overlay.querySelector('#capModalConfirm').click(); };
        setTimeout(() => inp.focus(), 100);

      } else if (type === 'recaptcha') {
        const siteKey = window._recaptchaSiteKey || '';
        if (!siteKey) { resolve(false); return; }

        overlay.innerHTML = `
          <div class="dialog" style="max-width:400px;text-align:center">
            <h3 style="margin-bottom:16px">请完成验证</h3>
            <div id="capRecaptchaWidget" style="display:flex;justify-content:center;margin:16px 0"></div>
            <p id="capRecaptchaStatus" class="text-muted" style="font-size:13px">正在加载...</p>
            <div class="actions" style="justify-content:center">
              <button class="btn btn-text" id="capRecaptchaCancel">取消</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        this.modalOverlay = overlay;

        const widgetDiv = overlay.querySelector('#capRecaptchaWidget');
        const statusEl = overlay.querySelector('#capRecaptchaStatus');
        let done = false;
        const finish = (ok) => { if (!done) { done = true; this._removeModal(); if (ok) this.verified = true; resolve(ok); } };
        overlay.querySelector('#capRecaptchaCancel').onclick = () => finish(false);

        const renderWidget = () => {
          try {
            grecaptcha.render(widgetDiv, {
              sitekey: siteKey,
              callback: () => { statusEl.textContent = '验证通过'; setTimeout(() => finish(true), 300); },
              'expired-callback': () => { statusEl.textContent = '验证已过期，请重新验证'; },
            });
            statusEl.textContent = '请完成验证';
          } catch { statusEl.textContent = '加载失败'; setTimeout(() => finish(false), 2000); }
        };
        if (typeof grecaptcha !== 'undefined') renderWidget();
        else {
          window.recaptchaCallbacks = window.recaptchaCallbacks || [];
          window.recaptchaCallbacks.push(renderWidget);
          if (!document.querySelector('script[src*="recaptcha/api"]')) {
            const s = document.createElement('script');
            s.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
            s.async = true; s.defer = true;
            document.head.appendChild(s);
          }
        }
      }
    });
  },

  _removeModal() { if (this.modalOverlay) { this.modalOverlay.remove(); this.modalOverlay = null; } },

  // Background Proof-of-Work (anti-bot)
  async _runPowWithUI() {
    try {
      const chal = await API.request('GET', '/captcha/pow-challenge');
      if (!chal.token) return;
      let nonce = 0;
      const target = '0'.repeat(chal.difficulty);
      const start = Date.now();
      while (Date.now() - start < 20000) {
        const hash = await this._sha256(chal.prefix + nonce);
        if (hash.startsWith(target)) {
          await API.request('POST', '/captcha/pow-verify', { token: chal.token, nonce: String(nonce) });
          return;
        }
        nonce++;
      }
    } catch {}
  },

  async _sha256(str) {
    const buf = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  reset() { this.verified = false; }
};

window.onRecaptchaLoad = function() {
  (window.recaptchaCallbacks || []).forEach(cb => cb());
};
