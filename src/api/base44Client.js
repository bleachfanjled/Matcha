import '@/lib/tauriFetchProxy'; // Must run before SDK import — overrides fetch in Tauri
import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl, serverUrl } = appParams;

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl,
  appBaseUrl
});