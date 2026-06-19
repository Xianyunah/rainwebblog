const API = {
  base: '/api',

  async request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const token = localStorage.getItem('token');
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  },

  // Auth
  login(username, password, captcha_token) { const d = { username, password }; if (captcha_token) d.captcha_token = captcha_token; return this.request('POST', '/auth/login', d); },
  register(username, password, email, captcha_token) { return this.request('POST', '/auth/register', { username, password, email, captcha_token }); },
  getMe() { return this.request('GET', '/auth/me'); },
  registerByAdmin(username, password, role) { return this.request('POST', '/auth/register-by-admin', { username, password, role }); },
  getUsers() { return this.request('GET', '/auth/users'); },
  deleteUser(id) { return this.request('DELETE', '/auth/users/' + id); },

  // Settings
  getSettings() { return this.request('GET', '/settings'); },
  saveSettings(data) { return this.request('PUT', '/settings', data); },

  // Admin Links
  getAdminLinks() { return this.request('GET', '/admin-links'); },
  createAdminLink(data) { return this.request('POST', '/admin-links', data); },
  updateAdminLink(id, data) { return this.request('PUT', '/admin-links/' + id, data); },
  deleteAdminLink(id) { return this.request('DELETE', '/admin-links/' + id); },

  // Forum
  getForumCategories() { return this.request('GET', '/forum/categories'); },
  createForumCategory(data) { return this.request('POST', '/forum/categories', data); },
  updateForumCategory(id, data) { return this.request('PUT', '/forum/categories/' + id, data); },
  deleteForumCategory(id) { return this.request('DELETE', '/forum/categories/' + id); },
  getForumPosts(catId) { return this.request('GET', '/forum/posts' + (catId ? '?category_id=' + catId : '')); },
  getForumPost(id) { return this.request('GET', '/forum/posts/' + id); },
  createForumPost(data) { return this.request('POST', '/forum/posts', data); },
  createForumReply(postId, content) { return this.request('POST', '/forum/posts/' + postId + '/replies', { content }); },
  deleteForumPost(id) { return this.request('DELETE', '/forum/posts/' + id); },
  deleteForumReply(id) { return this.request('DELETE', '/forum/replies/' + id); },

  // Blog
  getBlogPosts(all) { return this.request('GET', '/blog/posts' + (all ? '?all=1' : '')); },
  getBlogPost(id) { return this.request('GET', '/blog/posts/' + id); },
  createBlogPost(data) { return this.request('POST', '/blog/posts', data); },
  updateBlogPost(id, data) { return this.request('PUT', '/blog/posts/' + id, data); },
  deleteBlogPost(id) { return this.request('DELETE', '/blog/posts/' + id); },

  // Passwords
  getPinStatus() { return this.request('GET', '/passwords/pin-status'); },
  setPin(pin) { return this.request('POST', '/passwords/set-pin', { pin }); },
  unlock(pin) { return this.request('POST', '/passwords/unlock', { pin }); },
  lock() { return this.request('POST', '/passwords/lock'); },
  getPasswords() { return this.request('GET', '/passwords'); },
  createPassword(data) { return this.request('POST', '/passwords', data); },
  updatePassword(id, data) { return this.request('PUT', '/passwords/' + id, data); },
  deletePassword(id) { return this.request('DELETE', '/passwords/' + id); },

  // Email / SMTP
  testSmtp(email) { return this.request('POST', '/email/test', { email }); },
  sendVerify(email, username) { return this.request('POST', '/email/send-verify', { email, username }); },
  completeRegister(token, username, password) { return this.request('POST', '/email/complete-register', { token, username, password }); },
};

function showSnackbar(msg) {
  const el = document.getElementById('snackbar');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hide');
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.classList.remove('show', 'hide'), 300);
  }, 2500);
}
