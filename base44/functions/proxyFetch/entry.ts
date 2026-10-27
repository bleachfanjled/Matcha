// proxyFetch — server-side proxy that fetches a URL, strips embedding-blocking
// headers (X-Frame-Options, CSP), rewrites resource URLs to route through
// itself, and returns the content. This lets the iframe load sites that
// normally block embedding via X-Frame-Options or CSP frame-ancestors.
//
// GET  /functions/proxyFetch?url=<target>  — used by the iframe and service worker
// POST /functions/proxyFetch  { url }      — used by SDK calls

const PROXY_PREFIX = '/functions/proxyFetch?url=';

function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]' ||
    h.startsWith('10.') || h.startsWith('172.16.') || h.startsWith('192.168.') ||
    h.endsWith('.local') || h === 'metadata.google.internal';
}

function resolveUrl(rel, base) {
  try { return new URL(rel, base).href; } catch { return null; }
}

function proxyUrl(url) {
  return PROXY_PREFIX + encodeURIComponent(url);
}

function isSafeToRewrite(u) {
  return u && !u.startsWith('data:') && !u.startsWith('javascript:') &&
    !u.startsWith('mailto:') && !u.startsWith('tel:') && !u.startsWith('#') &&
    !u.startsWith('blob:');
}

function rewriteHtml(html, baseUrl) {
  // Remove <base> tags (they interfere with proxy URL resolution)
  html = html.replace(/<base[^>]*>/gi, '');

  // Remove integrity and nonce attributes (break when URLs are rewritten)
  html = html.replace(/\s+integrity\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s+nonce\s*=\s*["'][^"']*["']/gi, '');

  // Remove CSP and X-Frame-Options meta tags
  html = html.replace(/<meta[^>]*http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');
  html = html.replace(/<meta[^>]*http-equiv=["']?x-frame-options["']?[^>]*>/gi, '');

  // Handle srcset (comma-separated URL+descriptor pairs)
  html = html.replace(/srcset\s*=\s*["']([^"']*)["']/gi, (m, val) => {
    const parts = val.split(',').map(part => {
      const trimmed = part.trim();
      const spaceIdx = trimmed.indexOf(' ');
      const url = spaceIdx > 0 ? trimmed.slice(0, spaceIdx) : trimmed;
      const desc = spaceIdx > 0 ? trimmed.slice(spaceIdx) : '';
      if (!isSafeToRewrite(url)) return trimmed;
      const abs = resolveUrl(url, baseUrl);
      if (!abs) return trimmed;
      return proxyUrl(abs) + desc;
    });
    return 'srcset="' + parts.join(', ') + '"';
  });

  // Handle src, href, action, data-src, poster attributes
  html = html.replace(/((?:src|href|action|data-src|poster)\s*=\s*["'])([^"']*)(["'])/gi, (m, pre, u, post) => {
    if (!isSafeToRewrite(u)) return m;
    const abs = resolveUrl(u, baseUrl);
    if (!abs) return m;
    return pre + proxyUrl(abs) + post;
  });

  // Rewrite CSS url() in <style> tags and style attributes
  html = html.replace(/url\((["']?)([^"')]+)(["']?)\)/gi, (m, q1, u, q2) => {
    if (!isSafeToRewrite(u)) return m;
    const abs = resolveUrl(u, baseUrl);
    if (!abs) return m;
    return 'url(' + q1 + proxyUrl(abs) + q2 + ')';
  });

  // Inject a script to rewrite fetch/XHR and dynamic element src/href
  const inject = '<script>(function(){' +
    'var base=' + JSON.stringify(baseUrl) + ';' +
    'var prefix=' + JSON.stringify(PROXY_PREFIX) + ';' +
    'function px(u){try{if(!u||u.startsWith("data:")||u.startsWith("javascript:")||u.startsWith("mailto:")||u.startsWith("tel:")||u.startsWith("#")||u.startsWith("blob:"))return u;return prefix+encodeURIComponent(new URL(u,base).href);}catch(e){return u;}}' +
    'var F=window.fetch;if(F)window.fetch=function(i,o){try{if(typeof i==="string")i=px(i);else if(i&&i.url)i=new Request(px(i.url),i);}catch(e){}return F.call(this,i,o);};' +
    'var X=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{arguments[1]=px(u);}catch(e){}return X.apply(this,arguments);};' +
    'var S=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){if((n==="src"||n==="href"||n==="action")&&typeof v==="string")try{v=px(v);}catch(e){}return S.call(this,n,v);};' +
    '})();</script>';

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => m + inject);
  } else if (/<html[^>]*>/i.test(html)) {
    html = html.replace(/<html[^>]*>/i, (m) => m + inject);
  } else {
    html = inject + html;
  }

  return html;
}

function rewriteCss(css, baseUrl) {
  return css.replace(/url\((["']?)([^"')]+)(["']?)\)/gi, (m, q1, u, q2) => {
    if (!isSafeToRewrite(u)) return m;
    const abs = resolveUrl(u, baseUrl);
    if (!abs) return m;
    return 'url(' + q1 + proxyUrl(abs) + q2 + ')';
  });
}

export default async function proxyFetch(req) {
  try {
    // Parse the target URL from GET query param or POST body
    let targetUrl;
    if (req.method === 'GET') {
      const u = new URL(req.url);
      targetUrl = u.searchParams.get('url');
    } else {
      const body = await req.json().catch(() => ({}));
      targetUrl = body.url;
    }

    if (!targetUrl) return Response.json({ error: 'URL is required' }, { status: 400 });

    // Validate the URL
    let parsed;
    try { parsed = new URL(targetUrl); } catch { return Response.json({ error: 'Invalid URL' }, { status: 400 }); }

    if (!parsed.protocol.startsWith('http')) return Response.json({ error: 'Only http(s) URLs allowed' }, { status: 400 });
    if (isBlockedHost(parsed.hostname)) return Response.json({ error: 'Local/internal URLs not allowed' }, { status: 403 });

    // Fetch the target
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    const contentType = res.headers.get('content-type') || 'text/html';

    // Process based on content type
    if (contentType.includes('text/html')) {
      const body = await res.text();
      const output = rewriteHtml(body, targetUrl);
      return new Response(output, {
        status: res.status,
        headers: { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' },
      });
    } else if (contentType.includes('text/css')) {
      const body = await res.text();
      const output = rewriteCss(body, targetUrl);
      return new Response(output, {
        status: res.status,
        headers: { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' },
      });
    } else if (contentType.startsWith('text/') || contentType.includes('javascript') || contentType.includes('json') || contentType.includes('xml')) {
      // Pass through text content (JS, JSON, XML)
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' },
      });
    } else {
      // Binary content (images, fonts, etc.) — pass through as-is
      const body = await res.arrayBuffer();
      return new Response(body, {
        status: res.status,
        headers: { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' },
      });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}