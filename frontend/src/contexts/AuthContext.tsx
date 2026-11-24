import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getStoredToken, setStoredToken } from '../services/api';
import { User, UserRole } from '../types';

interface AuthContextValue {
  user: User | null;
  storageMode: 'firebase' | 'local';
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    lgpdConsent: boolean;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [storageMode, setStorageMode] = useState<'firebase' | 'local'>('local');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .getMe()
      .then((res) => {
        setUser(res.user);
        setStorageMode(res.storageMode);
      })
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setStoredToken(res.token);
    setUser(res.user);
    setStorageMode(res.storageMode);
  };

  const register = async (input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    lgpdConsent: boolean;
  }) => {
    const res = await api.register(input);
    setStoredToken(res.token);
    setUser(res.user);
    setStorageMode(res.storageMode);
  };

  const logout = () => {
    setStoredToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, storageMode, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return ctx;
}
