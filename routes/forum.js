const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/categories', (req, res) => {
  res.json(db.all('SELECT * FROM forum_categories ORDER BY sort_order ASC'));
});

router.post('/categories', authMiddleware, (req, res) => {
  const { name, description, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: '名称不能为空' });
  const existing = db.get('SELECT id FROM forum_categories WHERE name = ?', [name]);
  if (existing) return res.status(400).json({ error: '分类已存在' });
  const id = db.run('INSERT INTO forum_categories (name, description, sort_order) VALUES (?, ?, ?)',
    [name, description || '', sort_order || 0]);
  res.json(db.get('SELECT * FROM forum_categories WHERE id = ?', [id]));
});

router.put('/categories/:id', authMiddleware, (req, res) => {
  const { name, description, sort_order } = req.body;
  const existing = db.get('SELECT id FROM forum_categories WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: '分类不存在' });
  db.run('UPDATE forum_categories SET name=?, description=?, sort_order=? WHERE id=?',
    [name || '', description || '', sort_order || 0, req.params.id]);
  res.json(db.get('SELECT * FROM forum_categories WHERE id = ?', [req.params.id]));
});

router.delete('/categories/:id', authMiddleware, (req, res) => {
  const existing = db.get('SELECT id FROM forum_categories WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: '分类不存在' });
  db.run('DELETE FROM forum_categories WHERE id = ?', [req.params.id]);
  res.json({ message: '删除成功' });
});

router.get('/posts', (req, res) => {
  const { category_id } = req.query;
  let sql, params;
  if (category_id) {
    sql = `SELECT fp.*, u.username as author_name,
      (SELECT COUNT(*) FROM forum_replies WHERE post_id = fp.id) as reply_count
      FROM forum_posts fp LEFT JOIN users u ON fp.author_id = u.id
      WHERE fp.category_id = ? ORDER BY fp.created_at DESC`;
    params = [category_id];
  } else {
    sql = `SELECT fp.*, u.username as author_name,
      (SELECT COUNT(*) FROM forum_replies WHERE post_id = fp.id) as reply_count
      FROM forum_posts fp LEFT JOIN users u ON fp.author_id = u.id
      ORDER BY fp.created_at DESC`;
    params = [];
  }
  res.json(db.all(sql, params));
});

router.get('/posts/:id', (req, res) => {
  const post = db.get(
    `SELECT fp.*, u.username as author_name, fc.name as category_name
     FROM forum_posts fp LEFT JOIN users u ON fp.author_id = u.id
     LEFT JOIN forum_categories fc ON fp.category_id = fc.id
     WHERE fp.id = ?`, [req.params.id]);
  if (!post) return res.status(404).json({ error: '帖子不存在' });
  const replies = db.all(
    `SELECT fr.*, u.username as author_name
     FROM forum_replies fr LEFT JOIN users u ON fr.author_id = u.id
     WHERE fr.post_id = ? ORDER BY fr.created_at ASC`, [req.params.id]);
  res.json({ post, replies });
});

router.post('/posts', authMiddleware, (req, res) => {
  const { category_id, title, content, captcha_token } = req.body;
  if (!title || !content) return res.status(400).json({ error: '标题和内容不能为空' });
  const id = db.run(
    'INSERT INTO forum_posts (category_id, title, content, author_id) VALUES (?, ?, ?, ?)',
    [category_id, title, content, req.user.id]);
  const post = db.get(
    `SELECT fp.*, u.username as author_name
     FROM forum_posts fp LEFT JOIN users u ON fp.author_id = u.id
     WHERE fp.id = ?`, [id]);
  res.json(post);
});

router.post('/posts/:id/replies', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: '回复内容不能为空' });
  const post = db.get('SELECT id FROM forum_posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: '帖子不存在' });
  const id = db.run(
    'INSERT INTO forum_replies (post_id, content, author_id) VALUES (?, ?, ?)',
    [req.params.id, content, req.user.id]);
  const reply = db.get(
    'SELECT fr.*, u.username as author_name FROM forum_replies fr LEFT JOIN users u ON fr.author_id = u.id WHERE fr.id = ?', [id]);
  res.json(reply);
});

router.delete('/posts/:id', authMiddleware, (req, res) => {
  const post = db.get('SELECT * FROM forum_posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: '帖子不存在' });
  if (post.author_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '无权限' });
  db.run('DELETE FROM forum_replies WHERE post_id = ?', [req.params.id]);
  db.run('DELETE FROM forum_posts WHERE id = ?', [req.params.id]);
  res.json({ message: '删除成功' });
});

router.delete('/replies/:id', authMiddleware, (req, res) => {
  const reply = db.get('SELECT * FROM forum_replies WHERE id = ?', [req.params.id]);
  if (!reply) return res.status(404).json({ error: '回复不存在' });
  if (reply.author_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '无权限' });
  db.run('DELETE FROM forum_replies WHERE id = ?', [req.params.id]);
  res.json({ message: '删除成功' });
});

module.exports = router;
