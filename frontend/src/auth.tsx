import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { api } from './api';

export interface Me {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  locale: string;
  role: 'OWNER' | 'MEMBER';
  householdId: string;
}

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    displayName: string;
    householdName?: string;
    invitationToken?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  passkeyLogin: (email: string) => Promise<void>;
  updateMe: (dto: {
    displayName?: string;
    avatarUrl?: string | null;
    locale?: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Me>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await api.post<Me>('/auth/login', { email, password }));
  }, []);

  const register = useCallback(
    async (data: Parameters<AuthState['register']>[0]) => {
      setUser(await api.post<Me>('/auth/register', data));
    },
    [],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
  }, []);

  /** Connexion passkey : options → cérémonie biométrique → vérification. */
  const passkeyLogin = useCallback(async (email: string) => {
    const options = await api.post<PublicKeyCredentialRequestOptionsJSON>(
      '/auth/webauthn/login-options',
      { email },
    );
    const assertion = await startAuthentication({ optionsJSON: options });
    setUser(
      await api.post<Me>('/auth/webauthn/login-verify', {
        email,
        response: assertion,
      }),
    );
  }, []);

  const updateMe = useCallback(
    async (dto: Parameters<AuthState['updateMe']>[0]) => {
      setUser(await api.patch<Me>('/users/me', dto));
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, passkeyLogin, updateMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}
