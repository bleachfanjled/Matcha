import { base44 } from '@/api/base44Client';

// The existing scanner accepts a source URL and filename. It can recheck a
// download's origin, but it does not inspect bytes from the local file.
export async function scanDownloadSource(download) {
  if (!download?.url || !/^https?:\/\//i.test(download.url)) {
    throw new Error('This download has no web source to scan.');
  }
  const response = await base44.functions.invoke('scanDownload', {
    url: download.url,
    filename: download.name || 'download',
  });
  const result = response?.data || {};
  if (typeof result.safe !== 'boolean') {
    throw new Error(result.reason || result.error || 'The scanner did not return a result.');
  }
  return {
    scanStatus: result.safe ? 'safe' : 'unsafe',
    scanReason: String(result.reason || (result.safe ? 'Source passed the AI check.' : 'Source was flagged by the AI check.')).slice(0, 500),
    scannedAt: new Date().toISOString(),
  };
}
