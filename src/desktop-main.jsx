import React from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import Home from '@/pages/Home';
import { queryClientInstance } from '@/lib/query-client';
import { passwordVault } from '@/lib/passwordVault';
import '@/index.css';

invoke('ensure_data_folder').catch((error) => console.warn('Could not initialize Matcha data folder:', error));
window.addEventListener('pagehide', () => passwordVault.lock(), { once: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClientInstance}>
    <Home requirePermission={false} />
    <Toaster />
  </QueryClientProvider>,
);