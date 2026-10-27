export function requestError(error) {
  if (error?.response?.status === 401 || error?.status === 401) return 'Please sign in to use search and AI.';
  if (error?.response?.data?.error) return String(error.response.data.error);
  if (error?.message === 'Network Error' || error?.code === 'ERR_NETWORK') return 'Cannot reach the online service. Check your connection; desktop builds also need permission to access https://matcha-browser.base44.app. If using a local Tauri origin, try packaging the published site as the app window.';
  return error?.message || 'The online service did not respond. Please try again.';
}