// ── Global color helpers ──
function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3), 16) / 255;
  let g = parseInt(hex.slice(3,5), 16) / 255;
  let b = parseInt(hex.slice(5,7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s2 = 0, l2 = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s2 = l2 > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s2 * 100, l2 * 100];
}
function hslToHex(h2, s2, l2) {
  h2 /= 360; s2 /= 100; l2 /= 100;
  let r, g, b;
  if (s2 === 0) { r = g = b = l2; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q2 = l2 < 0.5 ? l2 * (1 + s2) : l2 + s2 - l2 * s2;
    const p2 = 2 * l2 - q2;
    r = hue2rgb(p2, q2, h2 + 1/3);
    g = hue2rgb(p2, q2, h2);
    b = hue2rgb(p2, q2, h2 - 1/3);
  }
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}
function isLight(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160;
}
function injectThemeStyle(settings) {
  const color = settings.primary_color || '#6750a4';
  const styleId = 'rainweb-theme';
  const old = document.getElementById(styleId);
  if (old) old.remove();

  const [hue, sat] = hexToHsl(color);
  const ps = (x) => Math.min(sat * x, 70);
  const ss = (x) => Math.min(sat * x, 40);
  const su = (x) => Math.min(sat * x, 45);
  const light = isLight(color);

  const sheet = document.createElement('style');
  sheet.id = styleId;
  sheet.textContent =
':root{' +
  '--md-source:' + color + ';' +
  '--md-ref-primary:' + color + ';' +
  '--md-ref-on-primary:' + (light ? '#1c1b1f' : '#ffffff') + ';' +
  '--md-ref-primary-container:' + hslToHex(hue, ps(0.4), 90) + ';' +
  '--md-ref-on-primary-container:' + hslToHex(hue, ps(0.6), 10) + ';' +
  '--md-ref-secondary:' + hslToHex(hue, ss(0.2), 42) + ';' +
  '--md-ref-on-secondary:#ffffff;' +
  '--md-ref-secondary-container:' + hslToHex(hue, ss(0.15), 90) + ';' +
  '--md-ref-on-secondary-container:' + hslToHex(hue, ss(0.3), 12) + ';' +
  '--md-ref-surface-container:' + hslToHex(hue, su(0.3), 88) + ';' +
  '--md-ref-surface-container-low:' + hslToHex(hue, su(0.2), 92) + ';' +
  '--md-ref-surface-container-high:' + hslToHex(hue, su(0.4), 84) + ';' +
  '--md-ref-surface-variant:' + hslToHex(hue, su(0.5), 82) + ';' +
  '--md-ref-on-surface-variant:' + hslToHex(hue, ss(0.15), 28) + ';' +
  '--md-ref-outline:' + hslToHex(hue, ss(0.2), 50) + ';' +
  '--md-ref-outline-variant:' + hslToHex(hue, su(0.3), 74) + ';' +
  '--md-card-bg:' + hslToHex(hue, su(0.15), 96) + ';' +
  '--md-ref-primary-rgb:' + parseInt(color.slice(1,3),16) + ',' + parseInt(color.slice(3,5),16) + ',' + parseInt(color.slice(5,7),16) + ';' +
'}' +
'[data-theme="dark"]{' +
  '--md-source:' + color + ';' +
  '--md-ref-primary:' + hslToHex(hue, ps(0.6), 78) + ';' +
  '--md-ref-on-primary:' + hslToHex(hue, ps(0.3), 12) + ';' +
  '--md-ref-primary-container:' + hslToHex(hue, ps(0.35), 22) + ';' +
  '--md-ref-on-primary-container:' + hslToHex(hue, ps(0.4), 88) + ';' +
  '--md-ref-secondary:' + hslToHex(hue, ss(0.15), 74) + ';' +
  '--md-ref-on-secondary:' + hslToHex(hue, ss(0.06), 12) + ';' +
  '--md-ref-secondary-container:' + hslToHex(hue, ss(0.2), 22) + ';' +
  '--md-ref-on-secondary-container:' + hslToHex(hue, ss(0.1), 86) + ';' +
  '--md-ref-surface-container:' + hslToHex(hue, su(0.4), 10) + ';' +
  '--md-ref-surface-container-low:' + hslToHex(hue, su(0.3), 8) + ';' +
  '--md-ref-surface-container-high:' + hslToHex(hue, su(0.5), 13) + ';' +
  '--md-ref-surface-variant:' + hslToHex(hue, su(0.6), 18) + ';' +
  '--md-ref-on-surface-variant:' + hslToHex(hue, ss(0.1), 76) + ';' +
  '--md-ref-outline:' + hslToHex(hue, ss(0.15), 52) + ';' +
  '--md-ref-outline-variant:' + hslToHex(hue, su(0.5), 22) + ';' +
  '--md-card-bg:' + hslToHex(hue, su(0.3), 10) + ';' +
'}';
  document.head.appendChild(sheet);
}

