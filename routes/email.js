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
  const to = req.body.email || req.user.email;
  if (!to) return res.status(400).json({ error: '没有收件人，请在个人中心设置邮箱或在请求中指定 email 参数' });
  try {
    await transporter.sendMail({
      from: `"${db.getSetting('smtp_from_name')}" <${db.getSetting('smtp_from_email')}>`,
      to,
      subject: 'RainWeb 邮件配置测试',
      html: emailTemplate('测试邮件', '<p>如果您收到此邮件，说明 SMTP 配置正确。</p>'),
    });
    res.json({ message: '测试邮件已发送至 ' + to });
  } catch (e) {
    res.status(500).json({ error: '发送失败: ' + e.message });
  }
});

// Re-send verification code
router.post('/send-verify', async (req, res) => {
  const { email, username } = req.body;
  if (!email || !username) return res.status(400).json({ error: '参数不完整' });

  const code = Math.floor(10000000 + Math.random() * 90000000).toString();
  db.run('DELETE FROM pending_users WHERE email = ?', [email]);

  const transporter = getTransporter();
  if (!transporter) return res.status(400).json({ error: 'SMTP 未配置，请联系管理员' });

  try {
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
        <div class="code">${code}</div><p style="color:#79747e;font-size:14px">验证码有效期为 10 分钟。</p></div>
        <div class="footer">${siteName} &middot; 自动发送请勿回复</div>
        </div></body></html>`,
    });
    res.json({ message: '验证码已发送', code }); // code for dev convenience
  } catch (e) {
    res.status(500).json({ error: '邮件发送失败: ' + e.message });
  }
});

// Complete registration with verification code
router.post('/complete-register', async (req, res) => {
  const { code, username, password } = req.body;
  if (!code || !username || !password) return res.status(400).json({ error: '参数不完整' });
  const pending = db.get('SELECT * FROM pending_users WHERE token = ? AND username = ?', [code, username]);
  if (!pending) return res.status(400).json({ error: '验证码错误或已过期' });
  if (!bcrypt.compareSync(password, pending.password)) return res.status(400).json({ error: '密码不匹配' });

  const existing = db.get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) return res.status(400).json({ error: '用户名已存在' });

  db.run('INSERT INTO users (username, password, email, email_verified) VALUES (?, ?, ?, 1)',
    [username, pending.password, pending.email]);
  db.run('DELETE FROM pending_users WHERE token = ?', [code]);
  res.json({ message: '注册成功，请登录' });
});

module.exports = router;
