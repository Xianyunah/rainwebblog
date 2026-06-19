const express = require('express');
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const allFlag = req.query.all === '1';
  let rows;
  if (allFlag) {
    rows = db.all('SELECT * FROM announcements ORDER BY created_at DESC');
  } else {
    rows = db.all('SELECT * FROM announcements WHERE active = 1 ORDER BY created_at DESC');
  }
  res.json(rows);
});

router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { title, content, active } = req.body;
  if (!content) return res.status(400).json({ error: '内容不能为空' });
  const id = db.run(
    'INSERT INTO announcements (title, content, active) VALUES (?, ?, ?)',
    [title || '', content, active !== undefined ? (active ? 1 : 0) : 1]
  );
  const ann = db.get('SELECT * FROM announcements WHERE id = ?', [id]);
  res.json(ann);
});

router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { title, content, active } = req.body;
  const existing = db.get('SELECT id FROM announcements WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: '公告不存在' });
  db.run(
    "UPDATE announcements SET title=?, content=?, active=?, updated_at=datetime('now') WHERE id=?",
    [title || '', content || '', active !== undefined ? (active ? 1 : 0) : 1, req.params.id]
  );
  const ann = db.get('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
  res.json(ann);
});

router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const existing = db.get('SELECT id FROM announcements WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: '公告不存在' });
  db.run('DELETE FROM announcements WHERE id = ?', [req.params.id]);
  res.json({ message: '删除成功' });
});

module.exports = router;
