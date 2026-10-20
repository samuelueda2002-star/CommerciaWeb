import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getCurrentUser, getFilialId, login } from '../api/auth';
import { clearAccessToken, getAccessToken, saveAccessToken, SESSION_EXPIRED_EVENT } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(() => Boolean(getAccessToken()));
  const [error, setError] = useState('');
  const generation = useRef(0);

  const signOut = useCallback(() => {
    generation.current += 1;
    clearAccessToken();
    setSession(null);
    setRestoring(false);
    setError('');
  }, []);

  useEffect(() => {
    const expire = () => {
      signOut();
      setError('Sua sessão expirou. Entre novamente.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, [signOut]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const controller = new AbortController();
    const current = generation.current;
    getCurrentUser(token, controller.signal).then((user) => {
      if (controller.signal.aborted || current !== generation.current) return;
      const filialId = getFilialId(user);
      setSession({ user, filialId });
    }).catch((failure) => {
      if (!controller.signal.aborted && failure.name !== 'AbortError' && current === generation.current) {
        clearAccessToken();
        setError(failure.message);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setRestoring(false);
    });
    return () => controller.abort();
  }, []);

  const signIn = async ({ username, password, remember }, signal) => {
    const current = ++generation.current;
    setError('');
    const token = await login(username, password, signal);
    const user = await getCurrentUser(token, signal);
    const filialId = getFilialId(user);
    if (signal?.aborted || current !== generation.current) return;
    saveAccessToken(token, remember);
    setSession({ user, filialId });
  };

  return <AuthContext.Provider value={{ session, restoring, error, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
