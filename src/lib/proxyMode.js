// proxyMode.js — manages the service worker for the Matcha proxy mode.
// The service worker intercepts requests from the proxied iframe to external
// URLs and routes them through the proxyFetch backend function.

let swRegistration = null;

export async function enableProxyMode() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Matcha Proxy] Service workers not supported');
    return false;
  }
  try {
    swRegistration = await navigator.serviceWorker.register('/functions/proxySw', { scope: '/' });
    await navigator.serviceWorker.ready;
    console.log('[Matcha Proxy] Service worker registered');
    return true;
  } catch (e) {
    console.warn('[Matcha Proxy] Service worker registration failed:', e);
    return false;
  }
}

export async function disableProxyMode() {
  if (!swRegistration) return;
  try {
    await swRegistration.unregister();
    swRegistration = null;
    console.log('[Matcha Proxy] Service worker unregistered');
  } catch (e) {
    console.warn('[Matcha Proxy] Service worker unregistration failed:', e);
  }
}

export function buildProxyUrl(targetUrl) {
  return '/functions/proxyFetch?url=' + encodeURIComponent(targetUrl);
}