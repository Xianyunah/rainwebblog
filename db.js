const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'rainweb.db');
const DATA_DIR = path.dirname(DB_PATH);
let db = null;

async function getDb() {
  if (db) return db;
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  initTables();
  seedAdmin();
  seedDefaults();
  seedSampleData();
  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('Save DB failed:', e.message);
  }
}

function initTables() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, email TEXT DEFAULT '', email_verified INTEGER DEFAULT 0,
    role TEXT DEFAULT 'user', avatar TEXT DEFAULT '',
    created_at DATETIME DEFAULT (datetime('now')))`);

  db.run(`CREATE TABLE IF NOT EXISTS pending_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL,
    password TEXT NOT NULL, email TEXT NOT NULL, token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')))`);

  db.run(`CREATE TABLE IF NOT EXISTS admin_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
    url TEXT NOT NULL, embed_url TEXT DEFAULT '', description TEXT DEFAULT '',
    icon TEXT DEFAULT '', category TEXT DEFAULT '默认', sort_order INTEGER DEFAULT 0,
    use_proxy INTEGER DEFAULT 0, version TEXT DEFAULT '',
    created_at DATETIME DEFAULT (datetime('now')))`);
  // Migration: add columns if missing
  try { db.run('ALTER TABLE admin_links ADD COLUMN use_proxy INTEGER DEFAULT 0'); } catch {}
  try { db.run('ALTER TABLE admin_links ADD COLUMN version TEXT DEFAULT ""'); } catch {}

  db.run(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT DEFAULT '',
    content TEXT NOT NULL, active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now')))`);

  db.run(`CREATE TABLE IF NOT EXISTS forum_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '', sort_order INTEGER DEFAULT 0,
    announcement TEXT DEFAULT '', sub_categories TEXT DEFAULT '')`);
  try { db.run('ALTER TABLE forum_categories ADD COLUMN announcement TEXT DEFAULT ""'); } catch {}
  try { db.run('ALTER TABLE forum_categories ADD COLUMN sub_categories TEXT DEFAULT ""'); } catch {}

  db.run(`CREATE TABLE IF NOT EXISTS forum_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL,
    title TEXT NOT NULL, content TEXT NOT NULL, author_id INTEGER NOT NULL,
    use_markdown INTEGER DEFAULT 1, sub_category TEXT DEFAULT '',
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES forum_categories(id),
    FOREIGN KEY (author_id) REFERENCES users(id))`);
  try { db.run('ALTER TABLE forum_posts ADD COLUMN use_markdown INTEGER DEFAULT 1'); } catch {}
  try { db.run('ALTER TABLE forum_posts ADD COLUMN sub_category TEXT DEFAULT ""'); } catch {}
  try { db.run('ALTER TABLE forum_posts ADD COLUMN tags TEXT DEFAULT ""'); } catch {}

  db.run(`CREATE TABLE IF NOT EXISTS blog_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL,
    content TEXT NOT NULL, author_id INTEGER,
    author_name TEXT DEFAULT '', created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES blog_posts(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS forum_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL,
    content TEXT NOT NULL, author_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES forum_posts(id),
    FOREIGN KEY (author_id) REFERENCES users(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
    content TEXT NOT NULL, excerpt TEXT DEFAULT '', author_id INTEGER NOT NULL,
    published INTEGER DEFAULT 1, use_markdown INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (author_id) REFERENCES users(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE NOT NULL,
    pin_hash TEXT DEFAULT '', kdf_salt TEXT DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS password_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    title TEXT NOT NULL, username TEXT DEFAULT '',
    encrypted_password TEXT NOT NULL, url TEXT DEFAULT '', notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL,
    original_name TEXT NOT NULL, size INTEGER NOT NULL,
    mime_type TEXT DEFAULT '', user_id INTEGER NOT NULL,
    ref_type TEXT DEFAULT '', ref_id INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY, value TEXT DEFAULT '')`);

  // Indexes for performance
  db.run('CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published)');
  db.run('CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(category_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON forum_replies(post_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_password_user ON password_entries(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_attachments_ref ON attachments(ref_type, ref_id)');

  // Legacy migrations for old database compatibility
  try { db.run("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''"); } catch {}
  try { db.run('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0'); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''"); } catch {}
  try { db.run('ALTER TABLE blog_posts ADD COLUMN use_markdown INTEGER DEFAULT 1'); } catch {}
}

function seedAdmin() {
  if (!get('SELECT id FROM users WHERE username = ?', ['admin'])) {
    const hash = bcrypt.hashSync('admin123', 10);
    run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hash, 'admin']);
    console.log('Admin: admin / admin123');
  }
}

