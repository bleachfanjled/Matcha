// Lightweight typo correction for the address bar: if a typed domain looks
// like a misspelling of a popular site, suggest it ("Did you mean youtube.com?"
// for "yotuube.com"). All local, no network.

const POPULAR = [
  'google.com', 'youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'reddit.com', 'wikipedia.org', 'amazon.com', 'github.com', 'netflix.com', 'linkedin.com',
  'tiktok.com', 'yahoo.com', 'bing.com', 'duckduckgo.com', 'gmail.com', 'outlook.com',
  'pinterest.com', 'twitch.tv', 'spotify.com', 'ebay.com', 'weather.com', 'imdb.com',
  'stackoverflow.com', 'medium.com', 'quora.com', 'discord.com', 'zoom.us', 'dropbox.com',
  'apple.com', 'microsoft.com', 'openai.com', 'chatgpt.com', 'claude.ai', 'whatsapp.com',
];

export function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, prevDiag + cost);
      prevDiag = tmp;
    }
  }
  return prev[n];
}

// Returns a suggested popular domain if `input` looks like a typo, else null.
export function suggestTypo(input) {
  const t = (input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  const host = t.split(/[/?#]/)[0];
  if (!host || host.length < 4) return null;
  if (POPULAR.includes(host)) return null;
  let best = null;
  let bestDist = 99;
  for (const p of POPULAR) {
    if (Math.abs(p.length - host.length) > 3) continue;
    const d = levenshtein(host, p);
    if (d > 0 && d <= 2 && d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}