// Content renderer: handles Markdown + [image:xxx] / [file:xxx] tags

function renderContent(content, useMarkdown) {
  // Step 1: Escape HTML to prevent XSS
  let html = escapeHtml(content);

  // Step 2: Replace [image:filename] with <img> tags
  html = html.replace(/\[image:([^\]]+)\]/g, (m, filename) => {
    return `<img src="/uploads/${encodeURIComponent(filename)}" alt="" loading="lazy" style="max-width:100%;border-radius:8px;margin:8px 0">`;
  });
  // Step 3: Replace [file:filename] with download links
  html = html.replace(/\[file:([^\]]+)\]/g, (m, filename) => {
    const token = localStorage.getItem('token') || '';
    return `<a href="/api/upload/download/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}" target="_blank" class="file-link" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--md-ref-surface-container);border-radius:8px;margin:4px 0;text-decoration:none;color:var(--md-ref-primary);font-size:14px">
      <span class="material-icons" style="font-size:18px">attachment</span> ${escapeHtml(filename)}</a>`;
  });
  // Step 4: Render Markdown if enabled
  if (useMarkdown && typeof marked !== 'undefined') {
    html = marked.parse(html, { breaks: true });
  } else if (!useMarkdown) {
    html = html.replace(/\n/g, '<br>');
  }
  return html;
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}
