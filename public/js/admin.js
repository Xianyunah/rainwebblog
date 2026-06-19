let currentTab = 'panels';
let useMarkdown = 1;

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}
function closeDialog(id) { document.getElementById(id).classList.remove('active'); }
function openDialog(id) { document.getElementById(id).classList.add('active'); }

// === Auth Check ===
async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/login.html'; return; }
  try {
    const me = await API.getMe();
    if (me.role !== 'admin') { showSnackbar('需要管理员权限'); setTimeout(() => window.location.href = '/', 1000); }
    return me;
  } catch { localStorage.removeItem('token'); window.location.href = '/login.html'; }
}

// === Tab Switching ===
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('adminTitle').textContent =
    ({ panels: '管理面板', links: '面板链接', settings: '站点设置', forum: '论坛管理', blog: '博客管理', users: '用户管理', email: '邮件配置' })[tab] || '管理面板';
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).style.display = 'block';
  const actions = { panels: loadPanels, links: loadLinks, settings: loadSettings, theme: loadThemeSettings, forum: () => { loadForumCats(); loadForumPosts(); }, blog: loadBlogPosts, users: loadUsers, email: loadEmailSettings };
  if (actions[tab]) actions[tab]();
}

// === Panel Dashboard ===
async function loadPanels() {
  const grid = document.getElementById('panelsGrid');
  grid.innerHTML = '<div class="loading" style="grid-column:1/-1"><div class="spinner"></div></div>';
  try {
    const links = await API.getAdminLinks();
    const cats = {};
    links.forEach(l => { if (!cats[l.category]) cats[l.category] = []; cats[l.category].push(l); });
    const sortedCats = Object.keys(cats).sort();
    let html = '';
    for (const cat of sortedCats) {
      html += `<div style="grid-column:1/-1;font-size:16px;font-weight:600;margin:8px 0 4px;color:var(--md-ref-on-surface-variant)">${escapeHtml(cat)}</div>`;
      html += cats[cat].map(l => {
        const icon = l.icon ? `<span class="material-icons" style="font-size:24px">${escapeHtml(l.icon)}</span>` : '<span style="font-size:20px">🔗</span>';
        const embedUrl = l.embed_url || l.url;
        const proxyParam = l.use_proxy ? '&proxy=1' : '';
        return `<a href="${embedUrl ? '/embed.html?url=' + encodeURIComponent(embedUrl) + '&title=' + encodeURIComponent(l.title) + proxyParam : l.url}" target="${embedUrl ? '' : '_blank'}" class="card card-hover panel-card">
          <div class="panel-icon">${icon}</div>
          <div class="panel-info"><div class="panel-title">${escapeHtml(l.title)}${l.version ? ' <span style="font-size:12px;color:var(--md-ref-on-surface-variant);font-weight:400">' + escapeHtml(l.version) + '</span>' : ''}</div><div class="panel-desc">${escapeHtml(l.description || l.url)}</div></div>
          <div class="panel-embed"><span class="material-icons">${embedUrl ? 'open_in_new' : 'launch'}</span></div>
        </a>`;
      }).join('');
    }
    if (links.length === 0) html = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📋</div><p>暂无面板，请先在"面板链接"中添加</p></div>';
    grid.innerHTML = html;
  } catch (e) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⚠️</div><p>' + escapeHtml(e.message) + '</p></div>'; }
}

