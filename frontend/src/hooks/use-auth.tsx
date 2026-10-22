'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';

const defaultUser: User = {
  id: 'owner',
  username: 'owner',
  full_name: 'Business Owner',
  email: 'owner@walmus.local',
  is_active: true,
  created_at: new Date().toISOString(),
};

interface AuthContextType {
  user: User;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: defaultUser,
  isAuthenticated: true,
  isLoading: false,
  login: async () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <AuthContext.Provider
      value={{
        user: defaultUser,
        isAuthenticated: true,
        isLoading: false,
        login: async () => {
          router.push('/dashboard');
        },
        logout: () => {
          router.push('/dashboard');
        },
        refreshUser: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}