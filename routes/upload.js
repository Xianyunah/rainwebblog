const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const AVATAR_DIR = path.join(UPLOAD_DIR, 'avatars');
[UPLOAD_DIR, AVATAR_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Temporary storage, then rename to SHA-256 hash
function shaFileUpload(subdir, maxSize) {
  const targetDir = subdir === 'avatar' ? AVATAR_DIR : UPLOAD_DIR;
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, targetDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '';
        const tmpName = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
        cb(null, tmpName);
      }
    }),
    limits: { fileSize: maxSize },
  }).single('file');
}

// After multer saves the file, rename it to its SHA-256 hash (dedup)
function hashify(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const buf = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const newPath = path.join(dir, hash + ext);
  if (fs.existsSync(newPath)) {
    fs.unlinkSync(filePath); // remove duplicate
  } else {
    fs.renameSync(filePath, newPath);
  }
  return hash + ext;
}

// Avatar upload
router.post('/avatar', authMiddleware, (req, res) => {
  const upload = shaFileUpload('avatar', 2 * 1024 * 1024);
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ error: '上传失败: ' + (err.message || '文件过大') });
    if (!req.file) return res.status(400).json({ error: '请选择文件' });
    const filename = hashify(req.file.path);
    const url = '/uploads/avatars/' + filename;
    db.run('UPDATE users SET avatar = ? WHERE id = ?', [url, req.user.id]);
    res.json({ url, message: '头像已更新' });
  });
});

// Wallpaper upload
router.post('/wallpaper', authMiddleware, (req, res) => {
  const upload = shaFileUpload('wallpaper', 10 * 1024 * 1024);
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ error: '上传失败: ' + err.message });
    if (!req.file) return res.status(400).json({ error: '请选择文件' });
    const filename = hashify(req.file.path);
    res.json({ url: '/uploads/' + filename, filename, message: '上传成功' });
  });
});

// General file upload
router.post('/file', authMiddleware, (req, res) => {
  const user = db.get('SELECT role FROM users WHERE id = ?', [req.user.id]);
  const isAdmin = user && user.role === 'admin';
  const maxSize = isAdmin ? 100 * 1024 * 1024 : 3 * 1024 * 1024;
  const upload = shaFileUpload('file', maxSize);
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: isAdmin ? '文件过大' : '文件超过 3MB 限制' });
      return res.status(400).json({ error: '上传失败: ' + err.message });
    }
    if (!req.file) return res.status(400).json({ error: '请选择文件' });
    const filename = hashify(req.file.path);
    const { ref_type, ref_id } = req.body;
    const id = db.run(
      'INSERT INTO attachments (filename, original_name, size, mime_type, user_id, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [filename, req.file.originalname, req.file.size, req.file.mimetype, req.user.id, ref_type || '', ref_id || 0]);
    const isImage = req.file.mimetype && req.file.mimetype.startsWith('image/');
    const tag = isImage ? '[image:' + filename + ']' : '[file:' + filename + ']';
    res.json({ id, url: '/uploads/' + filename, original_name: req.file.originalname, size: req.file.size, tag, message: '上传成功' });
  });
});

// Avatar by UID endpoint
router.get('/avatar-url', (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.json({ url: '' });
  const user = db.get('SELECT id, email, avatar FROM users WHERE id = ?', [uid]);
  if (!user) return res.json({ url: '' });
  // QQ auto-avatar
  const qqMatch = user.email && user.email.match(/^(\d+)@qq\.com$/i);
  const url = user.avatar
    ? user.avatar
    : (qqMatch ? 'https://q1.qlogo.cn/g?b=qq&nk=' + qqMatch[1] + '&s=100' : '');
  res.json({ url });
});

router.get('/list', authMiddleware, (req, res) => {
  const { ref_type, ref_id } = req.query;
  let rows;
  if (ref_type && ref_id) {
    rows = db.all('SELECT * FROM attachments WHERE ref_type = ? AND ref_id = ? ORDER BY created_at DESC', [ref_type, ref_id]);
  } else {
    rows = db.all('SELECT * FROM attachments ORDER BY created_at DESC LIMIT 50');
  }
  res.json(rows);
});

router.delete('/:id', authMiddleware, (req, res) => {
  const att = db.get('SELECT * FROM attachments WHERE id = ?', [req.params.id]);
  if (!att) return res.status(404).json({ error: '文件不存在' });
  if (att.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: '无权限' });
  const filePath = path.join(UPLOAD_DIR, att.filename);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
  db.run('DELETE FROM attachments WHERE id = ?', [req.params.id]);
  res.json({ message: '删除成功' });
});

// Download with auth
router.get('/download/:filename', (req, res) => {
  const fn = req.params.filename;
  if (fn.includes('..') || fn.includes('/')) return res.status(400).json({ error: '非法文件名' });
  let userId = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try { const jwt = require('jsonwebtoken'); const { SECRET } = require('../middleware/auth'); const p = jwt.verify(auth.slice(7), SECRET); userId = p.id; } catch {}
  }
  if (!userId && req.query.token) {
    try { const jwt = require('jsonwebtoken'); const { SECRET } = require('../middleware/auth'); const p = jwt.verify(req.query.token, SECRET); userId = p.id; } catch {}
  }
  if (!userId) return res.status(401).json({ error: '请先登录' });
  const fp = path.join(UPLOAD_DIR, fn);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: '文件不存在' });
  const att = db.get('SELECT original_name FROM attachments WHERE filename = ?', [fn]);
  res.download(fp, att ? att.original_name : fn);
});

module.exports = router;
