const express = require('express');
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const links = db.all('SELECT * FROM links ORDER BY sort_order ASC, id ASC');
  res.json(links);
});

router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { title, url, description, icon, category, sort_order, embed_url, is_internal } = req.body;
  if (!title || !url) return res.status(400).json({ error: '标题和链接不能为空' });
  const id = db.run(
    'INSERT INTO links (title, url, description, icon, category, sort_order, embed_url, is_internal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [title, url, description || '', icon || '', category || '默认', sort_order || 0, embed_url || '', is_internal ? 1 : 0]
  );
  res.json(db.get('SELECT * FROM links WHERE id = ?', [id]));
});

router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { title, url, description, icon, category, sort_order, embed_url, is_internal } = req.body;
  if (!db.get('SELECT id FROM links WHERE id = ?', [req.params.id])) return res.status(404).json({ error: '链接不存在' });
  db.run(
    'UPDATE links SET title=?, url=?, description=?, icon=?, category=?, sort_order=?, embed_url=?, is_internal=? WHERE id=?',
    [title || '', url || '', description || '', icon || '', category || '默认', sort_order || 0, embed_url || '', is_internal ? 1 : 0, req.params.id]
  );
  res.json(db.get('SELECT * FROM links WHERE id = ?', [req.params.id]));
});

router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  if (!db.get('SELECT id FROM links WHERE id = ?', [req.params.id])) return res.status(404).json({ error: '链接不存在' });
  db.run('DELETE FROM links WHERE id = ?', [req.params.id]);
  res.json({ message: '删除成功' });
});

module.exports = router;
