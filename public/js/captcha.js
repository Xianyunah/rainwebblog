const CAPTCHA = {
  currentToken: null, verified: false, modalOverlay: null,

  async checkRequired(action) {
    try { return await API.request('POST', '/captcha/required', { action }); } catch { return { required: false }; }
  },
  async loadImage() {
    try { const r = await API.request('GET', '/captcha/image'); this.currentToken = r.token; return r; } catch { return null; }
  },
  async verify(answer) {
    if (!this.currentToken || !answer) return { success: false };
    try { const r = await API.request('POST', '/captcha/verify', { token: this.currentToken, answer }); if (r.success) this.currentToken = null; return r; } catch { return { success: false }; }
  },

  showModal(action) {
    return new Promise(async (resolve) => {
      const r = await this.checkRequired(action);
      if (!r.required) { resolve(true); return; }
      this._removeModal();
      if (r.type === 'builtin') this._showBuiltinModal(resolve);
      else if (r.type === 'recaptcha') this._showRecaptchaModal(resolve);
      else if (r.type === 'turnstile') this._showTurnstileModal(resolve);
      else resolve(true);
    });
  },

  async _showBuiltinModal(resolve) {
    const overlay = this._createOverlay(`
      <div class="dialog" style="max-width:380px;text-align:center">
        <h3 style="margin-bottom:12px">验证码</h3>
        <div id="capImg" style="margin:0 auto 12px;max-width:280px"><div class="spinner" style="width:24px;height:24px;margin:16px auto"></div></div>
        <div style="display:flex;gap:8px;align-items:center;justify-content:center">
          <input type="text" id="capInput" placeholder="输入验证码" maxlength="6" style="flex:1;text-align:center;font-size:20px;letter-spacing:6px;text-transform:uppercase" autocomplete="off">
          <button class="btn btn-icon" id="capRefresh" title="刷新" style="flex-shrink:0"><span class="material-icons">refresh</span></button>
        </div>
        <div id="capError" style="color:var(--md-ref-error);font-size:13px;margin-top:8px;display:none"></div>
        <div id="powStatus" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;font-size:13px;color:var(--md-ref-on-surface-variant)">
          <span class="material-icons" id="powIcon" style="font-size:16px">smart_toy</span> <span id="powText">智能验证中...</span>
        </div>
        <div class="actions" style="justify-content:center;margin-top:16px">
          <button class="btn btn-text" id="capCancel">取消</button>
          <button class="btn btn-filled" id="capConfirm">确认</button>
        </div>
      </div>`);
    const loadImg = async () => {
      const data = await this.loadImage();
      if (!data) return;
      const d = document.getElementById('capImg');
      if (d) { d.innerHTML = data.svg; const s = d.querySelector('svg'); if (s) s.style.cssText = 'width:100%;max-width:240px;height:auto;border-radius:8px;display:block'; }
    };
    await loadImg();
    let powDone = false;
    this._runPowWithUI().then(() => { powDone = true; const el = document.getElementById('powStatus'); if (el) { el.innerHTML = '<span class=material-icons style=font-size:16px;color:#4caf50>check_circle</span> <span style=color:#4caf50>智能验证通过</span>'; } }).catch(() => {});
    document.getElementById('capRefresh').onclick = () => { document.getElementById('capInput').value = ''; document.getElementById('capError').style.display = 'none'; loadImg(); };
    document.getElementById('capCancel').onclick = () => { this._removeModal(); this.modalOverlay = null; resolve(false); };
    document.getElementById('capConfirm').onclick = async () => {
      if (!powDone) { document.getElementById('capError').textContent = '智能验证尚未完成，请稍候...'; document.getElementById('capError').style.display = 'block'; return; }
      const val = document.getElementById('capInput').value.trim();
      if (!val || !this.currentToken) { document.getElementById('capError').textContent = '请输入验证码'; document.getElementById('capError').style.display = 'block'; return; }
      const v = await this.verify(val);
      if (v.success) { this._removeModal(); this.modalOverlay = null; this.verified = true; resolve(true); }
      else {
        document.getElementById('capError').textContent = v.error || '验证码错误';
        document.getElementById('capError').style.display = 'block';
        this.currentToken = null;
        document.getElementById('capInput').value = '';
        loadImg();
      }
    };
    const inp = document.getElementById('capInput');
    inp.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('capConfirm').click(); };
    setTimeout(() => inp.focus(), 100);
  },

  _showRecaptchaModal(resolve) {
    const siteKey = window._recaptchaSiteKey || '';
    if (!siteKey) { resolve(false); return; }
    const overlay = this._createOverlay(`
      <div class="dialog" style="max-width:400px;text-align:center">
        <h3 style="margin-bottom:16px">Google reCAPTCHA</h3>
        <div id="capWidget" style="display:flex;justify-content:center;margin:16px 0"></div>
        <p id="capStatus" class="text-muted" style="font-size:13px">正在加载...</p>
        <div class="actions" style="justify-content:center"><button class="btn btn-text" id="capCancel">取消</button></div>
      </div>`);
    const wd = document.getElementById('capWidget'), st = document.getElementById('capStatus');
    let done = false;
    const finish = (ok) => { if (!done) { done = true; this._removeModal(); this.modalOverlay = null; if (ok) this.verified = true; resolve(ok); } };
    document.getElementById('capCancel').onclick = () => finish(false);
    const render = () => {
      try {
        grecaptcha.render(wd, { sitekey: siteKey, callback: () => { st.textContent = '验证通过'; setTimeout(() => finish(true), 300); }, 'expired-callback': () => { st.textContent = '验证已过期'; } });
        st.textContent = '请完成验证';
      } catch { st.textContent = '加载失败'; setTimeout(() => finish(false), 2000); }
    };
    if (typeof grecaptcha !== 'undefined') render();
    else {
      window.recaptchaCallbacks = window.recaptchaCallbacks || [];
      window.recaptchaCallbacks.push(render);
      if (!document.querySelector('script[src*="recaptcha/api"]')) {
        const s = document.createElement('script');
        s.src = 'https://www.recaptcha.net/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
        s.async = true; s.defer = true;
        document.head.appendChild(s);
      }
    }
  },

  _showTurnstileModal(resolve) {
    const siteKey = window._turnstileSiteKey || '';
    if (!siteKey) { console.warn('Turnstile: site key not configured'); resolve(false); return; }
    const overlay = this._createOverlay(`
      <div class="dialog" style="max-width:400px;text-align:center">
        <h3 style="margin-bottom:16px">Cloudflare Turnstile</h3>
        <div id="capWidget" style="display:flex;justify-content:center;margin:16px 0"></div>
        <p id="capStatus" class="text-muted" style="font-size:13px">正在加载...</p>
        <div class="actions" style="justify-content:center"><button class="btn btn-text" id="capCancel">取消</button></div>
      </div>`);
    const wd = document.getElementById('capWidget'), st = document.getElementById('capStatus');
    let done = false;
    const finish = (ok) => { if (!done) { done = true; this._removeModal(); this.modalOverlay = null; if (ok) this.verified = true; resolve(ok); } };
    document.getElementById('capCancel').onclick = () => finish(false);
    const render = () => {
      try {
        turnstile.render(wd, { sitekey: siteKey, callback: () => { st.textContent = '验证通过'; setTimeout(() => finish(true), 300); }, 'expired-callback': () => { st.textContent = '验证已过期'; } });
        st.textContent = '请完成验证';
      } catch { st.textContent = '加载失败'; setTimeout(() => finish(false), 2000); }
    };
    if (typeof turnstile !== 'undefined') render();
    else {
      window.turnstileCallbacks = window.turnstileCallbacks || [];
      window.turnstileCallbacks.push(render);
      if (!document.querySelector('script[src*="turnstile"]')) {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
        s.async = true; s.defer = true;
        document.head.appendChild(s);
      }
    }
  },

  _createOverlay(html) {
    this._removeModal();
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay active';
    overlay.style.cssText = 'display:flex;z-index:9999';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    this.modalOverlay = overlay;
    return overlay;
  },

  _removeModal() { if (this.modalOverlay) { this.modalOverlay.remove(); this.modalOverlay = null; } },

  async _runPowWithUI() {
    try {
      const chal = await API.request('GET', '/captcha/pow-challenge');
      if (!chal.token) return;
      let nonce = 0;
      const target = '0'.repeat(chal.difficulty);
      const start = Date.now();
      while (Date.now() - start < 20000) {
        const hash = await this._sha256(chal.prefix + nonce);
        if (hash.startsWith(target)) { await API.request('POST', '/captcha/pow-verify', { token: chal.token, nonce: String(nonce) }); return; }
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

window.onRecaptchaLoad = function() { (window.recaptchaCallbacks || []).forEach(cb => cb()); };
window.onTurnstileLoad = function() { (window.turnstileCallbacks || []).forEach(cb => cb()); };
