const express = require('express');
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.all('SELECT * FROM admin_links ORDER BY sort_order ASC, id ASC'));
});

router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { title, url, embed_url, description, icon, category, sort_order, use_proxy, version } = req.body;
  if (!title || !url) return res.status(400).json({ error: '标题和链接不能为空' });
  const id = db.run(
    'INSERT INTO admin_links (title, url, embed_url, description, icon, category, sort_order, use_proxy, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title, url, embed_url || '', description || '', icon || '', category || '默认', sort_order || 0, use_proxy ? 1 : 0, version || '']);
  res.json(db.get('SELECT * FROM admin_links WHERE id = ?', [id]));
});

router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  if (!db.get('SELECT id FROM admin_links WHERE id = ?', [req.params.id]))
    return res.status(404).json({ error: '链接不存在' });
  const { title, url, embed_url, description, icon, category, sort_order, use_proxy, version } = req.body;
  db.run('UPDATE admin_links SET title=?, url=?, embed_url=?, description=?, icon=?, category=?, sort_order=?, use_proxy=?, version=? WHERE id=?',
    [title || '', url || '', embed_url || '', description || '', icon || '', category || '默认', sort_order || 0, use_proxy ? 1 : 0, version || '', req.params.id]);
  res.json(db.get('SELECT * FROM admin_links WHERE id = ?', [req.params.id]));
});

router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  if (!db.get('SELECT id FROM admin_links WHERE id = ?', [req.params.id]))
    return res.status(404).json({ error: '链接不存在' });
  db.run('DELETE FROM admin_links WHERE id = ?', [req.params.id]);
  res.json({ message: '删除成功' });
});

module.exports = router;
