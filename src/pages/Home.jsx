import React from 'react';
import { ThemeProvider } from '@/lib/themeContext';
import PermissionGate from '@/components/PermissionGate';
import AppShell from '@/components/AppShell';

export default function Home({ requirePermission = true }) {
  return (
    <ThemeProvider>
      {requirePermission ? (
        <PermissionGate>
          <AppShell />
        </PermissionGate>
      ) : (
        <AppShell />
      )}
    </ThemeProvider>
  );
}