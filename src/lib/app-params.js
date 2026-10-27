import { getAccessToken } from '@base44/sdk';

const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
	!isNode && new URLSearchParams(window.location.search).get("clear_access_token") === 'true';

const clearStoredAccessToken = () => {
	window.localStorage.removeItem('base44_access_token');
	window.localStorage.removeItem('token');
}

const getAppParams = () => {
	if (isClearAccessTokenRequested()) {
		clearStoredAccessToken();
	}
	const appId = import.meta.env.VITE_BASE44_APP_ID || '6ac98e2d78f3aeeb4ce7213b';
	const appBaseUrl = import.meta.env.VITE_BASE44_APP_BASE_URL || 'https://matcha-browser.base44.app';
	const localRuntime = !isNode && (window.__TAURI__ || window.__TAURI_INTERNALS__ || !/^https?:$/.test(window.location.protocol) || ['localhost', '127.0.0.1', 'tauri.localhost'].includes(window.location.hostname));
	const serverUrl = import.meta.env.VITE_BASE44_SERVER_URL || (localRuntime ? appBaseUrl : '');
	const functionsVersion = import.meta.env.VITE_BASE44_FUNCTIONS_VERSION;

	// Graceful fallback: warn in the dev console when env vars are missing
	// (e.g. running locally outside the Base44 dashboard). The UI stays
	// operational — backend calls fail gracefully via try/catch in each
	// component, showing user-friendly messages instead of crashing.
	if (!appId) {
		console.warn(
			'%c[Matcha] VITE_BASE44_APP_ID is missing. Backend AI features will not work outside the Base44 dashboard. Create a .env file with VITE_BASE44_APP_ID, VITE_BASE44_APP_BASE_URL, and VITE_BASE44_FUNCTIONS_VERSION to enable them locally.',
			'color: #e0a030; font-weight: 600;'
		);
	}

	return {
		appId: appId || 'FALLBACK_ID_IF_MISSING',
		token: getAccessToken(),
		functionsVersion,
		appBaseUrl,
		serverUrl,
	}
}


export const appParams = {
	...getAppParams()
}