// === Admin Links ===
async function loadLinks() {
  const tbody = document.getElementById('linksBody');
  try {
    const links = await API.getAdminLinks();
    if (links.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">暂无面板</td></tr>'; return; }
    tbody.innerHTML = links.map(l => `<tr>
      <td>${l.sort_order}</td>
      <td><strong>${escapeHtml(l.title)}</strong></td>
      <td class="text-muted" style="font-size:13px">${l.version ? escapeHtml(l.version) : '-'}</td>
      <td class="truncate" style="max-width:180px"><a href="${escapeHtml(l.url)}" target="_blank" style="color:var(--md-ref-primary)">${escapeHtml(l.url)}</a></td>
      <td class="truncate" style="max-width:150px;font-size:13px;color:var(--md-ref-on-surface-variant)">${escapeHtml(l.embed_url || '-')}</td>
      <td><span class="chip" style="cursor:default;font-size:12px">${escapeHtml(l.category)}</span></td>
      <td><button class="btn btn-text btn-sm" onclick="editLink(${l.id})">编辑</button><button class="btn btn-text btn-sm" style="color:var(--md-ref-error)" onclick="confirmDelete('link',${l.id},'${escapeHtml(l.title)}')">删除</button></td>
    </tr>`).join('');
  } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">加载失败</td></tr>'; }
}

function openLinkDialog(data) {
  ['linkId','linkTitle','linkUrl','linkDesc','linkIcon','linkCategory','linkEmbedUrl','linkSort'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    if (id === 'linkId') el.value = data ? data.id : '';
    else if (id === 'linkSort') el.value = data ? data.sort_order : 0;
    else el.value = data ? (data[id.replace('link', '').replace(/^(.)/, c => c.toLowerCase())] || '') : '';
  });
  // fix mapping
  if (data) {
    document.getElementById('linkTitle').value = data.title || '';
    document.getElementById('linkUrl').value = data.url || '';
    document.getElementById('linkDesc').value = data.description || '';
    document.getElementById('linkIcon').value = data.icon || '';
    document.getElementById('linkCategory').value = data.category || '默认';
    document.getElementById('linkEmbedUrl').value = data.embed_url || '';
    document.getElementById('linkProxy').checked = !!data.use_proxy;
    document.getElementById('linkVersion').value = data.version || '';
    document.getElementById('linkSort').value = data.sort_order || 0;
  }
  document.getElementById('linkDialogTitle').textContent = data ? '编辑面板' : '添加面板';
  openDialog('linkDialog');
}

async function saveLink() {
  const id = document.getElementById('linkId').value;
  const data = { title: document.getElementById('linkTitle').value.trim(), url: document.getElementById('linkUrl').value.trim(),
    description: document.getElementById('linkDesc').value.trim(), icon: document.getElementById('linkIcon').value.trim(),
    category: document.getElementById('linkCategory').value.trim() || '默认',
    embed_url: document.getElementById('linkEmbedUrl').value.trim(),
    use_proxy: document.getElementById('linkProxy').checked ? 1 : 0,
    version: document.getElementById('linkVersion').value.trim(),
    sort_order: parseInt(document.getElementById('linkSort').value) || 0 };
  if (!data.title || !data.url) { showSnackbar('标题和链接不能为空'); return; }
  try {
    if (id) await API.updateAdminLink(id, data);
    else await API.createAdminLink(data);
    showSnackbar('保存成功'); closeDialog('linkDialog'); loadLinks();
  } catch (e) { showSnackbar(e.message); }
}

function editLink(id) { API.getAdminLinks().then(links => { const l = links.find(x => x.id === id); if (l) openLinkDialog(l); }); }

// === Settings ===
async function loadSettings() {
  try {
    const s = await API.getSettings();
    document.getElementById('setSiteName').value = s.site_name || '';
    document.getElementById('setSiteDesc').value = s.site_description || '';
    document.getElementById('setPrimaryColor').value = s.primary_color || '#6750a4';
    document.getElementById('setRecaptchaSite').value = s.recaptcha_site_key || '';
    document.getElementById('setRecaptchaSecret').value = '';
    // Captcha settings
    document.getElementById('captchaType').value = s.captcha_type || 'none';
    document.getElementById('capLogin').checked = s.captcha_login === '1';
    document.getElementById('capRegister').checked = s.captcha_register === '1';
    document.getElementById('capForum').checked = s.captcha_forum === '1';
    toggleCaptchaConfig();
  } catch (e) { showSnackbar(e.message); }
}
async function saveSettings() {
  try {
    await API.saveSettings({
      site_name: document.getElementById('setSiteName').value.trim(),
      site_description: document.getElementById('setSiteDesc').value.trim(),
      primary_color: document.getElementById('setPrimaryColor').value,
      recaptcha_site_key: document.getElementById('setRecaptchaSite').value.trim(),
      recaptcha_secret_key: document.getElementById('setRecaptchaSecret').value.trim(),
      captcha_type: document.getElementById('captchaType').value,
      captcha_login: document.getElementById('capLogin').checked ? '1' : '0',
      captcha_register: document.getElementById('capRegister').checked ? '1' : '0',
      captcha_forum: document.getElementById('capForum').checked ? '1' : '0',
    });
    showSnackbar('设置已保存');
    if (window.NAV) NAV.init();
  } catch (e) { showSnackbar(e.message); }
}

