// Detects whether a string looks like a URL (vs. a search query) and
// normalizes it to a fully-qualified URL for navigation.

const DANGEROUS_SCHEMES = /^(javascript|data|file|blob|vbscript|about):/i;

// Explicitly reject dangerous schemes from address-bar navigation.
export function isDangerousScheme(s) {
  return DANGEROUS_SCHEMES.test((s || '').trim());
}

// Schemeless domain with optional port, path, query, fragment.
const BARE_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]{2,})+(:\d+)?([/?#].*)?$/i;

export function looksLikeUrl(s) {
  const t = (s || '').trim();
  if (!t || /\s/.test(t)) return false;
  if (isDangerousScheme(t)) return false;
  if (/^(https?:\/\/|matcha:\/\/)/i.test(t)) return true;
  return BARE_DOMAIN.test(t);
}

export function normalizeUrl(s) {
  const t = (s || '').trim();
  if (isDangerousScheme(t)) return null;
  if (/^(https?:\/\/|matcha:\/\/)/i.test(t)) return t;
  return 'https://' + t;
}

const DL_EXT = /\.(exe|dmg|msi|pkg|apk|deb|rpm|zip|rar|7z|tar|gz|bz2|xz|bat|sh|cmd|ps1|jar|dll|scr|com|vbs)$/i;
export function looksLikeDownload(url) {
  try { return DL_EXT.test(new URL(url).pathname); } catch { return false; }
}