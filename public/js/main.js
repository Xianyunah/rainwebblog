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
  detail.innerHTML = '<div class="loading" style="column-span:all"><div class="spinner"></div></div>';
  try {
    const post = await API.getBlogPost(id);
    const body = post.use_markdown
      ? marked.parse(post.content, { breaks: true })
      : post.content.replace(/\n/g, '<br>');
    detail.innerHTML = `
      <div class="blog-article">
        <button class="btn btn-text btn-sm" onclick="loadPosts()" style="margin-bottom:16px">
          <span class="material-icons" style="font-size:16px">arrow_back</span> 返回列表
        </button>
        <h1 class="article-title">${escapeHtml(post.title)}</h1>
        <div class="article-meta">${escapeHtml(post.author_name || '管理员')} · ${post.created_at}</div>
        <div class="md-body">${body}</div>
      </div>`;
  } catch (e) {
    detail.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败</p></div>';
  }
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', loadPosts);
