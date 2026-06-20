const CAPTCHA = {
  currentToken: null,
  type: 'none',

  async checkRequired(action) {
    try {
      const r = await API.request('POST', '/captcha/required', { action });
      this.type = r.type || 'none';
      return r;
    } catch { return { required: false, type: 'none' }; }
  },

  async loadImage() {
    try {
      const r = await API.request('GET', '/captcha/image');
      this.currentToken = r.token;
      return r;
    } catch { return null; }
  },

  async verify(answer) {
    if (!this.currentToken || !answer) return { success: false, error: '请先加载验证码' };
    try {
      const r = await API.request('POST', '/captcha/verify', { token: this.currentToken, answer });
      if (r.success) this.currentToken = null;
      return r;
    } catch (e) { return { success: false, error: e.message }; }
  },

  // Render captcha inline into a container element
  // Returns a promise that resolves when captcha is ready
  async renderInline(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'block';

    if (this.type === 'builtin') {
      await this._renderBuiltinInline(container);
    } else if (this.type === 'recaptcha') {
      this._renderRecaptchaInline(container);
    }
  },

  async _renderBuiltinInline(container) {
    container.innerHTML = `
      <div class="captcha-wrapper">
        <div class="captcha-image" id="capInlineImg" style="display:flex;justify-content:center;margin-bottom:8px"><div class="spinner" style="width:24px;height:24px"></div></div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" id="capInlineInput" placeholder="输入验证码" maxlength="6" style="flex:1;text-align:center;font-size:18px;letter-spacing:6px;text-transform:uppercase" autocomplete="off">
          <button class="btn btn-icon" id="capInlineRefresh" title="刷新" style="flex-shrink:0"><span class="material-icons">refresh</span></button>
        </div>
        <div id="capInlineError" style="color:var(--md-ref-error);font-size:13px;margin-top:4px;display:none"></div>
      </div>`;
    container.querySelector('#capInlineRefresh').onclick = () => this._loadInlineImage(container);
    await this._loadInlineImage(container);
  },

  async _loadInlineImage(container) {
    const data = await this.loadImage();
    if (!data) return;
    const imgDiv = document.getElementById('capInlineImg');
    if (imgDiv) {
      imgDiv.innerHTML = data.svg;
      const svg = imgDiv.querySelector('svg');
      if (svg) svg.style.cssText = 'width:100%;max-width:240px;height:auto;border-radius:8px;display:block';
    }
    this.currentToken = data.token;
  },

  _renderRecaptchaInline(container) {
    const siteKey = window._recaptchaSiteKey || '';
    if (!siteKey) { container.innerHTML = '<div class="text-muted" style="padding:8px;font-size:13px">reCAPTCHA 未配置</div>'; return; }

    const renderWidget = () => {
      const div = document.createElement('div');
      div.className = 'g-recaptcha';
      div.setAttribute('data-sitekey', siteKey);
      container.appendChild(div);
      try { grecaptcha.render(div); } catch {}
    };

    if (typeof grecaptcha !== 'undefined') {
      renderWidget();
    } else {
      window.recaptchaCallbacks = window.recaptchaCallbacks || [];
      window.recaptchaCallbacks.push(renderWidget);
      if (!document.querySelector('script[src*="recaptcha/api"]')) {
        const s = document.createElement('script');
        s.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
        s.async = true; s.defer = true;
        document.head.appendChild(s);
      }
    }
  },

  // Get inline captcha value
  getInlineValue() {
    if (this.type === 'builtin') {
      const input = document.getElementById('capInlineInput');
      return input ? input.value.trim() : '';
    }
    if (this.type === 'recaptcha') {
      try { return grecaptcha.getResponse(); } catch { return ''; }
    }
    return '';
  },

  getToken() { return this.currentToken; },

  resetInline() {
    this.currentToken = null;
    const input = document.getElementById('capInlineInput');
    if (input) input.value = '';
    if (this.type === 'builtin') {
      const container = document.querySelector('.captcha-wrapper')?.parentElement;
      if (container) this._loadInlineImage(container);
    }
  }
};

window.onRecaptchaLoad = function() {
  (window.recaptchaCallbacks || []).forEach(cb => cb());
};
