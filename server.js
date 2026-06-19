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
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

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

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: '服务器内部错误' });
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
