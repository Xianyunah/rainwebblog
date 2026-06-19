#!/usr/bin/env node
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const bcrypt = require('bcryptjs');
const http = require('http');

const DB_PATH = path.join(__dirname, 'data.db');
const CONFIG_PATH = path.join(__dirname, '.env.json');
const PKG = require('./package.json');

// Lazy-load db
let _db = null;
async function getDb() {
  if (_db) return _db;
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buffer);
  } else {
    console.error('data.db not found. Run the server first.');
    process.exit(1);
  }
  return _db;
}

function dbRun(sql, params = []) {
  if (!_db) return;
  _db.run(sql, params);
  const r = _db.exec("SELECT last_insert_rowid()");
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  return r && r[0] && r[0].values ? r[0].values[0][0] : 0;
}

function dbGet(sql, params = []) {
  if (!_db) return null;
  const stmt = _db.prepare(sql); stmt.bind(params);
  if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
  stmt.free(); return null;
}

function dbAll(sql, params = []) {
  if (!_db) return [];
  const stmt = _db.prepare(sql); stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free(); return rows;
}

const HELP = `
RainWeb CLI v${PKG.version}
Usage: node cli.js <command> [options]

Commands:
  status                   Show server and system status
  start                    Start the server
  restart                  Restart the server
  stop                     Stop the server
  port [number]            Show or change listen port (default: 3001)
  password [new-pass]      Change admin password (leave empty for prompt)
  captcha                  Interactive captcha rule configuration
  config                   Show all current settings
  upgrade                  Git pull + npm install + restart (one-click upgrade)
  help                     Show this help

Examples:
  node cli.js status
  node cli.js port 8080
  node cli.js password MyNewP@ss123
  node cli.js captcha
  node cli.js upgrade
`;

async function main() {
  const cmd = process.argv[2] || 'help';

  switch (cmd) {
    case 'status': return cmdStatus();
    case 'start': return cmdStart();
    case 'restart': return cmdRestart();
    case 'stop': return cmdStop();
    case 'port': return cmdPort();
    case 'password': return cmdPassword();
    case 'captcha': return cmdCaptcha();
    case 'config': return cmdConfig();
    case 'upgrade': return cmdUpgrade();
    case 'help':
    default:
      console.log(HELP);
  }
}

