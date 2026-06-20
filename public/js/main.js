let currentUser = null;

async function loadPosts() {
  const container = document.getElementById('blogList');
  container.innerHTML = '<div class="loading" style="column-span:all"><div class="spinner"></div></div>';
  document.getElementById('blogDetail').style.display = 'none';
  document.getElementById('blogList').style.display = 'block';
  document.getElementById('blogHeader').style.display = 'block';
  try {
    const posts = await API.getBlogPosts(false);
    if (posts.length === 0) {
      container.innerHTML = '<div class="empty-state" style="column-span:all"><div class="empty-icon">📖</div><p>暂无文章</p></div>';
      return;
    }
    container.innerHTML = posts.map(p => {
      const excerpt = p.excerpt || p.content.replace(/[#*`\[\]()>|~_]/g,'').slice(0, 150);
      return `<div class="card blog-card" onclick="viewPost(${p.id})">
        <div class="blog-featured"></div>
        <div class="blog-title">${escapeHtml(p.title)}</div>
        <div class="blog-excerpt">${escapeHtml(excerpt)}</div>
        <div class="blog-meta">${escapeHtml(p.author_name || '管理员')} · ${p.created_at}</div>
      </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty-state" style="column-span:all"><div class="empty-icon">⚠️</div><p>加载失败: ' + escapeHtml(e.message) + '</p></div>';
  }
}

async function viewPost(id) {
  const list = document.getElementById('blogList');
  const detail = document.getElementById('blogDetail');
  const header = document.getElementById('blogHeader');
  list.style.display = 'none';
  header.style.display = 'none';
  detail.style.display = 'block';
  history.pushState({ postId: id }, '', '/blog/' + id);
  detail.innerHTML = '<div class="loading" style="column-span:all"><div class="spinner"></div></div>';
  try {
    const post = await API.getBlogPost(id);
    const body = renderContent(post.content, post.use_markdown);
    const comments = await API.request('GET', '/blog/comments/' + id);
    const commentList = comments.map(c =>
      `<div class="reply-item">
        <div class="reply-meta"><strong>${escapeHtml(c.author_name || '游客')}</strong> · ${c.created_at}</div>
        <div class="reply-body">${escapeHtml(c.content)}</div>
      </div>`
    ).join('');

    const commentForm = currentUser
      ? `<div style="display:flex;gap:8px;margin-top:12px">
          <textarea id="blogCommentInput" placeholder="写下你的评论..." style="flex:1;min-height:60px;font-size:14px"></textarea>
          <button class="btn btn-filled btn-sm" style="align-self:flex-end" onclick="submitComment(${id})">发表评论</button>
         </div>`
      : `<p class="text-muted" style="margin-top:12px;font-size:14px"><a href="/login.html" style="color:var(--md-ref-primary)">登录</a>后可以评论</p>`;

    detail.innerHTML = `
      <div class="blog-article">
        <button class="btn btn-text btn-sm" onclick="loadPosts()" style="margin-bottom:16px">
          <span class="material-icons" style="font-size:16px">arrow_back</span> 返回列表
        </button>
        <h1 class="article-title">${escapeHtml(post.title)}</h1>
        <div class="article-meta">${escapeHtml(post.author_name || '管理员')} · ${post.created_at}</div>
        <div class="md-body">${body}</div>
        <hr style="border:none;border-top:1px solid var(--md-ref-outline-variant);margin:32px 0">
        <h4 style="font-weight:500;margin-bottom:16px">评论 (${comments.length})</h4>
        ${commentList || '<p class="text-muted" style="font-size:14px">暂无评论</p>'}
        ${commentForm}
      </div>`;
  } catch (e) {
    detail.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败</p></div>';
  }
}

async function submitComment(postId) {
  const input = document.getElementById('blogCommentInput');
  const content = input.value.trim();
  if (!content) { showSnackbar('评论不能为空'); return; }
  try {
    await API.request('POST', '/blog/comments/' + postId, { content });
    showSnackbar('评论已发表');
    viewPost(postId);
  } catch (e) { showSnackbar(e.message); }
}

window.addEventListener('popstate', (e) => {
  const path = location.pathname;
  const blogMatch = path.match(/^\/blog\/(\d+)$/);
  if (blogMatch) { viewPost(blogMatch[1]); return; }
  loadPosts();
});

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', async () => {
  try { currentUser = await API.getMe(); } catch {}
  loadPosts();
});
