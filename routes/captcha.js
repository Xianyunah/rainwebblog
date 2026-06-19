const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// In-memory captcha store: token -> { answer, expires }
const captchaStore = new Map();

// Clean expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of captchaStore) {
    if (val.expires < now) captchaStore.delete(key);
  }
}, 300000);

function generateAnswer(len = 5) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let ans = '';
  for (let i = 0; i < len; i++) ans += chars[Math.floor(Math.random() * chars.length)];
  return ans;
}

function generateSvgCaptcha(answer) {
  const w = 240, h = 64;
  let lines = '';
  const colors = ['#d32f2f','#1976d2','#388e3c','#f57c00','#7b1fa2'];
  // Background noise lines
  for (let i = 0; i < 6; i++) {
    const x1 = Math.random() * w, y1 = Math.random() * h;
    const x2 = Math.random() * w, y2 = Math.random() * h;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors[i % colors.length]}" stroke-width="${1 + Math.random() * 2}" opacity="0.3"/>`;
  }
  // Dots
  for (let i = 0; i < 40; i++) {
    lines += `<circle cx="${Math.random() * w}" cy="${Math.random() * h}" r="${1 + Math.random() * 2}" fill="${colors[i % colors.length]}" opacity="0.2"/>`;
  }
  // Letters
  let letters = '';
  const spacing = w / (answer.length + 1);
  for (let i = 0; i < answer.length; i++) {
    const x = spacing * (i + 0.5) + (Math.random() - 0.5) * 12;
    const y = 38 + (Math.random() - 0.5) * 16;
    const rotation = (Math.random() - 0.5) * 35;
    const fontSize = 30 + Math.random() * 10;
    const color = colors[i % colors.length];
    letters += `<text x="${x}" y="${y}" transform="rotate(${rotation},${x},${y})" font-size="${fontSize}" font-family="Arial,sans-serif" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="middle">${answer[i]}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#f5f5f5" rx="8"/>
    ${lines}
    ${letters}
  </svg>`;
}

// Generate captcha
router.get('/image', (req, res) => {
  try {
    const answer = generateAnswer(5);
    const token = crypto.randomBytes(16).toString('hex');
    captchaStore.set(token, { answer, expires: Date.now() + 300000 }); // 5 min
    const svg = generateSvgCaptcha(answer);
    res.json({ token, svg, expires_in: 300 });
  } catch (e) {
    console.error('Captcha generation error:', e.message);
    res.status(500).json({ error: '验证码生成失败' });
  }
});

// Verify captcha
router.post('/verify', (req, res) => {
  try {
    const { token, answer } = req.body;
    if (!token || !answer) return res.json({ success: false, error: '参数不完整' });
    const entry = captchaStore.get(token);
    if (!entry) return res.json({ success: false, error: '验证码已过期，请刷新' });
    captchaStore.delete(token);
    if (entry.answer.toLowerCase() === String(answer).toLowerCase().trim()) {
      res.json({ success: true });
    } else {
      res.json({ success: false, error: '验证码错误' });
    }
  } catch (e) {
    console.error('Captcha verify error:', e.message);
    res.json({ success: false, error: '验证失败' });
  }
});

// Check if a captcha is required for a given action
router.post('/required', (req, res) => {
  const db = require('../db');
  const { action } = req.body;
  const captchaType = db.getSetting('captcha_type') || 'none';
  const hasRecaptcha = !!db.getSetting('recaptcha_site_key');

  // If captcha is disabled globally, nothing requires it
  if (captchaType === 'none') {
    return res.json({ required: false, type: 'none', has_recaptcha: false });
  }

  // Check if this specific action requires captcha
  const key = 'captcha_' + action;
  const val = db.getSetting(key);
  const isRequired = val === '1';

  // For reCAPTCHA, only enable if keys are configured
  if (captchaType === 'recaptcha' && !hasRecaptcha) {
    return res.json({ required: false, type: 'recaptcha', has_recaptcha: false, error: 'reCAPTCHA 未配置' });
  }

  res.json({ required: isRequired, type: captchaType, has_recaptcha: hasRecaptcha });
});

module.exports = router;
