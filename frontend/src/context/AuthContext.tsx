import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthResponse, UserResponse } from '../types';
import * as authApi from '../api/authApi';
import { TOKEN_KEY, USER_KEY } from '../api/client';

interface AuthContextValue {
  token: string | null;
  user: UserResponse | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, displayName: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function readStoredUser(): UserResponse | null {
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? (JSON.parse(raw) as UserResponse) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserResponse | null>(readStoredUser);

  const applyAuth = useCallback((auth: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, auth.token);
    localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
    setToken(auth.token);
    setUser(auth.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      applyAuth(await authApi.login(email, password));
    },
    [applyAuth]
  );

  const signup = useCallback(
    async (email: string, displayName: string, password: string) => {
      applyAuth(await authApi.signup(email, displayName, password));
    },
    [applyAuth]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, login, signup, logout }),
    [token, user, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
