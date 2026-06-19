const CAPTCHA = {
  currentToken: null,
  type: 'none',

  // Check if captcha is required for an action, returns {required, type}
  async checkRequired(action) {
    try {
      const r = await API.request('POST', '/captcha/required', { action });
      this.type = r.type || 'none';
      return r;
    } catch { return { required: false, type: 'none' }; }
  },

  // Load a new captcha image and get a token
  async load() {
    try {
      const r = await API.request('GET', '/captcha/image');
      this.currentToken = r.token;
      return r;
    } catch { return null; }
  },

  // Verify the user's answer against the server
  async verify(answer) {
    if (!this.currentToken || !answer) return { success: false, error: '请先加载验证码' };
    try {
      const r = await API.request('POST', '/captcha/verify', { token: this.currentToken, answer });
      if (r.success) this.currentToken = null;
      return r;
    } catch (e) { return { success: false, error: e.message }; }
  },

  // Render built-in captcha into a container element
  // Returns the token when captcha is loaded and ready
  async renderBuiltin(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    container.innerHTML = '';
    container.style.display = 'block';

    // Build UI
    const wrapper = document.createElement('div');
    wrapper.className = 'captcha-wrapper';
    wrapper.innerHTML = `
      <div class="captcha-image" id="capImg_${containerId}"><div class="spinner" style="width:24px;height:24px;margin:16px auto"></div></div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
        <input type="text" id="capInput_${containerId}" placeholder="输入验证码" maxlength="6" style="flex:1;text-align:center;font-size:18px;letter-spacing:4px;text-transform:uppercase" autocomplete="off">
        <button class="btn btn-icon" id="capRefresh_${containerId}" title="刷新" style="flex-shrink:0"><span class="material-icons">refresh</span></button>
      </div>
      <div id="capError_${containerId}" style="color:var(--md-ref-error);font-size:13px;margin-top:4px;display:none"></div>`;
    container.appendChild(wrapper);

    // Refresh handler
    document.getElementById('capRefresh_' + containerId).onclick = () => this._loadImage(containerId);

    // Load image and return token
    return await this._loadImage(containerId);
  },

  async _loadImage(containerId) {
    const data = await this.load();
    if (!data) return null;
    const imgDiv = document.getElementById('capImg_' + containerId);
    if (imgDiv) {
      imgDiv.innerHTML = data.svg;
      const svg = imgDiv.querySelector('svg');
      if (svg) {
        svg.style.cssText = 'width:100%;max-width:240px;height:auto;border-radius:8px;display:block';
      }
    }
    this.currentToken = data.token;
    return data.token;
  },

  // Get current value from a specific container's input
  getValue(containerId) {
    const input = document.getElementById('capInput_' + containerId);
    return input ? input.value.trim() : '';
  },

  getToken() { return this.currentToken; },

  // Reset captcha in a container
  reset(containerId) {
    this.currentToken = null;
    const input = document.getElementById('capInput_' + containerId);
    if (input) input.value = '';
    this._loadImage(containerId);
  }
};
