'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/hooks/use-auth';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </AuthProvider>
  );
}