function seedDefaults() {
  const defaults = {
    site_name: 'RainWeb',
    site_description: '个人云平台',
    site_url: '',
    primary_color: '#6750a4',
    recaptcha_site_key: '',
    recaptcha_secret_key: '',
    turnstile_site_key: '',
    turnstile_secret_key: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_from_email: '',
    smtp_from_name: 'RainWeb',
    theme_wallpaper: '',
    theme_wallpaper_scale: 'cover',
    nav_style: 'default',
    card_style: 'default',
    glass_blur: '20',
    glass_opacity: '0.6',
    captcha_login: '0',
    captcha_register: '0',
    captcha_forum: '0',
    captcha_type: 'builtin',
    site_favicon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌧</text></svg>',
    music_embed_code: '',
    music_embed_position: 'right',
    music_embed_pages: '["homepage"]',
    music_embed_autohide: '0',
    music_embed_idle_timeout: '10',
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (!get('SELECT value FROM site_settings WHERE key = ?', [k])) {
      run('INSERT INTO site_settings (key, value) VALUES (?, ?)', [k, v]);
    }
  }
}

function run(sql, params = []) {
  try {
    db.run(sql, params);
    const r = db.exec("SELECT last_insert_rowid()");
    const rowid = r && r[0] && r[0].values ? r[0].values[0][0] : 0;
    saveDb();
    return rowid;
  } catch (e) {
    console.error('SQL run error:', e.message, 'SQL:', sql.substring(0, 80));
    return 0;
  }
}

function get(sql, params = []) {
  try {
    const stmt = db.prepare(sql); stmt.bind(params);
    if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
    stmt.free(); return null;
  } catch (e) {
    console.error('SQL get error:', e.message, 'SQL:', sql.substring(0, 80));
    return null;
  }
}

function all(sql, params = []) {
  try {
    const stmt = db.prepare(sql); stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free(); return rows;
  } catch (e) {
    console.error('SQL all error:', e.message, 'SQL:', sql.substring(0, 80));
    return [];
  }
}

function getSetting(key) {
  const r = get('SELECT value FROM site_settings WHERE key = ?', [key]);
  return r ? r.value : '';
}

function setSetting(key, value) {
  const existing = get('SELECT key FROM site_settings WHERE key = ?', [key]);
  if (existing) run('UPDATE site_settings SET value = ? WHERE key = ?', [value, key]);
  else run('INSERT INTO site_settings (key, value) VALUES (?, ?)', [key, value]);
}

function seedSampleData() {
  const existing = get("SELECT COUNT(*) as c FROM forum_categories");
  if (existing && existing.c > 0) return;

  // Forum categories
  run('INSERT INTO forum_categories (name, description, sort_order) VALUES (?, ?, ?)', ['技术讨论', '技术相关话题交流', 1]);
  run('INSERT INTO forum_categories (name, description, sort_order) VALUES (?, ?, ?)', ['闲聊灌水', '自由讨论区域', 2]);
  run('INSERT INTO forum_categories (name, description, sort_order) VALUES (?, ?, ?)', ['问题求助', '寻求帮助和解答', 3]);

  const adminUser = get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (adminUser) {
    const aid = adminUser.id;
    // Forum posts
    run('INSERT INTO forum_posts (category_id, title, content, author_id, sub_category) VALUES (?, ?, ?, ?, ?)', [1, '欢迎来到论坛', '这是论坛的第一篇帖子！欢迎大家交流讨论。', aid, '分享']);
    run('INSERT INTO forum_posts (category_id, title, content, author_id, sub_category) VALUES (?, ?, ?, ?, ?)', [2, '今天天气真不错', '大家今天过得怎么样？来聊聊吧！', aid, '讨论']);

    // Blog posts
    const blogMarkdown = `## 欢迎使用 RainWeb\n\nRainWeb 是一个多功能的个人云平台，集成了 **博客、论坛、密码管理器** 等功能。\n\n- 🎨 Material Design 3 风格\n- 🌓 深色/浅色主题切换\n- 📧 邮箱验证注册\n- 🔒 密码管理器 (AES-256-GCM 加密)\n\n### 快速开始\n\n1. 点击右上角「登录」使用默认账号 \`admin / admin123\`\n2. 在管理后台配置 SMTP 邮件和 reCAPTCHA\n3. 在「面板链接」中添加你的各个管理后台\n4. 发布你的第一篇博客文章！`;

    run('INSERT INTO blog_posts (title, content, excerpt, author_id, use_markdown) VALUES (?, ?, ?, ?, ?)',
      ['欢迎使用 RainWeb', blogMarkdown, 'RainWeb 功能简介与快速开始', aid, 1]);

    const md2 = `## 自定义主题\n\n你可以在管理后台的「站点设置」中自定义：\n\n- **网站名称** - 显示在导航栏\n- **主题色** - 整个站点的主题颜色\n- **reCAPTCHA V2** - 注册验证\n- **SMTP 邮件** - 发送验证邮件`;
    run('INSERT INTO blog_posts (title, content, excerpt, author_id, use_markdown) VALUES (?, ?, ?, ?, ?)',
      ['自定义主题与配置', md2, '站点设置与个性化配置说明', aid, 1]);

    // Admin panel links
    run('INSERT INTO admin_links (title, url, embed_url, description, icon, category, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['RainWeb 管理后台', '/admin.html', '', '系统管理配置', 'settings', '系统管理', 1]);
    run('INSERT INTO admin_links (title, url, embed_url, description, icon, category, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['示例面板', 'https://example.com', 'https://example.com', '外部面板示例（可替换）', 'dashboard', '外部面板', 2]);
  }
}

module.exports = { getDb, run, get, all, getSetting, setSetting };
