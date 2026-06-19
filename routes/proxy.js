const express = require('express');
const http = require('http');
const https = require('https');
const url = require('url');

const router = express.Router();

router.get('/fetch', (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: '缺少 url 参数' });

  try {
    const parsed = new URL(target);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      rejectUnauthorized: false,
    };

    const client = parsed.protocol === 'https:' ? https : http;
    client.get(opts, (proxyRes) => {
      // Strip headers that prevent embedding
      const headers = { ...proxyRes.headers };
      delete headers['x-frame-options'];
      delete headers['X-Frame-Options'];
      delete headers['content-security-policy'];
      delete headers['Content-Security-Policy'];

      // Rewrite CSP in meta tags
      let body = '';
      proxyRes.on('data', (chunk) => { body += chunk.toString('utf8'); });
      proxyRes.on('end', () => {
        // Rewrite relative URLs to absolute so assets load
        const base = `${parsed.protocol}//${parsed.host}`;
        body = body
          .replace(/src=["']\/(?!\/)/g, `src="${base}/`)
          .replace(/href=["']\/(?!\/)/g, `href="${base}/`)
          .replace(/action=["']\/(?!\/)/g, `action="${base}/`)
          // Remove meta CSP
          .replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '')
          // Remove X-Frame-Options meta
          .replace(/<meta[^>]+http-equiv=["']X-Frame-Options["'][^>]*>/gi, '');

        res.writeHead(proxyRes.statusCode || 200, headers);
        res.end(body);
      });
    }).on('error', (e) => {
      res.status(502).json({ error: '代理请求失败: ' + e.message });
    });
  } catch (e) {
    res.status(400).json({ error: '无效的 URL' });
  }
});

module.exports = router;
