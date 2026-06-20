const db = require('./db');

function ssrPage(title, contentHtml, metaDesc) {
  const siteName = db.getSetting('site_name') || 'RainWeb';
  const color = db.getSetting('primary_color') || '#6750a4';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${siteName}</title>
  <meta name="description" content="${metaDesc || title}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${metaDesc || title}">
  <meta name="robots" content="index,follow">
  <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .ssr-content { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
    .ssr-content h1 { font-size: 28px; font-weight: 600; margin-bottom: 8px; color: var(--md-ref-on-surface); }
    .ssr-content .meta { font-size: 14px; color: var(--md-ref-on-surface-variant); margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--md-ref-outline-variant); }
    .ssr-content .body { font-size: 16px; line-height: 1.8; white-space: pre-wrap; color: var(--md-ref-on-surface); }
    .ssr-content .body h1, .ssr-content .body h2, .ssr-content .body h3 { margin: 20px 0 10px; }
    .ssr-content .body p { margin: 10px 0; }
    .ssr-content .body img { max-width: 100%; border-radius: 8px; }
    .ssr-nav { display:flex;align-items:center;gap:8px;padding:0 16px;height:56px;background:var(--md-ref-surface-container);border-bottom:1px solid var(--md-ref-outline-variant);position:sticky;top:0;z-index:100;}
    .ssr-nav a { color:var(--md-ref-primary);text-decoration:none;font-size:14px;font-weight:500;display:flex;align-items:center;gap:4px;}
    .ssr-nav span { color:var(--md-ref-on-surface-variant);font-size:14px;font-weight:500;flex:1; }
    @media (prefers-color-scheme:dark){:root{--md-ref-background:#1c1b1f;--md-ref-on-surface:#e6e1e5;--md-ref-on-surface-variant:#cac4d0;--md-ref-surface-container:#25232a;--md-ref-primary:${color};--md-card-bg:#25232a;--md-ref-outline-variant:#49454f;--md-shadow:rgba(0,0,0,0.32)}}
    body{font-family:'Segoe UI',Roboto,sans-serif;background:var(--md-ref-background);color:var(--md-ref-on-surface);margin:0}
  </style>
</head>
<body>
  <nav class="ssr-nav">
    <a href="/"><span class="material-icons" style="font-size:20px">arrow_back</span> 返回</a>
    <span>${siteName}</span>
  </nav>
  <div class="ssr-content">${contentHtml}</div>
</body>
</html>`;
}

function renderSSR(content) {
  let html = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\[image:([^\]]+)\]/g, (m, f) => `<img src="/uploads/${encodeURIComponent(f)}" alt="" loading="lazy" style="max-width:100%;border-radius:8px;margin:8px 0">`);
  html = html.replace(/\[file:([^\]]+)\]/g, (m, f) => `<a href="/uploads/${encodeURIComponent(f)}" target="_blank" style="color:#6750a4;text-decoration:underline">📎 ${f}</a>`);
  return html.replace(/\n/g, '<br>');
}

function blogSSR(req, res) {
  const post = db.get('SELECT bp.*, u.username as author_name FROM blog_posts bp LEFT JOIN users u ON bp.author_id = u.id WHERE bp.id = ?', [req.params.id]);
  if (!post || !post.published) return res.status(404).send('文章不存在');
  const body = renderSSR(post.content);
  const excerpt = post.excerpt || post.content.slice(0, 150);
  const html = ssrPage(post.title,
    `<h1>${post.title.replace(/</g,'&lt;')}</h1>
     <div class="meta">${post.author_name || '管理员'} · ${post.created_at}</div>
     <div class="body">${body}</div>`, excerpt);
  res.send(html);
}

function forumSSR(req, res) {
  const post = db.get(
    `SELECT fp.*, u.username as author_name, fc.name as category_name
     FROM forum_posts fp LEFT JOIN users u ON fp.author_id = u.id
     LEFT JOIN forum_categories fc ON fp.category_id = fc.id
     WHERE fp.id = ?`, [req.params.id]);
  if (!post) return res.status(404).send('帖子不存在');

  const replies = db.all(
    `SELECT fr.*, u.username as author_name FROM forum_replies fr
     LEFT JOIN users u ON fr.author_id = u.id
     WHERE fr.post_id = ? ORDER BY fr.created_at ASC`, [req.params.id]);

  const body = renderSSR(post.content);
  const repliesHtml = replies.map(r =>
    `<div style="padding:12px;margin-bottom:8px;background:var(--md-card-bg);border-radius:8px;border:1px solid var(--md-ref-outline-variant)">
       <div style="font-size:13px;color:var(--md-ref-on-surface-variant);margin-bottom:4px">${r.author_name || '匿名'} · ${r.created_at}</div>
       <div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${r.content.replace(/</g,'&lt;')}</div>
     </div>`
  ).join('');

  const html = ssrPage(post.title,
    `<div style="margin-bottom:8px"><span class="material-icons" style="font-size:14px;color:var(--md-ref-on-surface-variant);vertical-align:middle">chat</span> <span style="font-size:14px;color:var(--md-ref-on-surface-variant)">${post.category_name || ''}</span></div>
     <h1>${post.title.replace(/</g,'&lt;')}</h1>
     <div class="meta">${post.author_name || '匿名'} · ${post.created_at}</div>
     <div class="body">${body}</div>
     <h3 style="margin-top:32px;font-weight:500">回复 (${replies.length})</h3>
     ${repliesHtml || '<p style="color:var(--md-ref-on-surface-variant)">暂无回复</p>'}`, post.title);
  res.send(html);
}

function sitemapXml(req, res) {
  const siteName = db.getSetting('site_name') || 'RainWeb';
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const blogPosts = db.all('SELECT id, created_at FROM blog_posts WHERE published = 1 ORDER BY created_at DESC');
  const forumPosts = db.all('SELECT id, created_at FROM forum_posts ORDER BY created_at DESC');

  let urls = `<url><loc>${baseUrl}/</loc><priority>1.0</priority></url>`;
  blogPosts.forEach(p => {
    urls += `<url><loc>${baseUrl}/blog/${p.id}</loc><lastmod>${p.created_at}</lastmod><priority>0.8</priority></url>`;
  });
  forumPosts.forEach(p => {
    urls += `<url><loc>${baseUrl}/forum/${p.id}</loc><lastmod>${p.created_at}</lastmod><priority>0.6</priority></url>`;
  });

  res.header('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
}

module.exports = { blogSSR, forumSSR, sitemapXml };
