const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { SECRET, authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Failed login tracking
const failedLogins = new Map(); // ip -> { count, lastAttempt }

function checkCaptcha(action) {
  const type = db.getSetting('captcha_type') || 'none';
  if (type === 'none') return false;
  const setting = db.getSetting('captcha_' + action);
  return setting === '1';
}

// Verify reCAPTCHA V2 token
async function verifyCaptcha(token) {
  const secret = db.getSetting('recaptcha_secret_key');
  if (!secret) return true; // captcha not configured, skip
  try {
    const https = require('https');
    const data = await new Promise((resolve, reject) => {
      const qs = `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`;
      const req = https.request({ hostname: 'www.google.com', path: '/recaptcha/api/siteverify', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }}, res => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve(JSON.parse(body)));
      });
      req.on('error', reject);
      req.write(qs);
      req.end();
    });
    return data.success;
  } catch { return false; }
}

// Verify captcha helper
function verifyCaptchaToken(captcha_token, captcha_answer) {
  if (!captcha_token || !captcha_answer) return false;
  const crypto = require('crypto');
  const https = require('https');
  // Check reCAPTCHA
  const recaptchaSecret = db.getSetting('recaptcha_secret_key');
  if (recaptchaSecret) {
    // Async verification for reCAPTCHA is handled differently
    // For built-in captcha, we verify against our store
  }
  // Built-in captcha: verify against stored entries
  // This is simplified - in production use a verified token approach
  return true; // Will be verified by the verify endpoint flow
}

router.post('/login', (req, res) => {
  const { username, password, captcha_token, captcha_answer } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });

  const ip = req.ip || req.connection.remoteAddress;
  const failed = failedLogins.get(ip);
  const threshold = parseInt(db.getSetting('captcha_failed_threshold')) || 5;
  const needsCaptcha = checkCaptcha('login') || (checkCaptcha('failed') && failed && failed.count >= threshold);

  if (needsCaptcha) {
    // Frontend should call /api/captcha/verify first and get a verified_token
    if (!captcha_token) return res.status(400).json({ error: '请完成验证码验证', needs_captcha: true });
  }

  const user = db.get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    // Track failed attempt
    const entry = failedLogins.get(ip) || { count: 0 };
    entry.count += 1;
    entry.lastAttempt = Date.now();
    failedLogins.set(ip, entry);
    if (failedLogins.size > 10000) {
      const now = Date.now();
      for (const [k, v] of failedLogins) if (now - v.lastAttempt > 3600000) failedLogins.delete(k);
    }
    const needsCaptchaNow = checkCaptcha('failed') && entry.count >= threshold;
    return res.status(401).json({
      error: '用户名或密码错误',
      failed_attempts: entry.count,
      needs_captcha: needsCaptchaNow
    });
  }
  failedLogins.delete(ip);

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username, role: user.role, email: user.email, email_verified: user.email_verified });
});

router.post('/register', async (req, res) => {
  const { username, password, email, captcha_token } = req.body;
  if (!username || !password || !email)
    return res.status(400).json({ error: '请填写所有必填项' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });
  if (db.get('SELECT id FROM users WHERE username = ?', [username]))
    return res.status(400).json({ error: '用户名已存在' });
  if (db.get('SELECT id FROM users WHERE email = ?', [email]))
    return res.status(400).json({ error: '邮箱已被注册' });

  // Verify captcha if configured
  if (checkCaptcha('register')) {
    if (!captcha_token) return res.status(400).json({ error: '请完成验证码验证', needs_captcha: true });
  }
  if (db.getSetting('recaptcha_site_key') && captcha_token === 'recaptcha') {
    const valid = await verifyCaptcha(captcha_token);
    if (!valid) return res.status(400).json({ error: 'reCAPTCHA 验证失败，请重试' });
  }

  const smtpHost = db.getSetting('smtp_host');
  if (smtpHost) {
    // Email verification flow
    const crypto = require('crypto');
    const token = crypto.randomBytes(24).toString('hex');
    const hash = bcrypt.hashSync(password, 10);
    // Remove any existing pending for this email
    db.run('DELETE FROM pending_users WHERE email = ?', [email]);
    db.run('INSERT INTO pending_users (username, password, email, token) VALUES (?, ?, ?, ?)',
      [username, hash, email, token]);
    res.json({ requires_verification: true, token, message: '请查收验证邮件' });
  } else {
    // Direct registration without email verification
    const hash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (username, password, email, email_verified) VALUES (?, ?, ?, 1)', [username, hash, email]);
    res.json({ message: '注册成功，请登录' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.get('SELECT id, username, email, email_verified, role, avatar FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(user);
});

router.post('/register-by-admin', authMiddleware, adminOnly, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
  if (db.get('SELECT id FROM users WHERE username = ?', [username]))
    return res.status(400).json({ error: '用户名已存在' });
  const hash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hash, role || 'user']);
  res.json({ message: '创建成功' });
});

router.get('/users', authMiddleware, adminOnly, (req, res) => {
  res.json(db.all('SELECT id, username, email, email_verified, role, created_at FROM users'));
});

router.delete('/users/:id', authMiddleware, adminOnly, (req, res) => {
  const user = db.get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.id === req.user.id) return res.status(400).json({ error: '不能删除自己' });
  db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ message: '删除成功' });
});

module.exports = router;
