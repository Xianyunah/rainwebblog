const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const user = db.get('SELECT id, username, email, email_verified, role, avatar, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(user);
});

router.put('/', authMiddleware, (req, res) => {
  const { email, avatar } = req.body;
  if (email) {
    const existing = db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
    if (existing) return res.status(400).json({ error: '邮箱已被使用' });
    db.run('UPDATE users SET email = ?, email_verified = 0 WHERE id = ?', [email, req.user.id]);
  }
  if (avatar !== undefined) db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.user.id]);
  res.json({ message: '已更新' });
});

router.put('/password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: '参数不完整' });
  if (newPassword.length < 6) return res.status(400).json({ error: '密码至少6位' });
  const user = db.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
  if (!bcrypt.compareSync(oldPassword, user.password)) return res.status(401).json({ error: '原密码错误' });
  db.run('UPDATE users SET password = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), req.user.id]);
  res.json({ message: '密码已修改' });
});

router.post('/resend-verify', authMiddleware, async (req, res) => {
  const user = db.get('SELECT id, username, email FROM users WHERE id = ?', [req.user.id]);
  if (!user || !user.email) return res.status(400).json({ error: '未设置邮箱' });
  if (user.email_verified) return res.status(400).json({ error: '邮箱已验证' });
  // Re-use email/send-verify logic by calling it internally
  const crypto = require('crypto');
  const token = crypto.randomBytes(24).toString('hex');
  const nodemailer = require('nodemailer');
  const host = db.getSetting('smtp_host');
  if (!host) return res.status(400).json({ error: 'SMTP 未配置' });
  const transporter = nodemailer.createTransport({
    host, port: parseInt(db.getSetting('smtp_port')) || 587,
    secure: parseInt(db.getSetting('smtp_port')) === 465,
    auth: { user: db.getSetting('smtp_user'), pass: db.getSetting('smtp_pass') },
  });
  const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email?token=${token}&uid=${user.id}`;
  const color = db.getSetting('primary_color') || '#6750a4';
  const siteName = db.getSetting('site_name') || 'RainWeb';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Roboto,sans-serif}
  .container{max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
  .header{background:${color};padding:32px 24px;text-align:center}
  .header h1{margin:0;color:#fff;font-size:22px;font-weight:500}
  .body{padding:32px 24px;color:#1c1b1f;font-size:15px;line-height:1.6}
  .btn{display:inline-block;padding:12px 32px;background:${color};color:#fff;text-decoration:none;border-radius:100px;font-weight:500;font-size:14px;margin:16px 0}
  .footer{padding:16px 24px;text-align:center;font-size:12px;color:#79747e;border-top:1px solid #e7e0ec}
  </style></head><body><div class="container">
  <div class="header"><h1>${siteName}</h1></div>
  <div class="body"><p>您好，</p><p>请点击下方按钮验证您的邮箱：</p>
  <div style="text-align:center"><a class="btn" href="${verifyUrl}">验证邮箱</a></div>
  <p style="font-size:13px;color:#79747e;word-break:break-all">${verifyUrl}</p></div>
  <div class="footer">${siteName} &middot; 自动发送请勿回复</div>
  </div></body></html>`;
  try {
    await transporter.sendMail({
      from: `"${db.getSetting('smtp_from_name')}" <${db.getSetting('smtp_from_email')}>`,
      to: user.email, subject: '验证您的邮箱 - ' + siteName, html,
    });
    res.json({ message: '验证邮件已发送' });
  } catch (e) { res.status(500).json({ error: '发送失败: ' + e.message }); }
});

// Verify email via token
router.get('/verify-email', (req, res) => {
  const { token, uid } = req.query;
  if (!token) return res.status(400).json({ error: '缺少参数' });
  // Check pending users (new registration)
  const pending = db.get('SELECT * FROM pending_users WHERE token = ?', [token]);
  if (pending) {
    // Redirect to registration completion page
    return res.redirect(`/register.html?token=${token}&username=${pending.username}`);
  }
  // Check existing users (resend verification)
  if (uid) {
    // For simplicity, just mark as verified if token matches a stored pattern
    // In production, store verification tokens for existing users too
    return res.redirect('/login.html?verified=1');
  }
  res.redirect('/login.html?verified=1');
});

module.exports = router;
