import React, {createContext, useCallback, useContext, useState} from 'react';
import type {UserProfile} from '../types/inventory';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
}

interface RegisterPayload {
  fullName: string;
  businessName: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
  authToken: string | null;
  loginWithDemo: (username: string, password: string) => Promise<void>;
  registerDemoAccount: (payload: RegisterPayload) => Promise<void>;
  updateUserProfile: (data: {fullName: string; businessName: string}) => Promise<void>;
  logout: () => Promise<void>;
}

const DEMO_PROFILE_KEY = 'inventario_facil_demo_profile_v1';

function loadSavedDemoProfile(userId: string, email: string): UserProfile {
  const defaults: UserProfile = {
    userId,
    fullName: 'Alison Lara',
    businessName: 'Mi tienda de ropa',
    email,
    acceptedTermsAt: new Date().toISOString(),
  };
  try {
    const raw = window.localStorage.getItem(DEMO_PROFILE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      ...defaults,
      fullName: typeof parsed.fullName === 'string' && parsed.fullName.trim() ? parsed.fullName : defaults.fullName,
      businessName:
        typeof parsed.businessName === 'string' && parsed.businessName.trim()
          ? parsed.businessName
          : defaults.businessName,
    };
  } catch {
    return defaults;
  }
}

function saveDemoProfile(profile: UserProfile): void {
  try {
    window.localStorage.setItem(
      DEMO_PROFILE_KEY,
      JSON.stringify({
        fullName: profile.fullName,
        businessName: profile.businessName,
      }),
    );
  } catch {
    // Ignorar errores en modo privado de Safari
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading] = useState(false);

  const loginWithDemo = useCallback(async (username: string, password: string) => {
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      throw new Error('Ingresa tu usuario y contraseña.');
    }

    const res = await fetch('/api/demo-login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: cleanUser, password}),
    });

    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      user?: AppUser;
      error?: string;
    };

    if (!res.ok || !data.token || !data.user) {
      throw new Error(
        data.error || 'Usuario o contraseña incorrectos. Verifica tus datos e intenta de nuevo.',
      );
    }

    setAuthToken(data.token);
    setUser(data.user);
    setProfile(loadSavedDemoProfile(data.user.uid, data.user.email));
  }, []);

  const registerDemoAccount = useCallback(
    async ({fullName, businessName, email}: RegisterPayload) => {
      const demoUser: AppUser = {
        uid: 'demo_admin',
        email: email.trim() || 'admin@inventariofacil.demo',
        displayName: fullName.trim() || 'Alison Lara',
      };
      const nextProfile: UserProfile = {
        userId: demoUser.uid,
        fullName: fullName.trim() || 'Alison Lara',
        businessName: businessName.trim() || 'Mi tienda de ropa',
        email: demoUser.email,
        acceptedTermsAt: new Date().toISOString(),
      };
      saveDemoProfile(nextProfile);
      setUser(demoUser);
      setProfile(nextProfile);
    },
    [],
  );

  const updateUserProfile = useCallback(
    async (data: {fullName: string; businessName: string}) => {
      if (!user) return;
      const nextFullName = data.fullName.trim();
      const nextBusinessName = data.businessName.trim();
      setProfile((prev) => {
        const next: UserProfile = prev
          ? {...prev, fullName: nextFullName, businessName: nextBusinessName}
          : {
              userId: user.uid,
              fullName: nextFullName,
              businessName: nextBusinessName,
              email: user.email,
              acceptedTermsAt: new Date().toISOString(),
            };
        saveDemoProfile(next);
        return next;
      });
    },
    [user],
  );

  const logout = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authToken,
        loginWithDemo,
        registerDemoAccount,
        updateUserProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}
