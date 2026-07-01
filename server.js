const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');
const authRoutes = require('./routes/auth');
const adminLinkRoutes = require('./routes/admin-links');
const announcementRoutes = require('./routes/announcements');
const forumRoutes = require('./routes/forum');
const blogRoutes = require('./routes/blog');
const passwordRoutes = require('./routes/passwords');
const settingsRoutes = require('./routes/settings');
const emailRoutes = require('./routes/email');
const profileRoutes = require('./routes/profile');
const captchaRoutes = require('./routes/captcha');
const uploadRoutes = require('./routes/upload');
const setupRoutes = require('./routes/setup');
const proxyRoutes = require('./routes/proxy');
const importRoutes = require('./routes/import');
const { blogSSR, forumSSR, sitemapXml } = require('./ssr');

const app = express();
// Read port from .env.json config file, env var, or default
let configPort = 3001;
try {
  const cfg = JSON.parse(require('fs').readFileSync('./.env.json', 'utf8'));
  if (cfg.port) configPort = parseInt(cfg.port);
} catch {}
const PORT = process.env.PORT || configPort;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 0,
  setHeaders(res, path) {
    if (path.endsWith('.html') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/admin-links', adminLinkRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/passwords', passwordRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/captcha', captchaRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/import', importRoutes);

// Version & Update
const version = require('fs').readFileSync('./VERSION', 'utf8').trim();
app.get('/api/version', (req, res) => res.json({ version }));

app.get('/api/update/check', async (req, res) => {
  const https = require('https');
  const tryFetch = (url) => new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'RainWeb' } }, (r) => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => resolve(b.trim()));
    }).on('error', reject);
  });
  try {
    const remote = await tryFetch('https://raw.githubusercontent.com/Xianyunah/rainwebblog/master/VERSION');
    const local = require('fs').readFileSync('./VERSION', 'utf8').trim();
    res.json({ local, remote, hasUpdate: remote !== local });
  } catch (e) {
    try {
      const remote = await tryFetch('https://api.github.com/repos/Xianyunah/rainwebblog/contents/VERSION');
      const local = require('fs').readFileSync('./VERSION', 'utf8').trim();
      res.json({ local, remote, hasUpdate: remote !== local });
    } catch (e2) {
      res.json({ local: version, remote: null, error: '无法检查更新', hasUpdate: false });
    }
  }
});

app.post('/api/update/run', async (req, res) => {
  const https = require('https');
  const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');
  const tmpDir = path.join(__dirname, '.update-tmp');

  try {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    // Download latest source zip (follow redirects via codeload)
    const zipPath = path.join(tmpDir, 'update.zip');
    await new Promise((resolve, reject) => {
      const f = fs.createWriteStream(zipPath);
      const url = 'https://codeload.github.com/Xianyunah/rainwebblog/zip/refs/heads/master';
      https.get(url, (r) => {
        // Follow up to 5 redirects
        let redirects = 0;
        const follow = (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
            redirects++;
            https.get(new URL(res.headers.location, url), follow).on('error', reject);
            return;
          }
          res.pipe(f); f.on('finish', resolve);
        };
        follow(r);
      }).on('error', reject);
    });

    // Extract
    const extractDir = path.join(tmpDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe', timeout: 30000 });

    // Find inner dir
    const items = fs.readdirSync(extractDir).filter(f => fs.statSync(path.join(extractDir, f)).isDirectory());
    const srcDir = path.join(extractDir, items[0] || '.');

    // Copy files excluding local data
    const exclude = ['data', 'uploads', 'node_modules', '.env.json', 'server.pid', 'releases'];
    const cp = (s, d) => {
      fs.readdirSync(s).forEach(f => {
        if (exclude.includes(f)) return;
        const src = path.join(s, f), dest = path.join(d, f);
        if (fs.statSync(src).isDirectory()) { if (!fs.existsSync(dest)) fs.mkdirSync(dest); cp(src, dest); }
        else fs.copyFileSync(src, dest);
      });
    };
    cp(srcDir, __dirname);
    fs.rmSync(tmpDir, { recursive: true });

    // Run npm install
    execSync('npm install', { cwd: __dirname, stdio: 'pipe', timeout: 60000 });

    res.json({ message: '更新完成，请重启服务生效' });
  } catch (e) {
    res.status(500).json({ error: '更新失败: ' + e.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

// SEO: Server-side rendered pages for search engines
app.get('/blog/:id', blogSSR);
app.get('/forum/:id', forumSSR);
app.get('/forum/manage/:id', (req, res) => {
  if (req.path.startsWith('/forum/manage/')) return res.sendFile(path.join(__dirname, 'public', 'forum-manage.html'));
  forumSSR(req, res);
});
app.get('/sitemap.xml', sitemapXml);
app.get('/robots.txt', (req, res) => {
  const db = require('./db');
  const siteUrl = db.getSetting('site_url') || (req.protocol + '://' + req.get('host'));
  const domain = siteUrl.replace(/\/$/, '');
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Sitemap: ${domain}/sitemap.xml`);
});

// SPA fallback: serve index.html for all non-API, non-static routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send('Index file not found. Please reinstall the application.');
  }
});

// Prevent crash on unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

async function start() {
  try {
    const fs = require('fs');
    ['data', 'uploads', 'uploads/avatars'].forEach(d => {
      const dir = path.join(__dirname, d);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    // Auto-migrate old data.db to new location
    const oldDb = path.join(__dirname, 'data.db');
    const newDb = path.join(__dirname, 'data', 'rainweb.db');
    if (fs.existsSync(oldDb) && !fs.existsSync(newDb)) {
      console.log('Migrating old data.db to data/rainweb.db...');
      fs.copyFileSync(oldDb, newDb);
      fs.renameSync(oldDb, oldDb + '.bak');
      console.log('Migration complete (old file renamed to data.db.bak)');
    }

    await getDb();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`RainWeb running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err.message);
    process.exit(1);
  }
}
start();
