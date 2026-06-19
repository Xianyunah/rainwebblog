const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

router.get('/status', (req, res) => {
  const completed = db.getSetting('setup_complete');
  const adminUser = db.get('SELECT id, username FROM users WHERE role = ?', ['admin']);
  let defaultPassword = true;
  if (adminUser) {
    // Check if password is still the default
    const user = db.get('SELECT password FROM users WHERE id = ?', [adminUser.id]);
    if (user) defaultPassword = bcrypt.compareSync('admin123', user.password);
  }
  res.json({
    setup_complete: completed === '1',
    has_admin: !!adminUser,
    default_password: defaultPassword
  });
});

router.post('/complete', (req, res) => {
  const { password, site_name, primary_color, theme_preset } = req.body;

  // Change admin password
  if (password) {
    const adminUser = db.get('SELECT id FROM users WHERE role = ?', ['admin']);
    if (adminUser) {
      // Verify not default
      if (bcrypt.compareSync('admin123', db.get('SELECT password FROM users WHERE id = ?', [adminUser.id]).password)) {
        const hash = bcrypt.hashSync(password, 10);
        db.run('UPDATE users SET password = ? WHERE id = ?', [hash, adminUser.id]);
      }
    }
  }

  // Save settings
  if (site_name) db.setSetting('site_name', site_name);
  if (primary_color) db.setSetting('primary_color', primary_color);
  if (theme_preset) db.setSetting('theme_preset', theme_preset);

  db.setSetting('setup_complete', '1');

  res.json({ message: '初始化完成', redirect: '/' });
});

module.exports = router;
