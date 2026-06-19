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
      this.siteSettings = await API.getSettings();
      window._recaptchaSiteKey = this.siteSettings.recaptcha_site_key || '';
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

    let tabs = `<a href="/" class="nav-tab ${path === '/' ? 'active' : ''}">博客</a>`;
    if (user) tabs += `<a href="/forum.html" class="nav-tab ${path === '/forum.html' ? 'active' : ''}">论坛</a>`;
    if (isAdmin) tabs += `<a href="/admin.html" class="nav-tab ${path === '/admin.html' ? 'active' : ''}">管理面板</a>`;
    if (isAdmin) tabs += `<a href="/passwords.html" class="nav-tab ${path === '/passwords.html' ? 'active' : ''}">密码箱</a>`;

    let right = `<button class="btn-icon" onclick="toggleTheme()" title="切换主题"><span class="material-icons">dark_mode</span></button>`;
    if (user) {
      right += `<a href="/profile.html" class="btn btn-tonal btn-sm" title="个人中心"><span class="material-icons">person</span> ${escapeHtml(user.username)}</a>`;
    } else {
      right += `<a href="/login.html" class="btn btn-tonal btn-sm">登录</a><a href="/register.html" class="btn btn-filled btn-sm">注册</a>`;
    }

    nav.innerHTML = `
      <div class="nav-left">
        <a href="/" class="nav-brand">${escapeHtml(siteName)}</a>
        <div class="nav-tabs">${tabs}</div>
      </div>
      <div class="nav-right">${right}</div>`;
  },

  applyTheme() {
    const s = this.siteSettings;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const color = s.primary_color || '#6750a4';
    document.documentElement.style.setProperty('--md-source', color);
    document.documentElement.style.setProperty('--md-ref-primary', color);

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

    // Primary container color
    const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    document.documentElement.style.setProperty('--md-ref-primary-container', `rgba(${r},${g},${b},0.15)`);

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
