// Content renderer: handles Markdown + [image:xxx] / [file:xxx] tags

function renderContent(content, useMarkdown) {
  if (!useMarkdown) {
    let html = escapeHtml(content);
    html = html.replace(/\[image:([^\]]+)\]/g, (m, filename) => {
      return `<img src="/uploads/${encodeURIComponent(filename)}" alt="" loading="lazy" style="max-width:100%;border-radius:8px;margin:8px 0">`;
    });
    html = html.replace(/\[file:([^\]]+)\]/g, (m, filename) => {
      const token = localStorage.getItem('token') || '';
      return `<a href="/api/upload/download/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}" target="_blank" class="file-link" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--md-ref-surface-container);border-radius:8px;margin:4px 0;text-decoration:none;color:var(--md-ref-primary);font-size:14px">
        <span class="material-icons" style="font-size:18px">attachment</span> ${escapeHtml(filename)}</a>`;
    });
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  // Markdown mode: extract custom tags before markdown, restore after
  const images = [];
  const files = [];
  let html = content.replace(/\[image:([^\]]+)\]/g, (m, f) => { images.push(f); return `\x00IMG${images.length - 1}\x00`; });
  html = html.replace(/\[file:([^\]]+)\]/g, (m, f) => { files.push(f); return `\x00FILE${files.length - 1}\x00`; });

  if (typeof marked !== 'undefined') {
    html = marked.parse(html, { breaks: true, gfm: true });
  } else {
    html = escapeHtml(html);
    html = html.replace(/\n/g, '<br>');
  }

  html = html.replace(/\x00IMG(\d+)\x00/g, (m, i) => {
    const fn = images[parseInt(i)];
    if (!fn) return '';
    return `<img src="/uploads/${encodeURIComponent(fn)}" alt="" loading="lazy" style="max-width:100%;border-radius:8px;margin:8px 0">`;
  });
  html = html.replace(/\x00FILE(\d+)\x00/g, (m, i) => {
    const fn = files[parseInt(i)];
    if (!fn) return '';
    const token = localStorage.getItem('token') || '';
    return `<a href="/api/upload/download/${encodeURIComponent(fn)}?token=${encodeURIComponent(token)}" target="_blank" class="file-link" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--md-ref-surface-container);border-radius:8px;margin:4px 0;text-decoration:none;color:var(--md-ref-primary);font-size:14px">
      <span class="material-icons" style="font-size:18px">attachment</span> ${escapeHtml(fn)}</a>`;
  });
  return html;
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}
