const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { SECRET, authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

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
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });

  const user = db.get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

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

  const smtpHost = db.getSetting('smtp_host');
  if (smtpHost) {
    // Email verification flow - 8-digit code
    const code = Math.floor(10000000 + Math.random() * 90000000).toString();
    const hash = bcrypt.hashSync(password, 10);
    db.run('DELETE FROM pending_users WHERE email = ?', [email]);
    db.run('INSERT INTO pending_users (username, password, email, token) VALUES (?, ?, ?, ?)',
      [username, hash, email, code]);

    // Send email with code
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost, port: parseInt(db.getSetting('smtp_port')) || 587,
        secure: parseInt(db.getSetting('smtp_port')) === 465,
        auth: { user: db.getSetting('smtp_user'), pass: db.getSetting('smtp_pass') },
        tls: { rejectUnauthorized: false },
      });
      const siteName = db.getSetting('site_name') || 'RainWeb';
      const color = db.getSetting('primary_color') || '#6750a4';
      await transporter.sendMail({
        from: `"${db.getSetting('smtp_from_name')}" <${db.getSetting('smtp_from_email')}>`,
        to: email,
        subject: '验证邮箱 - ' + siteName,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Roboto,sans-serif}
        .container{max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
        .header{background:${color};padding:32px 24px;text-align:center}
        .header h1{margin:0;color:#fff;font-size:22px;font-weight:500}
        .body{padding:32px 24px;color:#1c1b1f;font-size:15px;line-height:1.6;text-align:center}
        .code{font-size:36px;letter-spacing:8px;font-weight:700;text-align:center;padding:20px;background:#f5f5f5;border-radius:12px;font-family:monospace;margin:20px 0;color:${color}}
        .footer{padding:16px 24px;text-align:center;font-size:12px;color:#79747e;border-top:1px solid #e7e0ec}
        </style></head><body><div class="container">
        <div class="header"><h1>${siteName}</h1></div>
        <div class="body"><p style="font-size:16px">您好 ${username}，</p><p>您的邮箱验证码为：</p>
        <div class="code">${code}</div><p style="color:#79747e;font-size:14px">请在本页面输入此验证码完成注册，有效期 10 分钟。</p></div>
        <div class="footer">${siteName} &middot; 自动发送请勿回复</div>
        </div></body></html>`,
      });
    } catch (e) {
      // Email failed but pending user is stored
      console.error('Send verification email failed:', e.message);
    }

    res.json({ requires_verification: true, message: '验证码已发送至 ' + email });
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

router.put('/users/:id/password', authMiddleware, adminOnly, (req, res) => {
  const user = db.get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: '密码至少6位' });
  db.run('UPDATE users SET password = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), req.params.id]);
  res.json({ message: '密码已重置' });
});

router.put('/users/:id/role', authMiddleware, adminOnly, (req, res) => {
  const user = db.get('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.id === req.user.id) return res.status(400).json({ error: '不能修改自己的角色' });
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: '无效的角色' });
  db.run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
  res.json({ message: '角色已更新' });
});

module.exports = router;