async function loadThemeSettings() {
  try {
    const s = await API.getSettings();
    document.getElementById('setPrimaryColor').value = s.primary_color || '#6750a4';
    document.getElementById('setWallpaper').value = s.theme_wallpaper || '';
    document.getElementById('setWallpaperScale').value = s.theme_wallpaper_scale || 'cover';
    document.getElementById('setGlassBlur').value = s.glass_blur || '20';
    document.getElementById('blurVal').textContent = (s.glass_blur || '20') + 'px';
    document.getElementById('setGlassOpacity').value = s.glass_opacity || '0.6';
    document.getElementById('opacityVal').textContent = s.glass_opacity || '0.6';
    loadWallpaperList();
    if (s.theme_wallpaper) previewWallpaperUrl(s.theme_wallpaper);
    setNavStyle(s.nav_style || 'default');
    setCardStyle(s.card_style || 'default');
  } catch (e) { showSnackbar(e.message); }
}

function setNavStyle(val) {
  document.querySelectorAll('#navStyleGroup .toggle-btn').forEach(el => el.classList.toggle('active', el.dataset.val === val));
  window._navStyle = val;
}

function setCardStyle(val) {
  document.querySelectorAll('#cardStyleGroup .toggle-btn').forEach(el => el.classList.toggle('active', el.dataset.val === val));
  window._cardStyle = val;
}

function previewWallpaperUrl(url) {
  const preview = document.getElementById('wallpaperPreview');
  if (url) {
    preview.style.display = 'block';
    document.getElementById('wallpaperPreviewImg').src = url;
    document.getElementById('wallpaperFilename').textContent = 'URL: ' + url;
  } else { preview.style.display = 'none'; }
}

function removeWallpaper() {
  document.getElementById('setWallpaper').value = '';
  document.getElementById('wallpaperPreview').style.display = 'none';
}

async function loadWallpaperList() {
  try {
    const list = await API.request('GET', '/upload/wallpapers');
    const container = document.getElementById('uploadedWallpapers');
    if (list.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = list.map(f =>
      `<div style="position:relative;cursor:pointer" onclick="selectUploadedWallpaper('${f.url}')">
        <img src="${f.url}" style="width:100%;height:60px;object-fit:cover;border-radius:8px;border:1px solid var(--md-ref-outline-variant)" title="${f.filename}">
        <div style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;color:var(--md-ref-on-surface-variant)">${f.filename}</div>
      </div>`).join('');
  } catch {}
}

function selectUploadedWallpaper(url) {
  document.getElementById('setWallpaper').value = url;
  previewWallpaperUrl(url);
}

async function uploadWallpaper() {
  const fileInput = document.getElementById('wallpaperFile');
  if (!fileInput.files || !fileInput.files[0]) { showSnackbar('请选择图片文件'); return; }
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/upload/wallpaper', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '上传失败');
    document.getElementById('setWallpaper').value = data.url;
    previewWallpaperUrl(data.url);
    loadWallpaperList();
    showSnackbar('上传成功');
  } catch (e) { showSnackbar(e.message); }
}

async function saveThemeSettings() {
  try {
    const data = {
      primary_color: document.getElementById('setPrimaryColor').value,
      theme_wallpaper: document.getElementById('setWallpaper').value.trim(),
      theme_wallpaper_scale: document.getElementById('setWallpaperScale').value,
      nav_style: window._navStyle || 'default',
      card_style: window._cardStyle || 'default',
      glass_blur: document.getElementById('setGlassBlur').value,
      glass_opacity: document.getElementById('setGlassOpacity').value,
    };
    await API.saveSettings(data);
    showSnackbar('已保存');
    if (window.NAV) {
      window.NAV.siteSettings = await API.getSettings();
      window.NAV.applyTheme();
    }
  } catch (e) { showSnackbar(e.message); }
}



