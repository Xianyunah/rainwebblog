let isUnlocked = false;
let currentDetailId = null;

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function closeDialog(id) {
  document.getElementById(id).classList.remove('active');
}
function openDialog(id) {
  document.getElementById(id).classList.add('active');
}

// === PIN Screen ===
async function initPinScreen() {
  const token = localStorage.getItem('token');
  if (!token) { showSnackbar('请先登录'); setTimeout(() => window.location.href = '/login.html', 1000); return; }
  try {
    const me = await API.getMe();
    if (me.role !== 'admin') { showSnackbar('需要管理员权限'); setTimeout(() => window.location.href = '/', 1000); return; }
    const status = await API.getPinStatus();
    if (!status.hasPin) {
      document.getElementById('pinTitle').textContent = '首次使用，请设置 PIN 码';
      document.getElementById('pinActionBtn').textContent = '设置';
      document.getElementById('pinActionBtn').onclick = showPinSetup;
    } else if (status.unlocked) {
      isUnlocked = true;
      showVault();
    } else {
      showUnlockScreen();
    }
  } catch (e) {
    showSnackbar(e.message);
  }
}

function showPinSetup() {
  document.getElementById('newPin').value = '';
  document.getElementById('confirmPin').value = '';
  openDialog('pinSetupDialog');
}

async function savePin() {
  const pin = document.getElementById('newPin').value;
  const confirm = document.getElementById('confirmPin').value;
  if (!pin || pin.length < 4) { showSnackbar('PIN 码至少4位'); return; }
  if (pin !== confirm) { showSnackbar('两次输入的 PIN 不一致'); return; }
  try {
    await API.setPin(pin);
    showSnackbar('PIN 设置成功');
    closeDialog('pinSetupDialog');
    isUnlocked = true;
    showVault();
  } catch (e) { showSnackbar(e.message); }
}

async function submitPin() {
  const pin = document.getElementById('pinInput').value;
  if (!pin) { showSnackbar('请输入 PIN 码'); return; }
  try {
    await API.unlock(pin);
    showSnackbar('已解锁');
    isUnlocked = true;
    showVault();
  } catch (e) {
    document.getElementById('pinError').textContent = e.message;
    document.getElementById('pinError').style.display = 'block';
    document.getElementById('pinInput').value = '';
  }
}

function showUnlockScreen() {
  document.getElementById('pwContent').style.display = 'none';
  document.getElementById('pinScreen').style.display = 'flex';
  document.getElementById('pinTitle').textContent = '请输入 PIN 码解锁';
  document.getElementById('pinActionBtn').textContent = '解锁';
  document.getElementById('pinActionBtn').onclick = submitPin;
  document.getElementById('pinInput').value = '';
  document.getElementById('pinError').style.display = 'none';
}

async function lockVault() {
  try {
    await API.lock();
    isUnlocked = false;
    // Close any open dialogs
    document.querySelectorAll('.dialog-overlay.active').forEach(el => el.classList.remove('active'));
    showUnlockScreen();
    showSnackbar('已锁定');
  } catch (e) { showSnackbar(e.message); }
}

function showVault() {
  document.getElementById('pinScreen').style.display = 'none';
  document.getElementById('pwContent').style.display = 'block';
  loadPasswords();
}

