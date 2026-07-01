const express = require('express');
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

const PUBLIC_KEYS = ['site_name','site_description','site_url','primary_color',
  'recaptcha_site_key','turnstile_site_key',
  'theme_wallpaper','theme_wallpaper_scale','nav_style','card_style',
  'glass_blur','glass_opacity','theme_force_dark',
  'captcha_type','captcha_login','captcha_register','captcha_forum',
  'homepage_avatar','homepage_bio','homepage_content','blog_show_sidebar'];

const ALL_KEYS = ['site_name','site_description','site_url','primary_color','recaptcha_site_key','turnstile_site_key',
  'smtp_host','smtp_port','smtp_user','smtp_from_email','smtp_from_name',
  'theme_wallpaper','theme_wallpaper_scale','nav_style','card_style','glass_blur','glass_opacity','theme_force_dark',
  'captcha_type','captcha_login','captcha_register','captcha_forum',
  'homepage_avatar','homepage_bio','homepage_content','blog_show_sidebar'];

const ALLOWED_SET = [...ALL_KEYS, 'recaptcha_secret_key', 'smtp_pass', 'turnstile_secret_key'];

router.get('/public', (req, res) => {
  const settings = {};
  PUBLIC_KEYS.forEach(k => settings[k] = db.getSetting(k));
  res.json(settings);
});

router.get('/', authMiddleware, adminOnly, (req, res) => {
  const settings = {};
  ALL_KEYS.forEach(k => settings[k] = db.getSetting(k));
  res.json(settings);
});

router.put('/', authMiddleware, adminOnly, (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    if (ALLOWED_SET.includes(key)) db.setSetting(key, String(value));
  }
  res.json({ message: '设置已保存' });
});

module.exports = router;