function setNavStyle(val) {
  document.querySelectorAll('#navStyleGroup .toggle-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.val === val);
  });
  window._navStyle = val;
}

function setGlassComponents(val) {
  document.querySelectorAll('#glassComponentsGroup .toggle-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.val === val);
  });
  window._glassComponents = val;
}

function setCardStyle(val) {
  document.querySelectorAll('#cardStyleGroup .toggle-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.val === val);
  });
  window._cardStyle = val;
}

function previewWallpaperUrl(url) {
  const preview = document.getElementById('wallpaperPreview');
  if (url) {
    preview.style.display = 'block';
    document.getElementById('wallpaperPreviewImg').src = url;
    document.getElementById('wallpaperFilename').textContent = 'URL: ' + url;
  } else {
    preview.style.display = 'none';
  }
}

function removeWallpaper() {
  document.getElementById('setWallpaper').value = '';
  document.getElementById('wallpaperPreview').style.display = 'none';
}

async function loadWallpaperList() {
  try {
    const list = await API.request('GET', '/upload/wallpapers');
    const container = document.getElementById('uploadedWallpapers');
    if (list.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = list.map(f => `
      <div style="position:relative;cursor:pointer" onclick="selectUploadedWallpaper('${f.url}')">
        <img src="${f.url}" style="width:100%;height:60px;object-fit:cover;border-radius:8px;border:1px solid var(--md-ref-outline-variant)" title="${f.filename}">
        <div style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;color:var(--md-ref-on-surface-variant)">${f.filename}</div>
      </div>
    `).join('');
  } catch {}
}

function selectUploadedWallpaper(url) {
  document.getElementById('setWallpaper').value = url;
  previewWallpaperUrl(url);
}

async function uploadWallpaper() {
  const fileInput = document.getElementById('wallpaperFile');
  if (!fileInput.files || !fileInput.files[0]) { showSnackbar('请选择图片文件'); return; }
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/upload/wallpaper', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '上传失败');
    document.getElementById('setWallpaper').value = data.url;
    previewWallpaperUrl(data.url);
    loadWallpaperList();
    showSnackbar('上传成功');
  } catch (e) { showSnackbar(e.message); }
}

async function saveThemeSettings() {
  try {
    const data = {
      theme_preset: window._selectedPreset || 'default',
      theme_wallpaper: document.getElementById('setWallpaper').value.trim(),
      theme_wallpaper_scale: document.getElementById('setWallpaperScale').value,
      nav_style: window._navStyle || 'default',
      card_style: window._cardStyle || 'default',
      glass_blur: document.getElementById('setGlassBlur').value,
      glass_opacity: document.getElementById('setGlassOpacity').value,
    };
    // Also include primary_color if changed by preset
    const colorInput = document.getElementById('setPrimaryColor');
    if (colorInput) data.primary_color = colorInput.value;

    await API.saveSettings(data);
    showSnackbar('主题设置已保存');
    if (window.NAV) NAV.init(); // refresh
  } catch (e) { showSnackbar(e.message); }
}

// === Background Color ===
function applyBgColor(color) {
  document.body.style.setProperty('--md-ref-background', color);
  document.body.style.background = color;
}

// === Captcha Config Toggle ===
function toggleCaptchaConfig() {
  const type = document.getElementById('captchaType').value;
  document.getElementById('captchaScopeConfig').style.display = type === 'none' ? 'none' : 'block';
  document.getElementById('recaptchaConfig').style.display = type === 'recaptcha' ? 'block' : 'none';
}

