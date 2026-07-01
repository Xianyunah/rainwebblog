let categories = [];
let currentCatId = null;
let currentPostId = null;
let currentUser = null;

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function closeDialog(id) { document.getElementById(id).classList.remove('active'); }
function openDialog(id) { document.querySelectorAll('.dialog-overlay.active').forEach(el => el.classList.remove('active')); document.getElementById(id).classList.add('active'); }

async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try { currentUser = await API.getMe(); return currentUser; } catch { return null; }
}

async function loadCategories() {
  categories = await API.getForumCategories();
  const list = document.getElementById('categoryList');
  list.innerHTML = categories.map(c =>
    `<div class="forum-cat-item${c.id === currentCatId ? ' active' : ''}" onclick="selectCategory(${c.id})">
      <span class="material-icons" style="font-size:18px">forum</span> ${escapeHtml(c.name)}
      ${c.announcement ? '<span class="material-icons" style="font-size:14px;color:var(--md-ref-primary)">campaign</span>' : ''}
    </div>`
  ).join('');
}

function showAllPosts() {
  currentCatId = null;
  currentPostId = null;
  loadAllPosts();
  document.querySelectorAll('.forum-cat-item').forEach(el => el.classList.remove('active'));
  document.querySelector('.forum-cat-item:last-child').classList.add('active');
}

function selectCategory(catId) {
  currentCatId = catId;
  currentPostId = null;
  loadCategoryPosts(catId, '');
  document.querySelectorAll('.forum-cat-item').forEach(el => el.classList.remove('active'));
  const idx = categories.findIndex(c => c.id === catId);
  if (idx >= 0) document.querySelectorAll('.forum-cat-item')[idx].classList.add('active');
}

// Load all latest posts (homepage view)
async function loadAllPosts() {
  const container = document.getElementById('forumContent');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const posts = await API.getForumPosts();
    renderPostList(container, posts);
  } catch { container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败</p></div>'; }
}

// Load posts for a specific board
async function loadCategoryPosts(catId, filterSub) {
  const container = document.getElementById('forumContent');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const cat = categories.find(c => c.id === catId);
    // Board header
    let header = `<div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <h3 style="font-weight:600;font-size:20px;margin:0">${escapeHtml(cat ? cat.name : '')}</h3>
        <span class="chip" style="cursor:default;font-size:12px;padding:1px 8px;color:var(--md-ref-on-surface-variant);border:1px solid var(--md-ref-outline-variant)">板块</span>
        <a href="/forum.html?board=${catId}&full=1" class="btn-icon" title="全屏板块" style="width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;padding:0" onclick="event.stopPropagation()"><span class="material-icons" style="font-size:18px;line-height:1">open_in_full</span></a>
      </div>
      <p class="text-muted" style="font-size:14px">${escapeHtml(cat ? (cat.description || '') : '')}</p>`;
    if (cat && cat.announcement) {
      header += `<div class="announcement-bar" style="margin-top:8px"><span class="material-icons" style="font-size:18px">campaign</span> ${escapeHtml(cat.announcement)}</div>`;
    }
    // Sub-category filter chips
    const subCats = cat?.sub_categories ? cat.sub_categories.split(',').filter(Boolean).map(t => t.trim()) : [];
    if (subCats.length > 0) {
      header += `<div class="chips" style="margin-bottom:12px;margin-top:12px">
        <span class="chip${!filterSub ? ' active' : ''}" onclick="loadCategoryPosts(${catId}, '')">全部</span>
        ${subCats.map(s => `<span class="chip${filterSub === s ? ' active' : ''}" onclick="loadCategoryPosts(${catId}, '${escapeHtml(s)}')">${escapeHtml(s)}</span>`).join('')}
      </div>`;
    }
    header += '</div>';
    container.innerHTML = header;
    const posts = await API.getForumPosts(catId);
    const filtered = filterSub ? posts.filter(p => p.sub_category === filterSub) : posts;
    if (filtered.length === 0) {
      container.innerHTML += '<div class="empty-state"><div class="empty-icon">📝</div><p>暂无帖子</p></div>';
      return;
    }
    renderPostList(container, filtered, header);
  } catch { container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败</p></div>'; }
}

