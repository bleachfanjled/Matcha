// proxySw — serves the service worker JavaScript with the correct MIME type
// and Service-Worker-Allowed header so it can register with scope '/'.
// The service worker intercepts requests from the proxied iframe to external
// URLs and routes them through the proxyFetch backend function.

export default async function proxySw() {
  const swCode = [
    '// proxy-sw.js — service worker for Matcha proxy mode.',
    'self.addEventListener("install", (e) => self.skipWaiting());',
    'self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));',
    'self.addEventListener("fetch", (event) => {',
    '  var req = event.request;',
    '  var url;',
    '  try { url = new URL(req.url); } catch (e) { return; }',
    '  if (url.origin === self.location.origin) return;',
    '  if (!url.protocol.startsWith("http")) return;',
    '  var referer = req.headers.get("referer") || "";',
    '  if (!referer.includes("/functions/proxyFetch")) return;',
    '  var proxyUrl = "/functions/proxyFetch?url=" + encodeURIComponent(req.url);',
    '  event.respondWith(fetch(proxyUrl));',
    '});',
  ].join('\n');

  return new Response(swCode, {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache',
    },
  });
}