// === Email Settings ===
async function loadEmailSettings() {
  try {
    const s = await API.getSettings();
    document.getElementById('setSmtpHost').value = s.smtp_host || '';
    document.getElementById('setSmtpPort').value = s.smtp_port || '587';
    document.getElementById('setSmtpUser').value = s.smtp_user || '';
    document.getElementById('setSmtpFrom').value = s.smtp_from_email || '';
    document.getElementById('setSmtpFromName').value = s.smtp_from_name || 'RainWeb';
  } catch (e) { showSnackbar(e.message); }
}
async function saveSmtpSettings() {
  try {
    await API.saveSettings({ smtp_host: document.getElementById('setSmtpHost').value.trim(),
      smtp_port: document.getElementById('setSmtpPort').value,
      smtp_user: document.getElementById('setSmtpUser').value.trim(),
      smtp_pass: document.getElementById('setSmtpPass').value,
      smtp_from_email: document.getElementById('setSmtpFrom').value.trim(),
      smtp_from_name: document.getElementById('setSmtpFromName').value.trim() });
    showSnackbar('邮件配置已保存');
  } catch (e) { showSnackbar(e.message); }
}
async function testSmtp() {
  const email = prompt('请输入接收测试邮件的邮箱地址：', localStorage.getItem('username') + '@example.com');
  if (!email) return;
  try {
    await API.request('POST', '/email/test', { email });
    showSnackbar('测试邮件已发送至 ' + email);
  } catch (e) { showSnackbar(e.message); }
}

// === Forum ===
async function loadForumCats() {
  const tbody = document.getElementById('forumCatsBody');
  try {
    const cats = await API.getForumCategories();
    tbody.innerHTML = cats.length === 0 ? '<tr><td colspan="4" class="text-center text-muted">暂无分类</td></tr>' :
      cats.map(c => `<tr><td><strong>${escapeHtml(c.name)}</strong></td><td class="text-muted">${escapeHtml(c.description||'')}</td><td>${c.sort_order}</td>
        <td><button class="btn btn-text btn-sm" onclick="editForumCat(${c.id})">编辑</button><button class="btn btn-text btn-sm" style="color:var(--md-ref-error)" onclick="confirmDelete('forumcat',${c.id},'${escapeHtml(c.name)}')">删除</button></td></tr>`).join('');
  } catch (e) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">加载失败</td></tr>'; }
}
async function loadForumPosts() {
  const tbody = document.getElementById('forumPostsBody');
  try {
    const posts = await API.getForumPosts();
    const cats = await API.getForumCategories();
    const catMap = {}; cats.forEach(c => catMap[c.id] = c.name);
    tbody.innerHTML = posts.length === 0 ? '<tr><td colspan="6" class="text-center text-muted">暂无帖子</td></tr>' :
      posts.map(p => `<tr><td><strong>${escapeHtml(p.title)}</strong></td><td><span class="chip" style="cursor:default;font-size:12px">${escapeHtml(catMap[p.category_id]||'')}</span></td>
        <td>${escapeHtml(p.author_name||'')}</td><td>${p.reply_count||0}</td><td class="text-muted" style="font-size:13px">${p.created_at}</td>
        <td><button class="btn btn-text btn-sm" style="color:var(--md-ref-error)" onclick="confirmDelete('forumpost',${p.id},'${escapeHtml(p.title)}')">删除</button></td></tr>`).join('');
  } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">加载失败</td></tr>'; }
}
function openForumCatDialog(data) {
  document.getElementById('forumCatId').value = data ? data.id : '';
  document.getElementById('forumCatName').value = data ? data.name : '';
  document.getElementById('forumCatDesc').value = data ? (data.description || '') : '';
  document.getElementById('forumCatSort').value = data ? data.sort_order : 0;
  document.getElementById('forumCatDialogTitle').textContent = data ? '编辑分类' : '添加分类';
  openDialog('forumCatDialog');
}
async function saveForumCat() {
  const id = document.getElementById('forumCatId').value;
  const data = { name: document.getElementById('forumCatName').value.trim(), description: document.getElementById('forumCatDesc').value.trim(), sort_order: parseInt(document.getElementById('forumCatSort').value) || 0 };
  if (!data.name) { showSnackbar('名称不能为空'); return; }
  try {
    if (id) await API.updateForumCategory(id, data); else await API.createForumCategory(data);
    showSnackbar('保存成功'); closeDialog('forumCatDialog'); loadForumCats();
  } catch (e) { showSnackbar(e.message); }
}
function editForumCat(id) { API.getForumCategories().then(cats => { const c = cats.find(x => x.id === id); if (c) openForumCatDialog(c); }); }

