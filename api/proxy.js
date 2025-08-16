// api/proxy.js
// CORS Proxy for Vercel (@vercel/node - Node runtime)
//
// Features:
// - Handles GET/POST/PUT/PATCH/DELETE + preflight OPTIONS
// - Forwards request body and most headers (except hop-by-hop)
// - Sets permissive CORS headers (Access-Control-Allow-Origin: *)
// - Streams the upstream response (works for JSON, text, images, etc.)
//
// Usage:
//   https://<your-vercel-domain>/api/proxy?url=https%3A%2F%2Fapi.publicapis.org%2Fentries
//
// Optional: you can pass custom headers to the upstream as base64 JSON:
//   &h64=eyJBdXRob3JpemF0aW9uIjoiQmVhcmVyIHgteHgifQ==
// (example is base64 of {"Authorization":"Bearer x-xx"})
//
// Security: Consider restricting allowed hostnames via ALLOWLIST env var.

const HOP_BY_HOP = new Set([
  'connection','keep-alive','proxy-authenticate','proxy-authorization',
  'te','trailers','transfer-encoding','upgrade','host'
]);

function decodeHeaderBase64(h64) {
  try {
    const json = Buffer.from(h64, 'base64').toString('utf8');
    const obj = JSON.parse(json);
    if (obj && typeof obj === 'object') return obj;
  } catch {}
  return null;
}

function corsHeaders(origin='*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Origin',
    'Access-Control-Max-Age': '86400'
  };
}

function isHttpUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function allowedByEnv(u) {
  const allow = process.env.ALLOWLIST;
  if (!allow) return true; // no restriction
  const host = new URL(u).hostname;
  return allow.split(',').map(s => s.trim().toLowerCase()).includes(host.toLowerCase());
}

module.exports = async function handler(req, res) {
  const url = req.query.url;
  const origin = req.headers.origin || '*';

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  if (!url) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
    res.end(JSON.stringify({ error: 'Falta el parámetro ?url=' }));
    return;
  }

  if (!isHttpUrl(url)) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
    res.end(JSON.stringify({ error: 'URL inválida o protocolo no permitido' }));
    return;
  }

  if (!allowedByEnv(url)) {
    res.writeHead(403, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
    res.end(JSON.stringify({ error: 'Host no permitido por ALLOWLIST' }));
    return;
  }

  // Build headers for upstream
  const h64 = req.query.h64;
  const extraHeaders = h64 ? decodeHeaderBase64(h64) : null;

  const upstreamHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) {
      upstreamHeaders[k] = v;
    }
  }
  // Ensure a decent UA and origin
  upstreamHeaders['user-agent'] = upstreamHeaders['user-agent'] || 'Mozilla/5.0 (CORS-Proxy on Vercel)';
  delete upstreamHeaders['origin']; // do not forward browser origin
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) upstreamHeaders[k] = v;
  }

  const init = {
    method: req.method,
    headers: upstreamHeaders,
    // Only pass body on methods that can have one
    body: ['GET','HEAD'].includes(req.method) ? undefined : req
  };

  try {
    const upstream = await fetch(url, init);
    // Copy headers
    const headers = {};
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) headers[key] = value;
    });

    // Set CORS + expose some headers
    const cors = corsHeaders(origin);
    headers['Access-Control-Allow-Origin'] = cors['Access-Control-Allow-Origin'];
    headers['Access-Control-Allow-Credentials'] = cors['Access-Control-Allow-Credentials'];
    headers['Access-Control-Allow-Methods'] = cors['Access-Control-Allow-Methods'];
    headers['Access-Control-Allow-Headers'] = cors['Access-Control-Allow-Headers'];
    headers['Access-Control-Max-Age'] = cors['Access-Control-Max-Age'];
    headers['Access-Control-Expose-Headers'] = (headers['Access-Control-Expose-Headers'] || 'Content-Type, Content-Length, ETag');

    // Status passthrough
    res.writeHead(upstream.status, headers);

    if (upstream.body) {
      // Stream the response
      upstream.body.pipe(res);
      upstream.body.on('error', (e) => {
        try { res.destroy(e); } catch {}
      });
    } else {
      res.end();
    }
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
    res.end(JSON.stringify({ error: 'Upstream error', detail: err.message }));
  }
};
