let categories = [];
let currentCatId = null;
let currentPostId = null;
let currentUser = null;

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function closeDialog(id) {
  document.getElementById(id).classList.remove('active');
}
function openDialog(id) {
  // Close any other open dialogs first
  document.querySelectorAll('.dialog-overlay.active').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Check auth
async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    currentUser = await API.getMe();
    return currentUser;
  } catch { return null; }
}

async function loadCategories() {
  categories = await API.getForumCategories();
  const list = document.getElementById('categoryList');
  list.innerHTML = categories.map(c =>
    `<div class="forum-cat-item${c.id === currentCatId ? ' active' : ''}" onclick="selectCategory(${c.id})">
      <span class="material-icons" style="font-size:18px">chat</span> ${escapeHtml(c.name)}
      <span class="text-muted" style="margin-left:auto;font-size:12px">${escapeHtml(c.description || '')}</span>
    </div>`
  ).join('');
}

function selectCategory(catId) {
  currentCatId = catId;
  currentPostId = null;
  loadPosts(catId);
  document.querySelectorAll('.forum-cat-item').forEach(el => el.classList.remove('active'));
  const idx = categories.findIndex(c => c.id === catId);
  if (idx >= 0) document.querySelectorAll('.forum-cat-item')[idx].classList.add('active');
}

async function loadPosts(catId) {
  const container = document.getElementById('forumContent');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const posts = await API.getForumPosts(catId);
    if (posts.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>暂无帖子</p></div>';
      return;
    }
    container.innerHTML = '<div class="forum-post-list">' + posts.map(p => `
      <div class="card forum-post-card" onclick="viewPost(${p.id})">
        <div class="post-title">${escapeHtml(p.title)}</div>
        <div class="post-meta">
          <span>${escapeHtml(p.author_name || '匿名')}</span>
          <span>${p.created_at}</span>
          <span>${p.reply_count || 0} 回复</span>
        </div>
      </div>
    `).join('') + '</div>';
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败</p></div>';
  }
}

async function viewPost(postId) {
  currentPostId = postId;
  const container = document.getElementById('forumContent');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  // Update URL for sharing
  history.pushState({ forumPostId: postId }, '', '/forum/' + postId);
  try {
    const data = await API.getForumPost(postId);
    const { post, replies } = data;
    const isOwner = currentUser && (currentUser.username === post.author_name || currentUser.role === 'admin');
    container.innerHTML = `
      <div class="post-detail">
        <div class="post-header">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <button class="btn btn-text btn-sm" onclick="selectCategory(${post.category_id})">
              <span class="material-icons" style="font-size:16px">arrow_back</span> 返回
            </button>
            ${isOwner ? `<button class="btn btn-text btn-sm" style="color:var(--md-ref-error);margin-left:auto" onclick="deletePost(${post.id})">删除</button>` : ''}
          </div>
          <h3 style="font-size:22px;font-weight:600">${escapeHtml(post.title)}</h3>
          <div class="post-meta">
            <span>${escapeHtml(post.author_name || '匿名')}</span>
            <span>${post.created_at}</span>
            <span class="chip" style="cursor:default;background:var(--md-ref-secondary-container);color:var(--md-ref-on-secondary-container);font-size:12px;padding:2px 10px">${escapeHtml(post.category_name || '')}</span>
          </div>
        </div>
        <div class="post-body">${renderContent(post.content, 1)}</div>
        <hr style="border:none;border-top:2px solid var(--md-ref-primary-container);margin:24px 0;border-radius:2px">
        <h4 style="font-weight:500;margin-bottom:16px">回复 (${replies.length})</h4>
        ${currentUser
          ? `<div style="display:flex;gap:8px;margin-bottom:16px">
              <textarea id="forumReplyInput" placeholder="写下你的回复...（支持 Markdown）" style="flex:1;min-height:60px;font-size:14px;font-family:monospace"></textarea>
              <button class="btn btn-filled btn-sm" style="align-self:flex-end" onclick="submitForumReply(${post.id})">回复</button>
             </div>`
          : '<p class="text-muted" style="margin-bottom:16px;font-size:14px"><a href="/login.html" style="color:var(--md-ref-primary)">登录</a>后可以回复</p>'}
        ${replies.length === 0 ? '<div class="text-muted" style="padding:16px">暂无回复</div>' :
          replies.map(r => `
            <div class="reply-item">
              <div class="reply-meta">
                <strong>${escapeHtml(r.author_name || '匿名')}</strong> · ${r.created_at}
                ${(currentUser && (currentUser.username === r.author_name || currentUser.role === 'admin'))
                  ? `<span style="float:right;color:var(--md-ref-error);cursor:pointer;font-size:13px" onclick="deleteReply(${r.id})">删除</span>` : ''}
              </div>
              <div class="reply-body">${escapeHtml(r.content)}</div>
            </div>
          `).join('')}
      </div>`;
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败</p></div>';
  }
}