// === Blog ===
async function loadBlogPosts() {
  const tbody = document.getElementById('blogBody');
  try {
    const posts = await API.getBlogPosts(true);
    tbody.innerHTML = posts.length === 0 ? '<tr><td colspan="5" class="text-center text-muted">暂无文章</td></tr>' :
      posts.map(p => `<tr><td><strong>${escapeHtml(p.title)}</strong></td>
        <td><span class="chip" style="cursor:default;font-size:12px;background:${p.published?'var(--md-ref-primary-container)':'var(--md-ref-surface-variant)'}">${p.published?'已发布':'草稿'}</span></td>
        <td><span class="chip" style="cursor:default;font-size:12px">${p.use_markdown?'Markdown':'纯文本'}</span></td>
        <td class="text-muted" style="font-size:13px">${p.created_at}</td>
        <td><button class="btn btn-text btn-sm" onclick="editBlogPost(${p.id})">编辑</button><button class="btn btn-text btn-sm" style="color:var(--md-ref-error)" onclick="confirmDelete('blog',${p.id},'${escapeHtml(p.title)}')">删除</button></td></tr>`).join('');
  } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">加载失败</td></tr>'; }
}
function setMarkdown(val) { useMarkdown = val; document.getElementById('toggleMd').className = 'toggle-btn' + (val ? ' active' : ''); document.getElementById('togglePlain').className = 'toggle-btn' + (!val ? ' active' : ''); }
function previewMarkdown() {
  const content = document.getElementById('blogContent').value;
  const preview = document.getElementById('blogPreview');
  if (useMarkdown && typeof marked !== 'undefined') { preview.innerHTML = marked.parse(content, { breaks: true }); preview.style.display = 'block'; }
  else { preview.innerHTML = '<pre style="white-space:pre-wrap">' + escapeHtml(content) + '</pre>'; preview.style.display = 'block'; }
}
function openBlogDialog(data) {
  document.getElementById('blogId').value = data ? data.id : '';
  document.getElementById('blogTitle').value = data ? data.title : '';
  document.getElementById('blogExcerpt').value = data ? (data.excerpt || '') : '';
  document.getElementById('blogContent').value = data ? data.content : '';
  document.getElementById('blogPublished').checked = data ? !!data.published : true;
  setMarkdown(data ? (data.use_markdown !== 0 ? 1 : 0) : 1);
  document.getElementById('blogPreview').style.display = 'none';
  document.getElementById('blogDialogTitle').textContent = data ? '编辑文章' : '写文章';
  openDialog('blogDialog');
}
async function saveBlogPost() {
  const id = document.getElementById('blogId').value;
  const data = { title: document.getElementById('blogTitle').value.trim(), content: document.getElementById('blogContent').value.trim(),
    excerpt: document.getElementById('blogExcerpt').value.trim(), published: document.getElementById('blogPublished').checked, use_markdown: useMarkdown };
  if (!data.title || !data.content) { showSnackbar('标题和内容不能为空'); return; }
  try {
    if (id) await API.updateBlogPost(id, data); else await API.createBlogPost(data);
    showSnackbar('保存成功'); closeDialog('blogDialog'); loadBlogPosts();
  } catch (e) { showSnackbar(e.message); }
}
function editBlogPost(id) { API.getBlogPosts(true).then(list => { const p = list.find(x => x.id === id); if (p) openBlogDialog(p); }); }

