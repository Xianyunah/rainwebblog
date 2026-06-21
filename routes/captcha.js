const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const router = express.Router();

// In-memory captcha store
const captchaStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of captchaStore) {
    if (val.expires < now) captchaStore.delete(key);
  }
}, 300000);

// Harder captcha: longer answer, more noise
function generateAnswer(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let ans = '';
  for (let i = 0; i < len; i++) ans += chars[Math.floor(Math.random() * chars.length)];
  return ans;
}

function generateSvgCaptcha(answer) {
  const w = 280, h = 72;
  const colors = ['#d32f2f','#1976d2','#388e3c','#f57c00','#7b1fa2','#e91e63','#0097a7'];
  let bg = `<rect width="${w}" height="${h}" fill="#f5f5f5" rx="10"/>`;
  // More noise lines
  let lines = '';
  for (let i = 0; i < 12; i++) {
    const x1 = Math.random() * w, y1 = Math.random() * h;
    const x2 = Math.random() * w, y2 = Math.random() * h;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors[i % colors.length]}" stroke-width="${1 + Math.random() * 3}" opacity="0.25"/>`;
  }
  // More dots
  for (let i = 0; i < 80; i++) {
    lines += `<circle cx="${Math.random() * w}" cy="${Math.random() * h}" r="${1 + Math.random() * 3}" fill="${colors[i % colors.length]}" opacity="0.15"/>`;
  }
  // Curved background paths
  for (let i = 0; i < 4; i++) {
    const x1 = Math.random() * w, y1 = Math.random() * h;
    const cx = Math.random() * w, cy = Math.random() * h;
    const x2 = Math.random() * w, y2 = Math.random() * h;
    lines += `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" stroke="${colors[i]}" fill="none" stroke-width="1.5" opacity="0.2"/>`;
  }
  // Letters with more variation
  let letters = '';
  const spacing = w / (answer.length + 1);
  for (let i = 0; i < answer.length; i++) {
    const x = spacing * (i + 0.5) + (Math.random() - 0.5) * 15;
    const y = 40 + (Math.random() - 0.5) * 20;
    const rotation = (Math.random() - 0.5) * 45;
    const fontSize = 28 + Math.random() * 14;
    const color = colors[i % colors.length];
    letters += `<text x="${x}" y="${y}" transform="rotate(${rotation},${x},${y})" font-size="${fontSize}" font-family="Arial,sans-serif" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="middle">${answer[i]}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg}${lines}${letters}</svg>`;
}

// Generate image captcha
router.get('/image', (req, res) => {
  try {
    const answer = generateAnswer(6);
    const token = crypto.randomBytes(16).toString('hex');
    captchaStore.set(token, { answer, expires: Date.now() + 300000 });
    const svg = generateSvgCaptcha(answer);
    res.json({ token, svg, expires_in: 300 });
  } catch (e) {
    console.error('Captcha error:', e.message);
    res.status(500).json({ error: '验证码生成失败' });
  }
});

// Verify image captcha
router.post('/verify', (req, res) => {
  try {
    const { token, answer } = req.body;
    if (!token || !answer) return res.json({ success: false, error: '参数不完整' });
    const entry = captchaStore.get(token);
    if (!entry) return res.json({ success: false, error: '验证码已过期' });
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

// Proof-of-Work challenge
router.get('/pow-challenge', (req, res) => {
  const prefix = crypto.randomBytes(8).toString('hex');
  const difficulty = 3; // leading hex zeros needed
  const token = crypto.randomBytes(8).toString('hex');
  captchaStore.set('pow:' + token, { prefix, difficulty, expires: Date.now() + 120000 });
  res.json({ token, prefix, difficulty });
});

// Verify PoW result
router.post('/pow-verify', (req, res) => {
  try {
    const { token, nonce } = req.body;
    if (!token || !nonce) return res.json({ success: false, error: '参数不完整' });
    const entry = captchaStore.get('pow:' + token);
    if (!entry) return res.json({ success: false, error: '挑战已过期' });
    captchaStore.delete('pow:' + token);
    const hash = crypto.createHash('sha256').update(entry.prefix + nonce).digest('hex');
    if (hash.startsWith('0'.repeat(entry.difficulty))) {
      res.json({ success: true });
    } else {
      res.json({ success: false, error: '验证失败' });
    }
  } catch { res.json({ success: false, error: '验证失败' }); }
});

// Check captcha required
router.post('/required', (req, res) => {
  try {
    const { action } = req.body;
    const captchaType = db.getSetting('captcha_type') || 'none';
    const hasRecaptcha = !!db.getSetting('recaptcha_site_key');
    const hasTurnstile = !!db.getSetting('turnstile_site_key');
    if (captchaType === 'none') return res.json({ required: false, type: 'none' });
    const val = db.getSetting('captcha_' + action);
    const isRequired = val === '1';
    if (captchaType === 'recaptcha' && !hasRecaptcha) return res.json({ required: false, type: 'recaptcha' });
    if (captchaType === 'turnstile' && !hasTurnstile) return res.json({ required: false, type: 'turnstile' });
    res.json({ required: isRequired, type: captchaType });
  } catch (e) {
    console.error('Captcha required error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
