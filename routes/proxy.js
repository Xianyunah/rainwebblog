const express = require('express');
const http = require('http');
const https = require('https');
const router = express.Router();

function proxyRequest(target, res, maxRedirects = 5) {
  if (maxRedirects <= 0) return res.status(502).json({ error: '重定向次数过多' });
  try {
    const parsed = new URL(target);
    const client = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      timeout: 15000,
      family: 4,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      rejectUnauthorized: false,
    };
    const req = client.get(opts, (proxyRes) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
        try {
          return proxyRequest(new URL(proxyRes.headers.location, target).href, res, maxRedirects - 1);
        } catch { return res.status(502).json({ error: '重定向地址无效' }); }
      }

      // Strip headers that would block embedding
      const headers = { ...proxyRes.headers };
      delete headers['x-frame-options'];
      delete headers['X-Frame-Options'];
      delete headers['content-security-policy'];
      delete headers['Content-Security-Policy'];

      // Inject <base> tag so relative URLs resolve to the original domain
      const contentType = (headers['content-type'] || '').toLowerCase();
      if (contentType.includes('text/html')) {
        const baseUrl = `${parsed.protocol}//${parsed.host}`;
        let html = '';
        proxyRes.on('data', chunk => { html += chunk.toString('utf8'); });
        proxyRes.on('end', () => {
          // Insert <base> tag after <head> or at the beginning
          html = html.replace('<head>', `<head><base href="${baseUrl}">`);
          // Also remove meta CSP/X-Frame-Options
          html = html.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
          html = html.replace(/<meta[^>]+http-equiv=["']X-Frame-Options["'][^>]*>/gi, '');
          res.writeHead(proxyRes.statusCode || 200, headers);
          res.end(html);
        });
        proxyRes.on('error', e => {
          console.error('Proxy stream error:', target, e.message);
          sendError(res, '代理响应错误: ' + e.message);
        });
      } else {
        // Non-HTML: pipe directly (images, CSS, JS, etc.)
        res.writeHead(proxyRes.statusCode || 200, headers);
        proxyRes.pipe(res);
      }
    });
    req.on('timeout', () => {
      req.destroy();
      sendError(res, '代理请求超时（15秒），目标服务器无响应');
    });
    req.on('error', e => {
      sendError(res, '代理请求失败: ' + e.message);
    });
  } catch (e) {
    sendError(res, '无效的 URL: ' + e.message);
  }
}

function sendError(res, msg) {
  console.error('Proxy error:', msg);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;color:#333}
    .box{max-width:480px;padding:32px;text-align:center;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
    h2{color:#d32f2f;margin:0 0 8px;font-size:20px}
    p{color:#666;font-size:14px;line-height:1.6;margin:0}
    code{display:block;font-size:13px;background:#f5f5f5;padding:8px 12px;border-radius:8px;margin-top:12px;word-break:break-all}
  </style></head><body><div class="box"><h2>⚠️ 代理加载失败</h2><p>${msg}</p></div></body></html>`;
  res.status(502).send(html);
}

router.get('/fetch', (req, res) => {
  if (!req.query.url) return res.status(400).json({ error: '缺少 url 参数' });
  proxyRequest(req.query.url, res);
});

module.exports = router;
