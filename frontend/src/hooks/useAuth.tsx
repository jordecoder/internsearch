import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as api from '@/lib/api';

interface AuthState {
  username: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, inviteCode: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ username: null, loading: true });

  useEffect(() => {
    if (!api.getToken()) {
      setState({ username: null, loading: false });
      return;
    }
    api
      .me()
      .then((r) => setState({ username: r.username, loading: false }))
      .catch(() => setState({ username: null, loading: false }));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password);
    api.saveToken(res.access_token);
    setState({ username: res.username, loading: false });
  };

  const register = async (username: string, password: string, inviteCode: string) => {
    await api.register(username, password, inviteCode);
    await login(username, password);
  };

  const logout = () => {
    api.clearToken();
    setState({ username: null, loading: false });
  };

  return <AuthContext.Provider value={{ ...state, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
