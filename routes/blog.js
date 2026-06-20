const express = require('express');
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/posts', (req, res) => {
  const publishedOnly = req.query.all !== '1';
  let sql = 'SELECT bp.*, u.username as author_name FROM blog_posts bp LEFT JOIN users u ON bp.author_id = u.id';
  if (publishedOnly) sql += ' WHERE bp.published = 1';
  sql += ' ORDER BY bp.created_at DESC';
  res.json(db.all(sql));
});

router.get('/posts/:id', (req, res) => {
  const post = db.get(
    'SELECT bp.*, u.username as author_name FROM blog_posts bp LEFT JOIN users u ON bp.author_id = u.id WHERE bp.id = ?',
    [req.params.id]);
  if (!post) return res.status(404).json({ error: '文章不存在' });
  res.json(post);
});

router.post('/posts', authMiddleware, adminOnly, (req, res) => {
  const { title, content, excerpt, published, use_markdown } = req.body;
  if (!title || !content) return res.status(400).json({ error: '标题和内容不能为空' });
  const id = db.run(
    'INSERT INTO blog_posts (title, content, excerpt, author_id, published, use_markdown) VALUES (?, ?, ?, ?, ?, ?)',
    [title, content, excerpt || '', req.user.id, published !== undefined ? (published ? 1 : 0) : 1, use_markdown !== undefined ? (use_markdown ? 1 : 0) : 1]);
  res.json(db.get('SELECT * FROM blog_posts WHERE id = ?', [id]));
});

router.put('/posts/:id', authMiddleware, adminOnly, (req, res) => {
  const { title, content, excerpt, published, use_markdown } = req.body;
  if (!db.get('SELECT id FROM blog_posts WHERE id = ?', [req.params.id]))
    return res.status(404).json({ error: '文章不存在' });
  db.run(
    "UPDATE blog_posts SET title=?, content=?, excerpt=?, published=?, use_markdown=?, updated_at=datetime('now') WHERE id=?",
    [title || '', content || '', excerpt || '', published !== undefined ? (published ? 1 : 0) : 1, use_markdown !== undefined ? (use_markdown ? 1 : 0) : 1, req.params.id]);
  res.json(db.get('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]));
});

router.delete('/posts/:id', authMiddleware, adminOnly, (req, res) => {
  if (!db.get('SELECT id FROM blog_posts WHERE id = ?', [req.params.id]))
    return res.status(404).json({ error: '文章不存在' });
  db.run('DELETE FROM blog_comments WHERE post_id = ?', [req.params.id]);
  db.run('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
  res.json({ message: '删除成功' });
});

// Comments
router.get('/comments/:postId', (req, res) => {
  if (!db.get('SELECT id FROM blog_posts WHERE id = ?', [req.params.postId]))
    return res.status(404).json({ error: '文章不存在' });
  const comments = db.all(
    'SELECT bc.*, u.username as author_name FROM blog_comments bc LEFT JOIN users u ON bc.author_id = u.id WHERE bc.post_id = ? ORDER BY bc.created_at ASC',
    [req.params.postId]);
  res.json(comments);
});

router.post('/comments/:postId', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: '评论内容不能为空' });
  if (!db.get('SELECT id FROM blog_posts WHERE id = ?', [req.params.postId]))
    return res.status(404).json({ error: '文章不存在' });
  const id = db.run('INSERT INTO blog_comments (post_id, content, author_id) VALUES (?, ?, ?)',
    [req.params.postId, content, req.user.id]);
  const comment = db.get(
    'SELECT bc.*, u.username as author_name FROM blog_comments bc LEFT JOIN users u ON bc.author_id = u.id WHERE bc.id = ?', [id]);
  res.json(comment);
});

router.delete('/comments/:id', authMiddleware, (req, res) => {
  const comment = db.get('SELECT * FROM blog_comments WHERE id = ?', [req.params.id]);
  if (!comment) return res.status(404).json({ error: '评论不存在' });
  if (comment.author_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '无权限' });
  db.run('DELETE FROM blog_comments WHERE id = ?', [req.params.id]);
  res.json({ message: '删除成功' });
});

module.exports = router;