// === Status ===
async function cmdStatus() {
  console.log(`RainWeb v${PKG.version}`);
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Data DB: ${fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size + ' bytes' : 'NOT FOUND'}`);

  // Check if server is running
  try {
    await httpGet('http://localhost:' + (getConfigPort()));
    console.log('Server: RUNNING');
  } catch {
    console.log('Server: STOPPED');
  }

  // Show admin info
  try {
    const db = await getDb();
    const admin = dbGet("SELECT id, username, email, email_verified FROM users WHERE role = 'admin'");
    if (admin) {
      console.log(`Admin: ${admin.username} (email: ${admin.email || 'not set'}, verified: ${admin.email_verified ? 'yes' : 'no'})`);
    }
  } catch {}
}

// === Port ===
function getConfigPort() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return config.port || 3001;
  } catch { return 3001; }
}

function setConfigPort(port) {
  let config = {};
  try { config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch {}
  config.port = port;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function cmdPort() {
  const arg = process.argv[3];
  if (arg) {
    const port = parseInt(arg);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error('Invalid port number. Use 1-65535.');
      process.exit(1);
    }
    setConfigPort(port);
    console.log(`Port set to ${port}. Restart to apply.`);
  } else {
    console.log(`Current port: ${getConfigPort()}`);
  }
}

// === Password ===
async function cmdPassword() {
  let newPass = process.argv[3];
  if (!newPass) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    newPass = await new Promise(resolve => {
      rl.question('New admin password (min 6 chars): ', resolve);
    });
    rl.close();
  }
  if (!newPass || newPass.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  await getDb();
  const admin = dbGet("SELECT id FROM users WHERE role = 'admin'");
  if (!admin) { console.error('No admin user found.'); process.exit(1); }

  const hash = bcrypt.hashSync(newPass, 10);
  dbRun('UPDATE users SET password = ? WHERE id = ?', [hash, admin.id]);
  console.log('Admin password updated successfully.');
}

// === Captcha ===
async function cmdCaptcha() {
  await getDb();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = (q) => new Promise(resolve => rl.question(q, resolve));

  console.log('=== Captcha Rule Configuration ===\n');
  console.log('Current settings:');
  ['login','register','forum','failed'].forEach(k => {
    const v = dbGet("SELECT value FROM site_settings WHERE key = 'captcha_" + k + "'");
    console.log(`  ${k}: ${v ? v.value : '0'}`);
  });
  const type = dbGet("SELECT value FROM site_settings WHERE key = 'captcha_type'");
  console.log(`  type: ${type ? type.value : 'builtin'}\n`);

  const typeAns = await q('Captcha type (builtin/recaptcha/both) [' + (type ? type.value : 'builtin') + ']: ');
  if (typeAns) dbRun("UPDATE site_settings SET value=? WHERE key='captcha_type'", [typeAns]);

  for (const scope of ['login', 'register', 'forum']) {
    const current = dbGet("SELECT value FROM site_settings WHERE key='captcha_" + scope + "'");
    const ans = await q(`Enable captcha for ${scope}? (y/n) [${current && current.value === '1' ? 'y' : 'n'}]: `);
    dbRun("UPDATE site_settings SET value=? WHERE key='captcha_" + scope + "'", [ans.toLowerCase() === 'y' ? '1' : '0']);
  }

  const failAns = await q('Enable captcha after failed attempts? (y/n): ');
  dbRun("UPDATE site_settings SET value=? WHERE key='captcha_failed'", [failAns.toLowerCase() === 'y' ? '1' : '0']);
  if (failAns.toLowerCase() === 'y') {
    const threshold = await q('Failed attempts threshold (default 5): ');
    if (threshold) dbRun("UPDATE site_settings SET value=? WHERE key='captcha_failed_threshold'", [threshold]);
  }

  rl.close();
  console.log('\nCaptcha rules updated.');
}

// === Config ===
async function cmdConfig() {
  await getDb();
  const rows = dbAll("SELECT key, value FROM site_settings ORDER BY key");
  console.log('=== Site Configuration ===\n');
  const secrets = ['smtp_pass', 'recaptcha_secret_key'];
  rows.forEach(r => {
    let val = r.value;
    if (secrets.includes(r.key) && val) val = '****' + val.slice(-4);
    console.log(`  ${r.key}: ${val || '(empty)'}`);
  });
  console.log(`\n  listen_port: ${getConfigPort()}`);
}

// === Start / Stop / Restart ===
function findPidFile() { return path.join(__dirname, 'server.pid'); }

function isRunning(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function cmdStop() {
  const pidFile = findPidFile();
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
    if (isRunning(pid)) {
      try { process.kill(pid); console.log('Server stopped (PID: ' + pid + ')'); } catch { console.log('Could not stop process.'); }
    } else { console.log('Server not running.'); }
    fs.unlinkSync(pidFile);
  } else {
    // Try to find node process
    console.log('No PID file found. Try: taskkill /F /IM node.exe (Windows) or pkill node (Linux/Mac)');
  }
}

async function cmdStart() {
  const port = getConfigPort();
  const proc = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) },
    detached: true,
  });
  proc.unref();
  fs.writeFileSync(findPidFile(), String(proc.pid));
  console.log(`Server starting on port ${port} (PID: ${proc.pid})`);
}

async function cmdRestart() {
  await cmdStop();
  await new Promise(r => setTimeout(r, 1000));
  await cmdStart();
}

// === Upgrade ===
async function cmdUpgrade() {
  console.log('=== RainWeb Upgrade ===\n');

  // Check if git is available
  try {
    execSync('git --version', { stdio: 'pipe' });
  } catch {
    console.error('Git is not installed or not in PATH.');
    process.exit(1);
  }

  // Check if it's a git repo
  if (!fs.existsSync(path.join(__dirname, '.git'))) {
    console.error('Not a git repository. Clone first:\n  git clone <your-repo-url>\n  cd rainweb');
    process.exit(1);
  }

  console.log('1. Pulling latest code...');
  try {
    execSync('git pull', { cwd: __dirname, stdio: 'inherit' });
  } catch {
    console.error('Git pull failed. Check for conflicts.');
    process.exit(1);
  }

  console.log('\n2. Installing dependencies...');
  try {
    execSync('npm install', { cwd: __dirname, stdio: 'inherit' });
  } catch {
    console.error('npm install failed.');
    process.exit(1);
  }

  console.log('\n3. Restarting server...');
  await cmdRestart();

  console.log('\n=== Upgrade complete! ===');
}

// === Helper ===
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); })
      .on('error', reject);
  });
}

main().catch(console.error);
