const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Verification codes in memory: userId -> { code, expires }
const verifyCodes = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of verifyCodes) if (v.expires < now) verifyCodes.delete(k);
}, 60000);

function sendCodeEmail(email, code, username) {
  return new Promise((resolve, reject) => {
    const host = db.getSetting('smtp_host');
    if (!host) return reject(new Error('SMTP 未配置'));
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host, port: parseInt(db.getSetting('smtp_port')) || 587,
      secure: parseInt(db.getSetting('smtp_port')) === 465,
      auth: { user: db.getSetting('smtp_user'), pass: db.getSetting('smtp_pass') },
      tls: { rejectUnauthorized: false },
    });
    const siteName = db.getSetting('site_name') || 'RainWeb';
    const color = db.getSetting('primary_color') || '#6750a4';
    transporter.sendMail({
      from: `"${db.getSetting('smtp_from_name')}" <${db.getSetting('smtp_from_email')}>`,
      to: email,
      subject: '验证码 - ' + siteName,
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
        <div class="body"><p style="font-size:16px">您好 ${username}，</p><p>您的验证码为：</p>
        <div class="code">${code}</div><p style="color:#79747e;font-size:14px">有效期 10 分钟。</p></div>
        <div class="footer">${siteName} &middot; 自动发送请勿回复</div>
        </div></body></html>`,
    }).then(() => resolve()).catch(reject);
  });
}

router.get('/', authMiddleware, (req, res) => {
  const user = db.get('SELECT id, username, email, email_verified, role, avatar, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(user);
});

// Email is read-only after registration
router.put('/', authMiddleware, (req, res) => {
  const { avatar } = req.body;
  if (avatar !== undefined) db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.user.id]);
  res.json({ message: '已更新' });
});

// Send verification code for password change
router.post('/send-pw-code', authMiddleware, async (req, res) => {
  const user = db.get('SELECT id, username, email FROM users WHERE id = ?', [req.user.id]);
  if (!user || !user.email) return res.status(400).json({ error: '未设置邮箱' });
  const code = Math.floor(10000000 + Math.random() * 90000000).toString();
  verifyCodes.set(req.user.id, { code, expires: Date.now() + 600000 });
  try {
    await sendCodeEmail(user.email, code, user.username);
    res.json({ message: '验证码已发送至 ' + user.email });
  } catch (e) {
    res.status(500).json({ error: '发送失败: ' + e.message });
  }
});

// Change password with verification code
router.put('/password', authMiddleware, (req, res) => {
  const { code, oldPassword, newPassword } = req.body;
  if (!code || !oldPassword || !newPassword) return res.status(400).json({ error: '参数不完整' });
  if (newPassword.length < 6) return res.status(400).json({ error: '密码至少6位' });

  const entry = verifyCodes.get(req.user.id);
  if (!entry || entry.code !== code) return res.status(400).json({ error: '验证码错误或已过期' });
  verifyCodes.delete(req.user.id);

  const user = db.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
  if (!bcrypt.compareSync(oldPassword, user.password)) return res.status(401).json({ error: '原密码错误' });
  db.run('UPDATE users SET password = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), req.user.id]);
  res.json({ message: '密码已修改' });
});

// Resend email verification (8-digit code) for existing user
router.post('/resend-verify', authMiddleware, async (req, res) => {
  const user = db.get('SELECT id, username, email FROM users WHERE id = ?', [req.user.id]);
  if (!user || !user.email) return res.status(400).json({ error: '未设置邮箱' });
  if (user.email_verified) return res.status(400).json({ error: '邮箱已验证' });
  const code = Math.floor(10000000 + Math.random() * 90000000).toString();
  db.run('DELETE FROM pending_users WHERE email = ?', [user.email]);
  db.run('INSERT INTO pending_users (username, password, email, token) VALUES (?, ?, ?, ?)',
    [user.username, '', user.email, code]);
  try {
    await sendCodeEmail(user.email, code, user.username);
    res.json({ message: '验证码已发送' });
  } catch (e) { res.status(500).json({ error: '发送失败: ' + e.message }); }
});

module.exports = router;
