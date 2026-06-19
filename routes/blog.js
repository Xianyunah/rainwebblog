const express = require('express');
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/posts', (req, res) => {
  const publishedOnly = req.query.all !== '1';
  let sql, params;
  if (publishedOnly) {
    sql = 'SELECT bp.*, u.username as author_name FROM blog_posts bp LEFT JOIN users u ON bp.author_id = u.id WHERE bp.published = 1 ORDER BY bp.created_at DESC';
    params = [];
  } else {
    sql = 'SELECT bp.*, u.username as author_name FROM blog_posts bp LEFT JOIN users u ON bp.author_id = u.id ORDER BY bp.created_at DESC';
    params = [];
  }
  res.json(db.all(sql, params));
});

router.get('/posts/:id', (req, res) => {
  const post = db.get(
    'SELECT bp.*, u.username as author_name FROM blog_posts bp LEFT JOIN users u ON bp.author_id = u.id WHERE bp.id = ?',
    [req.params.id]);
  if (!post) return res.status(404).json({ error: '文章不存在' });
  res.json(post);
});

router.post('/posts', authMiddleware, adminOnly, (req, res) => {
  const { title, content, excerpt, published } = req.body;
  if (!title || !content) return res.status(400).json({ error: '标题和内容不能为空' });
  const id = db.run(
    'INSERT INTO blog_posts (title, content, excerpt, author_id, published) VALUES (?, ?, ?, ?, ?)',
    [title, content, excerpt || '', req.user.id, published !== undefined ? (published ? 1 : 0) : 1]);
  const post = db.get('SELECT * FROM blog_posts WHERE id = ?', [id]);
  res.json(post);
});

router.put('/posts/:id', authMiddleware, adminOnly, (req, res) => {
  const { title, content, excerpt, published } = req.body;
  const existing = db.get('SELECT id FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: '文章不存在' });
  db.run(
    "UPDATE blog_posts SET title=?, content=?, excerpt=?, published=?, updated_at=datetime('now') WHERE id=?",
    [title || '', content || '', excerpt || '', published !== undefined ? (published ? 1 : 0) : 1, req.params.id]);
  const post = db.get('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
  res.json(post);
});

router.delete('/posts/:id', authMiddleware, adminOnly, (req, res) => {
  const existing = db.get('SELECT id FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: '文章不存在' });
  db.run('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
  res.json({ message: '删除成功' });
});

module.exports = router;