function renderPostList(container, posts, headerHtml) {
  const list = posts.map(p => {
    const subCat = p.sub_category ? `<span class="chip" style="cursor:default;font-size:11px;padding:1px 8px;background:var(--md-ref-secondary-container);color:var(--md-ref-on-secondary-container)">${escapeHtml(p.sub_category)}</span>` : '';
    const catName = categories.find(c => c.id === p.category_id)?.name || '';
    return `<div class="card forum-post-card" onclick="viewPost(${p.id})">
      <div class="post-title">${escapeHtml(p.title)}</div>
      <div class="post-meta" style="margin-bottom:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span>${escapeHtml(p.author_name || '匿名')}</span>
        <span>${p.created_at}</span>
        <span>${p.reply_count || 0} 回复</span>
        <span style="color:var(--md-ref-outline);margin:0 4px">|</span>
        <span class="chip" style="cursor:default;font-size:11px;padding:1px 8px;background:transparent;border:1px solid var(--md-ref-outline-variant);color:var(--md-ref-on-surface-variant)">${escapeHtml(catName)}</span>
        ${subCat}
      </div>
    </div>`;
  }).join('');
  container.innerHTML = (headerHtml || '') + '<div class="forum-post-list">' + list + '</div>';
}

async function viewPost(postId) {
  currentPostId = postId;
  const container = document.getElementById('forumContent');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  history.pushState({ forumPostId: postId }, '', '/forum/' + postId);
  try {
    const data = await API.getForumPost(postId);
    const { post, replies } = data;
    const isOwner = currentUser && (currentUser.username === post.author_name || currentUser.role === 'admin');
    const subCat = post.sub_category ? `<span class="chip" style="cursor:default;font-size:12px;padding:2px 10px;background:var(--md-ref-secondary-container);color:var(--md-ref-on-secondary-container)">${escapeHtml(post.sub_category)}</span>` : '';
    container.innerHTML = `
      <div class="post-detail">
        <div class="post-header">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <button class="btn btn-text btn-sm" onclick="backToList()">
              <span class="material-icons" style="font-size:16px">arrow_back</span> 返回
            </button>
            ${isOwner ? `<button class="btn btn-text btn-sm" style="color:var(--md-ref-error);margin-left:auto" onclick="deletePost(${post.id})">删除</button>` : ''}
          </div>
          <h3 style="font-size:22px;font-weight:600">${escapeHtml(post.title)}</h3>
          <div class="post-meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span>${escapeHtml(post.author_name || '匿名')}</span>
            <span>${post.created_at}</span>
            <span class="chip" style="cursor:default;background:var(--md-ref-secondary-container);color:var(--md-ref-on-secondary-container);font-size:12px;padding:2px 10px">${escapeHtml(post.category_name || '')}</span>
            ${subCat}
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
  } catch { container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败</p></div>'; }
}

function backToList() {
  if (currentCatId) selectCategory(currentCatId);
  else showAllPosts();
}

function showNewPost() {
  if (!currentUser) { showSnackbar('请先登录'); return; }
  const sel = document.getElementById('postCategory');
  sel.innerHTML = categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  // Update sub-category options when board changes
  sel.onchange = () => updateSubCatOptions();
  updateSubCatOptions();
  document.getElementById('postTitle').value = '';
  document.getElementById('postContent').value = '';
  document.getElementById('forumUploadStatus').innerHTML = '';
  CAPTCHA.verified = false;
  openDialog('newPostDialog');
}

function updateSubCatOptions() {
  const sel = document.getElementById('postCategory');
  const subSel = document.getElementById('postSubCategory');
  const catId = parseInt(sel.value);
  const cat = categories.find(c => c.id === catId);
  const sc = cat?.sub_categories ? cat.sub_categories.split(',').filter(Boolean).map(t => t.trim()) : [];
  subSel.innerHTML = '<option value="">无</option>' + sc.map(s => `<option value="${s}">${escapeHtml(s)}</option>`).join('');
}

async function submitPost() {
  const data = {
    category_id: parseInt(document.getElementById('postCategory').value),
    title: document.getElementById('postTitle').value.trim(),
    content: document.getElementById('postContent').value.trim(),
    sub_category: document.getElementById('postSubCategory').value,
    use_markdown: 1
  };
  if (!data.title || !data.content) { showSnackbar('标题和内容不能为空'); return; }
  const capOk = await CAPTCHA.showModal('forum');
  if (!capOk) return;
  try {
    await API.createForumPost(data);
    showSnackbar('发布成功');
    closeDialog('newPostDialog');
    if (currentCatId) loadCategoryPosts(currentCatId);
    else loadAllPosts();
  } catch (e) { showSnackbar(e.message); }
}

async function uploadForumFile() {
  const input = document.createElement('input'); input.type = 'file';
  input.onchange = async () => {
    if (!input.files[0]) return;
    const formData = new FormData(); formData.append('file', input.files[0]);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/upload/file', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      const ta = document.getElementById('postContent');
      ta.value = ta.value + '\n' + data.tag + '\n'; ta.focus();
      document.getElementById('forumUploadStatus').textContent = '已插入: ' + data.tag;
    } catch (e) { showSnackbar(e.message); }
  }; input.click();
}

function showReply(postId) { if (!currentUser) { showSnackbar('请先登录'); return; } document.getElementById('forumReplyInput')?.focus(); }

async function submitForumReply(postId) {
  const input = document.getElementById('forumReplyInput');
  if (!input) return;
  const content = input.value.trim();
  if (!content) { showSnackbar('回复内容不能为空'); return; }
  try { await API.createForumReply(postId, content); showSnackbar('回复成功'); viewPost(postId); } catch (e) { showSnackbar(e.message); }
}

async function deletePost(id) { if (!confirm('确定删除？')) return; try { await API.deleteForumPost(id); if (currentCatId) selectCategory(currentCatId); else showAllPosts(); } catch (e) { showSnackbar(e.message); } }

async function deleteReply(id) { if (!confirm('确定删除？')) return; try { await API.deleteForumReply(id); if (currentPostId) viewPost(currentPostId); } catch (e) { showSnackbar(e.message); } }

var FORUM = {
  init: async function () {
    await checkAuth();
    await loadCategories();
    // Check URL for post, board, or full board mode
    var postMatch = location.pathname.match(/^\/forum\/(\d+)$/);
    var params = new URLSearchParams(location.search);
    var boardParam = params.get('board');
    var fullMode = params.get('full') === '1';

    if (postMatch) {
      selectCategory(parseInt(postMatch[1])); // will show post
    } else if (boardParam) {
      selectCategory(parseInt(boardParam));
      if (fullMode) {
        var sidebar = document.querySelector('.forum-sidebar');
        if (sidebar) sidebar.style.display = 'none';
        document.querySelector('.forum-layout').style.gridTemplateColumns = '1fr';
      }
    } else {
      showAllPosts();
    }
    if (!currentUser) { document.getElementById('newPostBtn').textContent = '登录发帖'; document.getElementById('newPostBtn').onclick = function () { window.location.href = '/login.html'; }; }
  }
};

window.addEventListener('popstate', function () {
  if (!location.pathname.startsWith('/forum')) return;
  var pm = location.pathname.match(/^\/forum\/(\d+)$/);
  if (pm) viewPost(parseInt(pm[1]));
  else if (currentCatId) selectCategory(currentCatId);
  else showAllPosts();
});
