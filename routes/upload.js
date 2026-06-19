const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

const WALLPAPER_DIR = path.join(__dirname, '..', 'public', 'wallpaper');

// Ensure directory exists
if (!fs.existsSync(WALLPAPER_DIR)) fs.mkdirSync(WALLPAPER_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, WALLPAPER_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 6) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('仅支持图片格式: jpg/png/gif/webp'));
  }
});

router.post('/wallpaper', authMiddleware, adminOnly, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  const url = '/wallpaper/' + req.file.filename;
  res.json({ url, filename: req.file.filename, message: '上传成功' });
});

router.get('/wallpapers', authMiddleware, adminOnly, (req, res) => {
  fs.readdir(WALLPAPER_DIR, (err, files) => {
    if (err) return res.json([]);
    const images = files.filter(f => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(f))
      .map(f => ({ filename: f, url: '/wallpaper/' + f }));
    res.json(images);
  });
});

router.delete('/wallpaper/:name', authMiddleware, adminOnly, (req, res) => {
  const filePath = path.join(WALLPAPER_DIR, req.params.name);
  // Security: prevent directory traversal
  if (req.params.name.includes('..') || req.params.name.includes('/')) {
    return res.status(400).json({ error: '非法文件名' });
  }
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ message: '删除成功' });
  } catch { res.status(500).json({ error: '删除失败' }); }
});

module.exports = router;
