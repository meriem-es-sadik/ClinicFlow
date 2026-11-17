import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth';
import { getStoredToken, setStoredToken, UNAUTHORIZED_EVENT } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => getStoredToken());
  const [initializing, setInitializing] = useState(true);

  // Restore the session on first load.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!getStoredToken()) {
        setInitializing(false);
        return;
      }
      try {
        const res = await authApi.me();
        if (!cancelled) setUser(res.data);
      } catch {
        if (!cancelled) {
          setStoredToken(null);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // The API client emits this event when a request is rejected with 401
  // (expired or revoked token). Clear the session so ProtectedRoute redirects.
  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
      setToken(null);
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    setStoredToken(res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      initializing,
      isAuthenticated: Boolean(user && token),
      isAdmin: user?.role === 'admin',
      login,
      logout,
    }),
    [user, token, initializing, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
