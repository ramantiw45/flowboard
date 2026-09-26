import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UserResponse } from '../types';
import * as authApi from '../api/authApi';
import { purgeLegacySession, setSessionLostHandler } from '../api/client';

interface AuthContextValue {
  /**
   * Whether a session exists. Note this is a boolean, not a token: the access
   * token is HttpOnly and therefore not readable here, which is the point.
   */
  authenticated: boolean;
  user: UserResponse | null;
  /**
   * True until the initial /auth/me (or /auth/refresh) has settled. Routes
   * behind ProtectedRoute must wait for this, otherwise a reload would bounce
   * a signed-in user to the login screen for a few milliseconds.
   */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /**
   * Resolves to true when an account was actually created, false when the
   * address was already registered (the server will not say which). Both
   * resolve rather than reject, because the caller cannot tell the difference.
   */
  signup: (email: string, displayName: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // A token left in localStorage by an older build is a live credential that
  // this change exists to remove, so it is deleted rather than ignored.
  useEffect(() => {
    purgeLegacySession();
  }, []);

  /**
   * Restores a session on load from the cookie.
   *
   * `/auth/me` is tried first because it is the cheap case: an access token
   * that has not expired answers immediately and no token is spent. Only if
   * that fails is `/auth/refresh` attempted, which renews the access token from
   * the refresh cookie. Trying refresh first would burn a single-use refresh
   * token on every single page load.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // One `finally` for the whole bootstrap, so `loading` is always cleared.
      // An early `return` on the happy path used to skip it, which left
      // ProtectedRoute on its spinner forever - caught in a real browser, where
      // a signed-in reload never got past the loading state.
      try {
        try {
          const current = await authApi.me();
          if (!cancelled) setUser(current);
          return;
        } catch {
          // No valid access token; fall through to the refresh attempt.
        }
        try {
          const renewed = await authApi.refresh();
          if (!cancelled) setUser(renewed.user);
        } catch {
          // No session at all. This is the normal signed-out path, not an error.
          if (!cancelled) setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The interceptor owns the hard-failure path (refresh failed -> wipe state).
  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    return () => setSessionLostHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const auth = await authApi.login(email, password);
    setUser(auth.user);
  }, []);

  const signup = useCallback(
    async (email: string, displayName: string, password: string) => {
      const auth = await authApi.signup(email, displayName, password);
      // A null user means the address was already registered, and the server
      // issued no session cookie. There is nothing to store, and pretending
      // otherwise would strand the person on an empty board.
      if (!auth.user) return false;
      setUser(auth.user);
      return true;
    },
    []
  );

  const logout = useCallback(async () => {
    // Clear local state first: the user asked to be signed out, so the UI must
    // reflect that even if the network call fails. The server-side revocation
    // is best-effort from here, but it is what makes a stolen refresh token
    // useless, so a failure is worth surfacing in the console rather than
    // silently swallowed.
    setUser(null);
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Server-side sign-out failed; the session cookie may still be valid', err);
    }
  }, []);

  const value = useMemo(
    () => ({ authenticated: user !== null, user, loading, login, signup, logout }),
    [user, loading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
