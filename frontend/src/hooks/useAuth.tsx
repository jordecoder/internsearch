import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as api from '@/lib/api';

interface AuthState {
  username: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (password: string) => Promise<void>;
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

  const login = async (password: string) => {
    const res = await api.login(password);
    api.saveToken(res.access_token);
    setState({ username: res.username, loading: false });
  };

  const logout = () => {
    api.clearToken();
    setState({ username: null, loading: false });
  };

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
