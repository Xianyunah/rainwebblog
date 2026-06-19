const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// In-memory session store for unlocked encryption keys
const unlockedSessions = new Map();

function getEncryptionKey(userId, pin) {
  const setting = db.get('SELECT kdf_salt FROM user_settings WHERE user_id = ?', [userId]);
  if (!setting || !setting.kdf_salt) return null;
  const salt = Buffer.from(setting.kdf_salt, 'hex');
  return crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256');
}

function encrypt(text, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + tag + ':' + encrypted;
}

function decrypt(encoded, key) {
  try {
    const parts = encoded.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch { return null; }
}

// Set or change PIN
router.post('/set-pin', authMiddleware, (req, res) => {
  const { pin } = req.body;
  if (!pin || pin.length < 4) return res.status(400).json({ error: 'PIN 至少4位' });
  const existing = db.get('SELECT id FROM user_settings WHERE user_id = ?', [req.user.id]);
  const pinHash = bcrypt.hashSync(pin, 10);
  const kdfSalt = crypto.randomBytes(16).toString('hex');
  if (existing) {
    db.run('UPDATE user_settings SET pin_hash=?, kdf_salt=? WHERE user_id=?', [pinHash, kdfSalt, req.user.id]);
  } else {
    db.run('INSERT INTO user_settings (user_id, pin_hash, kdf_salt) VALUES (?, ?, ?)', [req.user.id, pinHash, kdfSalt]);
  }
  // Auto-unlock after setting PIN
  const key = getEncryptionKey(req.user.id, pin);
  if (key) unlockedSessions.set(req.user.id, { key, time: Date.now() });
  res.json({ message: 'PIN 设置成功' });
});

// Check if PIN is set
router.get('/pin-status', authMiddleware, (req, res) => {
  const setting = db.get('SELECT pin_hash FROM user_settings WHERE user_id = ?', [req.user.id]);
  res.json({ hasPin: !!setting && !!setting.pin_hash, unlocked: unlockedSessions.has(req.user.id) });
});

// Unlock with PIN
router.post('/unlock', authMiddleware, (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: '请输入 PIN' });
  const setting = db.get('SELECT pin_hash FROM user_settings WHERE user_id = ?', [req.user.id]);
  if (!setting || !setting.pin_hash) return res.status(400).json({ error: '请先设置 PIN' });
  if (!bcrypt.compareSync(pin, setting.pin_hash)) return res.status(401).json({ error: 'PIN 错误' });
  const key = getEncryptionKey(req.user.id, pin);
  if (!key) return res.status(500).json({ error: '解密失败' });
  unlockedSessions.set(req.user.id, { key, time: Date.now() });
  // Auto-lock after 1 hour
  setTimeout(() => { unlockedSessions.delete(req.user.id); }, 3600000);
  res.json({ message: '已解锁' });
});

// Lock
router.post('/lock', authMiddleware, (req, res) => {
  unlockedSessions.delete(req.user.id);
  res.json({ message: '已锁定' });
});

// Ensure unlocked middleware
function requireUnlock(req, res, next) {
  if (!unlockedSessions.has(req.user.id)) {
    return res.status(401).json({ error: '请先解锁密码管理器' });
  }
  next();
}

// List all password entries (decrypted)
router.get('/', authMiddleware, requireUnlock, (req, res) => {
  const entries = db.all('SELECT * FROM password_entries WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  const session = unlockedSessions.get(req.user.id);
  const decrypted = entries.map(e => {
    const pwd = decrypt(e.encrypted_password, session.key);
    return { id: e.id, title: e.title, username: e.username, password: pwd || '', url: e.url, notes: e.notes, created_at: e.created_at };
  });
  res.json(decrypted);
});

// Create
router.post('/', authMiddleware, requireUnlock, (req, res) => {
  const { title, username, password, url, notes } = req.body;
  if (!title || !password) return res.status(400).json({ error: '标题和密码不能为空' });
  const session = unlockedSessions.get(req.user.id);
  const encrypted = encrypt(password, session.key);
  const id = db.run(
    'INSERT INTO password_entries (user_id, title, username, encrypted_password, url, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, title, username || '', encrypted, url || '', notes || '']);
  res.json({ id, title, username, password, url, notes, message: '保存成功' });
});

// Update
router.put('/:id', authMiddleware, requireUnlock, (req, res) => {
  const { title, username, password, url, notes } = req.body;
  const existing = db.get('SELECT id FROM password_entries WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ error: '记录不存在' });
  const session = unlockedSessions.get(req.user.id);
  const encrypted = encrypt(password || '', session.key);
  db.run(
    "UPDATE password_entries SET title=?, username=?, encrypted_password=?, url=?, notes=?, updated_at=datetime('now') WHERE id=?",
    [title || '', username || '', encrypted, url || '', notes || '', req.params.id]);
  res.json({ message: '更新成功' });
});

// Delete
router.delete('/:id', authMiddleware, requireUnlock, (req, res) => {
  const existing = db.get('SELECT id FROM password_entries WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ error: '记录不存在' });
  db.run('DELETE FROM password_entries WHERE id = ?', [req.params.id]);
  res.json({ message: '删除成功' });
});

module.exports = router;
