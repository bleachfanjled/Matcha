import { invoke, isTauri } from '@tauri-apps/api/core';
import { normalizeAddress, viewerBounds } from './components/desktop/navigation.js';
const address = document.getElementById('address-bar');
const go = document.getElementById('go-btn');
const back = document.getElementById('back-btn');
const placeholder = document.getElementById('guest-placeholder');
const status = document.getElementById('toolbar-status');
let navigating = false, polling = false, stopped = false;
function notice(text = '') { status.textContent = text; status.hidden = !text; }
async function syncAddress() {
  if (polling || navigating || stopped || !isTauri()) return;
  polling = true;
  try {
    const url = await invoke('get_browser_url');
    if (url && url !== 'about:blank' && document.activeElement !== address && !navigating) address.value = url;
  } catch (error) { notice(String(error)); }
  finally { polling = false; }
}
let resizeFrame = 0;
function resizeBrowserView() {
  if (!isTauri() || !placeholder.hidden || resizeFrame) return;
  resizeFrame = requestAnimationFrame(async () => {
    resizeFrame = 0;
    try { await invoke('resize_browser_webview', viewerBounds()); }
    catch (error) { notice(`Unable to resize page: ${String(error)}`); }
  });
}
const resizeObserver = new ResizeObserver(resizeBrowserView);
resizeObserver.observe(document.getElementById('control-bar'));
window.addEventListener('resize', resizeBrowserView);
document.getElementById('address-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (navigating) return;
  navigating = true; go.disabled = true; back.disabled = true; go.textContent = 'Opening…'; notice();
  try {
    const url = normalizeAddress(address.value);
    if (!url) return;
    await invoke('navigate_browser', { url, ...viewerBounds() });
    placeholder.hidden = true; address.value = url;
  } catch (error) { notice(`Unable to open page: ${String(error)}`); }
  finally { navigating = false; go.disabled = !isTauri(); back.disabled = placeholder.hidden !== true; go.textContent = 'Go'; }
});
back.addEventListener('click', async () => {
  back.disabled = true;
  try { await invoke('go_back'); await syncAddress(); }
  catch (error) { notice(`Unable to go back: ${String(error)}`); }
  finally { back.disabled = navigating || !placeholder.hidden; }
});
const timer = setInterval(syncAddress, 1000);
window.addEventListener('pagehide', () => {
  stopped = true;
  clearInterval(timer);
  resizeObserver.disconnect();
  window.removeEventListener('resize', resizeBrowserView);
}, { once: true });
if (!isTauri()) { go.disabled = true; notice('Open this shell in the desktop app to browse.'); }