// === Users ===
async function loadUsers() {
  const tbody = document.getElementById('usersBody');
  try {
    const users = await API.getUsers();
    tbody.innerHTML = users.map(u => `<tr><td>${u.id}</td><td><strong>${escapeHtml(u.username)}</strong></td>
      <td class="text-muted">${escapeHtml(u.email||'-')}</td>
      <td>${u.email_verified ? '<span class="chip" style="cursor:default;font-size:12px;background:var(--md-ref-primary-container)">已验证</span>' : '<span class="chip" style="cursor:default;font-size:12px;background:var(--md-ref-surface-variant)">未验证</span>'}</td>
      <td><span class="chip" style="cursor:default;font-size:12px;background:${u.role==='admin'?'var(--md-ref-primary-container)':'var(--md-ref-surface-variant)'}">${u.role==='admin'?'管理员':'用户'}</span></td>
      <td class="text-muted" style="font-size:13px">${u.created_at}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-text btn-sm" onclick="openResetPw(${u.id},'${escapeHtml(u.username)}')">改密</button>
        <button class="btn btn-text btn-sm" onclick="openRoleChange(${u.id},'${escapeHtml(u.username)}','${u.role}')">改权</button>
        <button class="btn btn-text btn-sm" style="color:var(--md-ref-error)" onclick="confirmDelete('user',${u.id},'${escapeHtml(u.username)}')">删除</button>
      </td></tr>`).join('');
  } catch (e) { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">加载失败</td></tr>'; }
}
async function saveUser() {
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;
  const role = document.getElementById('newRole').value;
  if (!username || !password) { showSnackbar('用户名和密码不能为空'); return; }
  try { await API.registerByAdmin(username, password, role); showSnackbar('用户已创建'); closeDialog('userDialog'); document.getElementById('newUsername').value = ''; document.getElementById('newPassword').value = ''; loadUsers(); } catch (e) { showSnackbar(e.message); }
}
function openUserDialog() { document.getElementById('newUsername').value = ''; document.getElementById('newPassword').value = ''; document.getElementById('newRole').value = 'user'; openDialog('userDialog'); }

// === User Management Actions ===
let targetUserId = null;

function openResetPw(id, username) {
  targetUserId = id;
  document.getElementById('resetPwUser').textContent = '重置用户 ' + username + ' 的密码';
  document.getElementById('resetPwInput').value = '';
  document.getElementById('resetPwConfirm').value = '';
  openDialog('resetPwDialog');
}

async function confirmResetPw() {
  const newPw = document.getElementById('resetPwInput').value;
  const confirm = document.getElementById('resetPwConfirm').value;
  if (!newPw || newPw.length < 6) { showSnackbar('密码至少6位'); return; }
  if (newPw !== confirm) { showSnackbar('两次密码不一致'); return; }
  try {
    await API.resetUserPassword(targetUserId, newPw);
    showSnackbar('密码已重置');
    closeDialog('resetPwDialog');
  } catch (e) { showSnackbar(e.message); }
}

function openRoleChange(id, username, currentRole) {
  targetUserId = id;
  document.getElementById('roleUser').textContent = '修改用户 ' + username + ' 的角色';
  document.getElementById('roleSelect').value = currentRole;
  openDialog('roleDialog');
}

async function confirmRoleChange() {
  const role = document.getElementById('roleSelect').value;
  try {
    await API.setUserRole(targetUserId, role);
    showSnackbar('角色已更新');
    closeDialog('roleDialog');
    loadUsers();
  } catch (e) { showSnackbar(e.message); }
}

// === Confirm Delete ===
let pendingDelete = null;
function confirmDelete(type, id, label) {
  pendingDelete = { type, id };
  document.getElementById('confirmMsg').textContent = '确定要删除 "' + label + '" 吗？';
  document.getElementById('confirmBtn').onclick = executeDelete;
  openDialog('confirmDialog');
}
async function executeDelete() {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  try {
    if (type === 'link') await API.deleteAdminLink(id);
    else if (type === 'forumcat') await API.deleteForumCategory(id);
    else if (type === 'forumpost') await API.deleteForumPost(id);
    else if (type === 'blog') await API.deleteBlogPost(id);
    else if (type === 'user') await API.deleteUser(id);
    showSnackbar('删除成功'); closeDialog('confirmDialog'); pendingDelete = null;
    if (type === 'link') loadLinks();
    else if (type === 'forumcat' || type === 'forumpost') { loadForumCats(); loadForumPosts(); }
    else if (type === 'blog') loadBlogPosts();
    else if (type === 'user') loadUsers();
  } catch (e) { showSnackbar(e.message); }
}

// === Init ===
document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (user) switchTab('panels');
});