const NAV = {
  currentUser: null,
  siteSettings: {},

  async init() {
    // Check if setup is needed
    try {
      const setup = await API.request('GET', '/setup/status');
      if (!setup.setup_complete && location.pathname !== '/setup.html') {
        window.location.href = '/setup.html';
        return;
      }
    } catch {}

    const token = localStorage.getItem('token');
    this.currentUser = null;
    if (token) {
      try { this.currentUser = await API.getMe(); } catch { localStorage.removeItem('token'); }
    }
    try {
      this.siteSettings = await API.getPublicSettings();
      window._recaptchaSiteKey = this.siteSettings.recaptcha_site_key || '';
      window._turnstileSiteKey = this.siteSettings.turnstile_site_key || '';
    } catch {}
    try {
      const v = await API.request('GET', '/version');
      window._appVersion = v.version;
    } catch {}
    this.render();
    this.applyTheme();
  },

  render() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;
    const user = this.currentUser;
    const isAdmin = user && user.role === 'admin';
    const siteName = this.siteSettings.site_name || 'RainWeb';
    const path = location.pathname;

    let tabs = `<a href="/" class="nav-tab ${path === '/' ? 'active' : ''}">首页</a><a href="/blog.html" class="nav-tab ${path === '/blog.html' ? 'active' : ''}">博客</a>`;
    if (user) tabs += `<a href="/forum.html" class="nav-tab ${path === '/forum.html' ? 'active' : ''}">论坛</a>`;
    if (isAdmin) tabs += `<a href="/admin.html" class="nav-tab ${path === '/admin.html' ? 'active' : ''}">管理面板</a>`;
    if (isAdmin) tabs += `<a href="/passwords.html" class="nav-tab ${path === '/passwords.html' ? 'active' : ''}">密码箱</a>`;

    let right = `<button class="btn-icon" onclick="toggleTheme()" title="切换主题"><span class="material-icons">dark_mode</span></button>`;
    if (user) {
      // Fetch avatar from service (handles QQ auto + uploaded)
      let avatarUrl = user.avatar || '';
      if (!avatarUrl && user.email && user.email.match(/^(\d+)@qq\.com$/i)) {
        avatarUrl = 'https://q1.qlogo.cn/g?b=qq&nk=' + RegExp.$1 + '&s=100';
      }
      const avatarHtml = avatarUrl
        ? `<img src="${avatarUrl}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;margin-right:4px">`
        : `<span class="material-icons" style="font-size:18px;margin-right:2px">person</span>`;
      right += `<a href="/profile.html" class="btn btn-tonal btn-sm" title="个人中心">${avatarHtml} ${escapeHtml(user.username)}</a>`;
    } else {
      right += `<a href="/login.html" class="btn btn-tonal btn-sm">登录</a><a href="/register.html" class="btn btn-filled btn-sm">注册</a>`;
    }

    nav.innerHTML = `
      <div class="nav-left">
        <a href="/" class="nav-brand">${escapeHtml(siteName)}</a>
        <span class="nav-version">v${escapeHtml(window._appVersion || '')}</span>
        <div class="nav-tabs">${tabs}</div>
      </div>
      <div class="nav-right">${right}</div>`;
  },

  applyTheme() {
    const s = this.siteSettings;
    // Force dark mode
    if (s.theme_force_dark === '1') {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      window._forceDark = true;
    } else {
      window._forceDark = false;
    }
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    injectThemeStyle(s);

    const body = document.body;
    const wallpaper = s.theme_wallpaper || '';
    const scale = s.theme_wallpaper_scale || 'cover';

    if (wallpaper) {
      body.classList.add('has-wallpaper');
      body.style.setProperty('--wallpaper', `url(${wallpaper})`);
      const bgSizeMap = { cover: 'cover', contain: 'contain', repeat: 'auto', stretch: '100% 100%' };
      const bgRepeatMap = { repeat: 'repeat', stretch: 'no-repeat', cover: 'no-repeat', contain: 'no-repeat' };
      body.style.backgroundSize = bgSizeMap[scale] || 'cover';
      body.style.backgroundRepeat = bgRepeatMap[scale] || 'no-repeat';
    } else {
      body.classList.remove('has-wallpaper');
      body.style.removeProperty('--wallpaper');
      body.style.backgroundSize = '';
      body.style.backgroundRepeat = '';
    }

    // Glass blur & opacity
    document.documentElement.style.setProperty('--glass-blur', (s.glass_blur || '20') + 'px');

    // Nav style
    const nav = document.getElementById('mainNav');
    if (nav) {
      nav.className = 'nav-bar';
      const ns = s.nav_style || 'default';
      if (ns === 'glass') nav.classList.add('nav-glass');
      if (ns === 'capsule') nav.classList.add('nav-capsule');
    }

    // Card style
    const cs = s.card_style || 'default';
    document.querySelectorAll('.card, .blog-card, .panel-card, .link-card, .forum-post-card, .password-card, .forum-cat-item, .chip').forEach(el => {
      el.classList.toggle('glass-card', cs === 'glass');
    });

    // Brightness-based text readability for wallpaper backgrounds
    // When wallpaper is present, compute luminance and add overlay
    if (wallpaper) {
      // Try to determine if wallpaper is light or dark by sampling a pixel via canvas
      // Simple fallback: check theme mode - dark mode means wallpaper likely dark
      const isLikelyDark = isDark;
      document.documentElement.style.setProperty('--wallpaper-overlay', isLikelyDark
        ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.15)');
      document.documentElement.style.setProperty('--wallpaper-text', isLikelyDark
        ? '#e6e1e5' : '#1c1b1f');
    } else {
      document.documentElement.style.removeProperty('--wallpaper-overlay');
      document.documentElement.style.removeProperty('--wallpaper-text');
    }
  }
};

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => NAV.init());
