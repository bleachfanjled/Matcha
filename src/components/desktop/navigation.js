export function normalizeAddress(input) {
  const value = input.trim();
  if (!value) return null;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value) || /^(javascript|data|file|blob|vbscript):/i.test(value)) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS addresses are allowed.');
    return url.href;
  }
  if (!/\s/.test(value) && /^(localhost|(?:[\w-]+\.)+[\w-]+)(?::\d+)?(?:[/?#]|$)/i.test(value)) return new URL(`https://${value}`).href;
  return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`;
}
export function viewerBounds() {
  const rect = document.getElementById('guest-placeholder').getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: Math.max(1, rect.width), height: Math.max(1, rect.height), radius: 18 };
}