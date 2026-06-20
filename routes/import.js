const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const initSqlJs = require('sql.js');
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

const IMPORT_TABLES = [
  'users', 'announcements', 'forum_categories', 'forum_posts', 'forum_replies',
  'blog_posts', 'blog_comments', 'password_entries', 'admin_links',
  'attachments', 'site_settings', 'user_settings'
];

router.post('/database', authMiddleware, adminOnly, async (req, res) => {
  const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 50 * 1024 * 1024 } }).single('file');
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: '上传失败: ' + err.message });
    if (!req.file) return res.status(400).json({ error: '请选择数据库文件' });

    try {
      const SQL = await initSqlJs();
      const buffer = fs.readFileSync(req.file.path);
      const oldDb = new SQL.Database(buffer);

      const report = { imported: {}, errors: [], total: 0 };

      for (const table of IMPORT_TABLES) {
        try {
          // Check if table exists in old db
          const check = oldDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='" + table + "'");
          if (!check || check.length === 0 || check[0].values.length === 0) {
            report.errors.push(table + ': 表不存在，跳过');
            continue;
          }
          // Get columns from old table
          const colInfo = oldDb.exec('PRAGMA table_info(' + table + ')');
          const columns = colInfo[0].values.map(v => v[1]); // column names
          const rows = oldDb.exec('SELECT * FROM ' + table);
          if (!rows || rows.length === 0 || rows[0].values.length === 0) {
            report.imported[table] = 0;
            continue;
          }
          const colNames = columns.join(',');
          const placeholders = columns.map(() => '?').join(',');
          let count = 0;
          for (const row of rows[0].values) {
            try {
              db.run('INSERT OR IGNORE INTO ' + table + ' (' + colNames + ') VALUES (' + placeholders + ')', row);
              count++;
            } catch (e) {
              report.errors.push(table + ': 行跳过 (' + e.message.substring(0, 50) + ')');
            }
          }
          report.imported[table] = count;
          report.total += count;
        } catch (e) {
          report.errors.push(table + ': ' + e.message.substring(0, 80));
        }
      }

      oldDb.close();
      try { fs.unlinkSync(req.file.path); } catch {}

      res.json({
        message: '导入完成',
        total: report.total,
        details: report.imported,
        errors: report.errors.length > 0 ? report.errors.slice(0, 20) : []
      });
    } catch (e) {
      res.status(500).json({ error: '导入失败: ' + e.message });
    }
  });
});

module.exports = router;
