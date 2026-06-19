const CAPTCHA = {
  currentToken: null,
  modalOverlay: null,

  // Check if captcha is required for an action (login/register/forum)
  async checkRequired(action) {
    try {
      const r = await API.request('POST', '/captcha/required', { action });
      return r;
    } catch { return { required: false }; }
  },

  // Show captcha modal, returns Promise<boolean> (true = verified)
  async verify(action) {
    const r = await this.checkRequired(action);
    if (!r.required) return true;
    if (r.type === 'recaptcha') {
      return await this._showRecaptchaModal();
    }
    return await this._showBuiltinModal();
  },

  // Built-in captcha modal
  _showBuiltinModal() {
    return new Promise(async (resolve) => {
      // Create overlay
      this._removeModal();
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay active';
      overlay.style.cssText = 'display:flex;z-index:9999';
      overlay.innerHTML = `
        <div class="dialog" style="max-width:380px;text-align:center">
          <h3 style="margin-bottom:12px">验证码</h3>
          <div id="captchaModalImage" style="margin:0 auto 12px;max-width:240px"></div>
          <div style="display:flex;gap:8px;align-items:center;justify-content:center">
            <input type="text" id="captchaModalInput" placeholder="输入验证码" maxlength="6" style="flex:1;text-align:center;font-size:20px;letter-spacing:6px;text-transform:uppercase" autocomplete="off">
            <button class="btn btn-icon" id="captchaModalRefresh" title="刷新" style="flex-shrink:0"><span class="material-icons">refresh</span></button>
          </div>
          <div id="captchaModalError" style="color:var(--md-ref-error);font-size:13px;margin-top:8px;display:none"></div>
          <div class="actions" style="justify-content:center;margin-top:16px">
            <button class="btn btn-text" id="captchaModalCancel">取消</button>
            <button class="btn btn-filled" id="captchaModalConfirm">确认</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      this.modalOverlay = overlay;

      const input = overlay.querySelector('#captchaModalInput');
      const errEl = overlay.querySelector('#captchaModalError');

      const loadImage = async () => {
        try {
          const data = await API.request('GET', '/captcha/image');
          this.currentToken = data.token;
          const imgContainer = overlay.querySelector('#captchaModalImage');
          imgContainer.innerHTML = data.svg;
          const svg = imgContainer.querySelector('svg');
          if (svg) svg.style.cssText = 'width:100%;max-width:240px;height:auto;border-radius:8px;display:block';
        } catch {}
      };
      await loadImage();

      overlay.querySelector('#captchaModalRefresh').onclick = () => {
        input.value = '';
        errEl.style.display = 'none';
        loadImage();
      };

      const doVerify = async () => {
        const answer = input.value.trim();
        if (!answer || !this.currentToken) {
          errEl.textContent = '请输入验证码';
          errEl.style.display = 'block'; return;
        }
        try {
          const r = await API.request('POST', '/captcha/verify', { token: this.currentToken, answer });
          if (r.success) {
            this._removeModal();
            resolve(true);
          } else {
            errEl.textContent = r.error || '验证码错误';
            errEl.style.display = 'block';
            this.currentToken = null;
            input.value = '';
            loadImage();
          }
        } catch (e) {
          errEl.textContent = e.message;
          errEl.style.display = 'block';
        }
      };

      overlay.querySelector('#captchaModalConfirm').onclick = doVerify;
      overlay.querySelector('#captchaModalCancel').onclick = () => {
        this._removeModal();
        resolve(false);
      };
      input.onkeydown = (e) => { if (e.key === 'Enter') doVerify(); };
      setTimeout(() => input.focus(), 100);
    });
  },

  // reCAPTCHA modal
  _showRecaptchaModal() {
    return new Promise((resolve) => {
      this._removeModal();
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay active';
      overlay.style.cssText = 'display:flex;z-index:9999';
      overlay.innerHTML = `
        <div class="dialog" style="max-width:400px;text-align:center">
          <h3 style="margin-bottom:16px">请完成验证</h3>
          <div id="recaptchaModalWidget" style="display:flex;justify-content:center;margin:16px 0"></div>
          <div class="actions" style="justify-content:center">
            <button class="btn btn-filled" id="recaptchaModalConfirm" disabled>验证</button>
            <button class="btn btn-text" id="recaptchaModalCancel">取消</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      this.modalOverlay = overlay;

      const siteKey = window._recaptchaSiteKey || '';
      const widgetDiv = overlay.querySelector('#recaptchaModalWidget');
      const confirmBtn = overlay.querySelector('#recaptchaModalConfirm');

      if (!siteKey) {
        widgetDiv.innerHTML = '<span class="text-muted">reCAPTCHA 未配置</span>';
        return;
      }

      const renderWidget = () => {
        try {
          grecaptcha.render(widgetDiv, {
            sitekey: siteKey,
            callback: () => { confirmBtn.disabled = false; }
          });
        } catch {}
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

      confirmBtn.onclick = () => {
        const resp = typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : '';
        if (resp) {
          this._removeModal();
          resolve(true);
        }
      };
      overlay.querySelector('#recaptchaModalCancel').onclick = () => {
        this._removeModal();
        resolve(false);
      };
    });
  },

  _removeModal() {
    if (this.modalOverlay) { this.modalOverlay.remove(); this.modalOverlay = null; }
  }
};

window.onRecaptchaLoad = function() {
  (window.recaptchaCallbacks || []).forEach(cb => cb());
};