function showNewPost() {
  if (!currentUser) { showSnackbar('请先登录'); return; }
  const sel = document.getElementById('postCategory');
  sel.innerHTML = categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  document.getElementById('postTitle').value = '';
  document.getElementById('postContent').value = '';
  document.getElementById('forumUploadStatus').innerHTML = '';
  // Render inline captcha if needed
  CAPTCHA.checkRequired('forum').then(r => {
    if (r.required) CAPTCHA.renderInline('forumCaptcha');
  });
  openDialog('newPostDialog');
}



async function submitPost() {
  const data = {
    category_id: parseInt(document.getElementById('postCategory').value),
    title: document.getElementById('postTitle').value.trim(),
    content: document.getElementById('postContent').value.trim(),
    use_markdown: 1
  };
  if (!data.title || !data.content) { showSnackbar('标题和内容不能为空'); return; }

  // Check inline captcha if needed
  const capContainer = document.getElementById('forumCaptcha');
  if (capContainer && capContainer.style.display !== 'none') {
    const val = CAPTCHA.getInlineValue();
    if (CAPTCHA.type === 'builtin') {
      const t = CAPTCHA.getToken();
      if (!val || !t) { showSnackbar('请完成验证码'); return; }
      const verify = await CAPTCHA.verify(val);
      if (!verify.success) { showSnackbar(verify.error || '验证码错误'); CAPTCHA.resetInline(); return; }
    } else if (CAPTCHA.type === 'recaptcha' && !val) {
      showSnackbar('请完成 reCAPTCHA 验证'); return;
    }
  }

  try {
    await API.createForumPost(data);
    showSnackbar('发布成功');
    closeDialog('newPostDialog');
    loadPosts(currentCatId || categories[0]?.id);
  } catch (e) { showSnackbar(e.message); }
}

function showReply(postId) {
  if (!currentUser) { showSnackbar('请先登录'); return; }
  document.getElementById('forumReplyInput')?.focus();
}

async function submitForumReply(postId) {
  const input = document.getElementById('forumReplyInput');
  if (!input) return;
  const content = input.value.trim();
  if (!content) { showSnackbar('回复内容不能为空'); return; }
  try {
    await API.createForumReply(postId, content);
    showSnackbar('回复成功');
    viewPost(postId);
  } catch (e) { showSnackbar(e.message); }
}

async function deletePost(id) {
  if (!confirm('确定删除此帖子？')) return;
  try {
    await API.deleteForumPost(id);
    showSnackbar('已删除');
    if (currentCatId) loadPosts(currentCatId);
    else loadCategories();
  } catch (e) { showSnackbar(e.message); }
}

async function deleteReply(id) {
  if (!confirm('确定删除此回复？')) return;
  try {
    await API.deleteForumReply(id);
    showSnackbar('已删除');
    if (currentPostId) viewPost(currentPostId);
  } catch (e) { showSnackbar(e.message); }
}

async function uploadForumFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = async () => {
    if (!input.files[0]) return;
    const formData = new FormData();
    formData.append('file', input.files[0]);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/upload/file', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      const ta = document.getElementById('postContent');
      ta.value = ta.value + '\n' + data.tag + '\n';
      ta.focus();
      document.getElementById('forumUploadStatus').textContent = '已插入: ' + data.tag;
    } catch (e) { showSnackbar(e.message); }
  };
  input.click();
}

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadCategories();
  if (categories.length > 0) {
    // Check if URL has a forum post ID
    const match = location.pathname.match(/^\/forum\/(\d+)$/);
    if (match) { viewPost(parseInt(match[1])); }
    else { selectCategory(categories[0].id); }
  }
  if (!currentUser) {
    document.getElementById('newPostBtn').textContent = '登录发帖';
    document.getElementById('newPostBtn').onclick = () => window.location.href = '/login.html';
  }
});

// Handle browser back/forward
window.addEventListener('popstate', (e) => {
  const match = location.pathname.match(/^\/forum\/(\d+)$/);
  if (match) { viewPost(parseInt(match[1])); }
  else if (categories.length > 0) { selectCategory(categories[0].id); }
});