// === Passwords ===
async function loadPasswords() {
  const grid = document.getElementById('passwordGrid');
  grid.innerHTML = '<div class="loading" style="grid-column:1/-1"><div class="spinner"></div></div>';
  try {
    const list = await API.getPasswords();
    if (list.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔒</div><p>暂无密码记录</p></div>';
      return;
    }
    grid.innerHTML = list.map(p => `
      <div class="card password-card" onclick="showDetail(${p.id}, '${escapeHtml(p.title)}', '${escapeHtml(p.username)}', '${escapeHtml(p.password)}', '${escapeHtml(p.url || '')}', '${escapeHtml(p.notes || '')}')">
        <div class="pw-title">${escapeHtml(p.title)}</div>
        <div class="pw-username">${escapeHtml(p.username || '无用户名')}</div>
        <div class="pw-actions">
          <button class="btn-icon" style="width:32px;height:32px;font-size:16px" onclick="event.stopPropagation();copyToClipboard('${escapeHtml(p.password)}', '密码')">
            <span class="material-icons" style="font-size:16px">content_copy</span>
          </button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⚠️</div><p>' + escapeHtml(e.message) + '</p></div>';
  }
}

function showPasswordDialog(data) {
  document.getElementById('pwId').value = data ? data.id : '';
  document.getElementById('pwTitle').value = data ? data.title : '';
  document.getElementById('pwUsername').value = data ? data.username : '';
  document.getElementById('pwPassword').value = data ? data.password : '';
  document.getElementById('pwUrl').value = data ? data.url : '';
  document.getElementById('pwNotes').value = data ? data.notes : '';
  document.getElementById('pwDialogTitle').textContent = data ? '编辑密码' : '添加密码';
  openDialog('pwDialog');
}

function genPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
  let pwd = '';
  for (let i = 0; i < 16; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  document.getElementById('pwPassword').value = pwd;
}

async function savePassword() {
  if (!isUnlocked) { showSnackbar('请先解锁'); return; }
  const id = document.getElementById('pwId').value;
  const data = {
    title: document.getElementById('pwTitle').value.trim(),
    username: document.getElementById('pwUsername').value.trim(),
    password: document.getElementById('pwPassword').value,
    url: document.getElementById('pwUrl').value.trim(),
    notes: document.getElementById('pwNotes').value.trim()
  };
  if (!data.title || !data.password) { showSnackbar('标题和密码不能为空'); return; }
  try {
    if (id) await API.updatePassword(id, data);
    else await API.createPassword(data);
    showSnackbar('保存成功');
    closeDialog('pwDialog');
    loadPasswords();
  } catch (e) { showSnackbar(e.message); }
}

function showDetail(id, title, username, password, url, notes) {
  currentDetailId = id;
  document.getElementById('detailTitle').textContent = title;
  document.getElementById('detailBody').innerHTML = `
    <div class="pw-field"><span class="pw-label">用户名</span><span class="pw-value">${escapeHtml(username || '')}</span><span class="pw-copy" onclick="copyToClipboard('${escapeHtml(username)}', '用户名')"><span class="material-icons" style="font-size:18px">content_copy</span></span></div>
    <div class="pw-field"><span class="pw-label">密码</span><span class="pw-value">${escapeHtml(password)}</span><span class="pw-copy" onclick="copyToClipboard('${escapeHtml(password)}', '密码')"><span class="material-icons" style="font-size:18px">content_copy</span></span></div>
    ${url ? `<div class="pw-field"><span class="pw-label">网址</span><span class="pw-value"><a href="${escapeHtml(url)}" target="_blank" style="color:var(--md-ref-primary)">${escapeHtml(url)}</a></span></div>` : ''}
    ${notes ? `<div class="pw-field" style="flex-direction:column;align-items:flex-start;gap:4px"><span class="pw-label">备注</span><span style="font-size:14px">${escapeHtml(notes)}</span></div>` : ''}
  `.trim();
  openDialog('pwDetailDialog');
}

function editFromDetail() {
  if (!isUnlocked) { showSnackbar('请先解锁'); return; }
  closeDialog('pwDetailDialog');
  API.getPasswords().then(list => {
    const entry = list.find(p => p.id === currentDetailId);
    if (entry) showPasswordDialog({ id: entry.id, title: entry.title, username: entry.username, password: entry.password, url: entry.url, notes: entry.notes });
  });
}

function deleteFromDetail() {
  if (!isUnlocked) { showSnackbar('请先解锁'); return; }
  closeDialog('pwDetailDialog');
  document.getElementById('confirmMsg').textContent = '确定删除此密码记录？';
  document.getElementById('confirmBtn').onclick = async () => {
    try {
      await API.deletePassword(currentDetailId);
      showSnackbar('已删除');
      closeDialog('confirmDialog');
      loadPasswords();
    } catch (e) { showSnackbar(e.message); }
  };
  openDialog('confirmDialog');
}

function deleteFromDetail() {
  closeDialog('pwDetailDialog');
  document.getElementById('confirmMsg').textContent = '确定删除此密码记录？';
  document.getElementById('confirmBtn').onclick = async () => {
    try {
      await API.deletePassword(currentDetailId);
      showSnackbar('已删除');
      closeDialog('confirmDialog');
      loadPasswords();
    } catch (e) { showSnackbar(e.message); }
  };
  openDialog('confirmDialog');
}

function copyToClipboard(text, label) {
  navigator.clipboard.writeText(text).then(() => showSnackbar(label + ' 已复制'));
}

document.addEventListener('DOMContentLoaded', initPinScreen);

// Allow Enter key to submit PIN
document.getElementById('pinInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') submitPin();
});
