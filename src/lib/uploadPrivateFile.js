import { appParams } from '@/lib/app-params';

// The Base44 SDK upload helper does not expose upload progress. This uses the
// same private-file endpoint and app credentials so the composer can report
// real network progress without buffering a second copy of the file.
/** @param {File} file @param {(progress: number) => void} [onProgress] */
export function uploadPrivateFile(file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const appId = String(appParams.appId || '');
    if (!appId) { reject(new Error('File upload is not configured for this app.')); return; }
    const base = String(appParams.serverUrl || '').replace(/\/$/, '');
    const request = new XMLHttpRequest();
    request.open('POST', `${base}/api/apps/${encodeURIComponent(appId)}/integration-endpoints/Core/UploadPrivateFile`);
    request.setRequestHeader('Accept', 'application/json');
    request.setRequestHeader('X-App-Id', appId);
    request.setRequestHeader('X-Origin-URL', window.location.href);
    if (appParams.token) request.setRequestHeader('Authorization', `Bearer ${appParams.token}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    request.onerror = () => reject(new Error('The attachment upload could not reach Matcha Air.'));
    request.onabort = () => reject(new Error('The attachment upload was cancelled.'));
    request.onload = () => {
      let result = {};
      try { result = JSON.parse(request.responseText || '{}'); } catch { /* use a readable status below */ }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(result?.error?.message || result?.message || `Upload failed (${request.status}).`));
        return;
      }
      if (!result.file_uri) { reject(new Error('The upload did not return a private file.')); return; }
      onProgress(100);
      resolve(result);
    };
    const form = new FormData();
    form.append('file', file, file.name);
    request.send(form);
  });
}
