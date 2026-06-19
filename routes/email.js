const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

function getTransporter() {
  const host = db.getSetting('smtp_host');
  if (!host) return null;
  return nodemailer.createTransport({
    host, port: parseInt(db.getSetting('smtp_port')) || 587,
    secure: parseInt(db.getSetting('smtp_port')) === 465,
    auth: { user: db.getSetting('smtp_user'), pass: db.getSetting('smtp_pass') },
  });
}

function emailTemplate(title, body) {
  const siteName = db.getSetting('site_name') || 'RainWeb';
  const color = db.getSetting('primary_color') || '#6750a4';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Roboto,sans-serif}
  .container{max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
  .header{background:${color};padding:32px 24px;text-align:center}
  .header h1{margin:0;color:#fff;font-size:22px;font-weight:500}
  .body{padding:32px 24px;color:#1c1b1f;font-size:15px;line-height:1.6}
  .btn{display:inline-block;padding:12px 32px;background:${color};color:#fff;text-decoration:none;border-radius:100px;font-weight:500;font-size:14px;margin:16px 0}
  .footer{padding:16px 24px;text-align:center;font-size:12px;color:#79747e;border-top:1px solid #e7e0ec}
  .code{font-size:28px;letter-spacing:6px;text-align:center;padding:16px;background:#f5f5f5;border-radius:12px;font-family:monospace;margin:16px 0}
  </style></head><body><div class="container">
  <div class="header"><h1>${siteName}</h1></div>
  <div class="body">${body}</div>
  <div class="footer">${siteName} &middot; 自动发送请勿回复</div>
  </div></body></html>`;
}

router.post('/test', authMiddleware, adminOnly, async (req, res) => {
  const transporter = getTransporter();
  if (!transporter) return res.status(400).json({ error: 'SMTP 未配置' });
  try {
    await transporter.sendMail({
      from: `"${db.getSetting('smtp_from_name')}" <${db.getSetting('smtp_from_email')}>`,
      to: req.body.email || req.user.email,
      subject: 'RainWeb 邮件配置测试',
      html: emailTemplate('测试邮件', '<p>如果您收到此邮件，说明 SMTP 配置正确。</p>'),
    });
    res.json({ message: '测试邮件已发送' });
  } catch (e) {
    res.status(500).json({ error: '发送失败: ' + e.message });
  }
});

// Send verification email (called during registration)
router.post('/send-verify', async (req, res) => {
  const { email, username } = req.body;
  if (!email || !username) return res.status(400).json({ error: '参数不完整' });

  const token = crypto.randomBytes(24).toString('hex');
  const existing = db.get('SELECT id FROM pending_users WHERE email = ?', [email]);
  if (existing) db.run('DELETE FROM pending_users WHERE email = ?', [email]);

  const transporter = getTransporter();
  if (!transporter) return res.status(400).json({ error: 'SMTP 未配置，请联系管理员' });

  try {
    const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email?token=${token}`;
    await transporter.sendMail({
      from: `"${db.getSetting('smtp_from_name')}" <${db.getSetting('smtp_from_email')}>`,
      to: email,
      subject: '验证您的邮箱 - ' + (db.getSetting('site_name') || 'RainWeb'),
      html: emailTemplate('验证邮箱',
        `<p>您好 ${username}，</p>
         <p>请点击下方按钮验证您的邮箱地址：</p>
         <div style="text-align:center"><a class="btn" href="${verifyUrl}">验证邮箱</a></div>
         <p>或复制以下链接到浏览器打开：</p>
         <p style="word-break:break-all;font-size:13px;color:#79747e">${verifyUrl}</p>
         <p>此链接 24 小时内有效。</p>`),
    });
    // Store pending user with the token
    res.json({ token }); // token returned so frontend can complete registration
  } catch (e) {
    res.status(500).json({ error: '邮件发送失败: ' + e.message });
  }
});

// Complete registration with verification token
router.post('/complete-register', async (req, res) => {
  const { token, username, password } = req.body;
  if (!token || !username || !password) return res.status(400).json({ error: '参数不完整' });
  const pending = db.get('SELECT * FROM pending_users WHERE token = ?', [token]);
  if (!pending) return res.status(400).json({ error: '验证链接无效或已过期' });
  if (pending.username !== username) return res.status(400).json({ error: '用户名不匹配' });
  // Also verify the password matches
  if (!bcrypt.compareSync(password, pending.password)) return res.status(400).json({ error: '密码不匹配' });

  const existing = db.get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) return res.status(400).json({ error: '用户名已存在' });

  db.run('INSERT INTO users (username, password, email, email_verified) VALUES (?, ?, ?, 1)',
    [username, pending.password, pending.email]);
  db.run('DELETE FROM pending_users WHERE token = ?', [token]);
  res.json({ message: '注册成功，请登录' });
});

module.exports = router;
