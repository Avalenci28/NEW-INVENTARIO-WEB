import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {doc, getDoc, serverTimestamp, setDoc, updateDoc} from 'firebase/firestore';
import {auth, db, googleProvider, handleFirestoreError, OperationType} from '../lib/firebase';
import type {UserProfile} from '../types/inventory';

interface RegisterPayload {
  fullName: string;
  businessName: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (payload: RegisterPayload) => Promise<void>;
  loginWithGoogle: (businessNameOverride?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: {fullName: string; businessName: string}) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function mapAuthErrorMessage(error: unknown): string {
  const code = (error as {code?: string})?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta registrada con este correo.';
    case 'auth/invalid-email':
      return 'Ingresa un correo electrónico válido.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 8 caracteres.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos seguidos. Espera unos minutos e intenta de nuevo.';
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana de Google antes de completar el ingreso.';
    case 'auth/operation-not-allowed':
      return 'El inicio de sesión con correo/contraseña aún no está habilitado en Firebase Console. Usa "Continuar con Google" o actívalo en Authentication > Sign-in method.';
    case 'auth/network-request-failed':
      return 'Sin conexión a internet. Revisa tu red e intenta nuevamente.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'No pudimos completar la autenticación. Intenta de nuevo.';
  }
}

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrCreateProfile = useCallback(
    async (firebaseUser: User, defaults?: {fullName?: string; businessName?: string}) => {
      const path = `users/${firebaseUser.uid}`;
      const ref = doc(db, path);
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
          return;
        }

        const newProfile: UserProfile = {
          userId: firebaseUser.uid,
          fullName: defaults?.fullName || firebaseUser.displayName || 'Alison Lara',
          businessName: defaults?.businessName || 'Mi tienda de ropa',
          email: firebaseUser.email || 'usuario@tienda.co',
          acceptedTermsAt: new Date().toISOString(),
        };

        await setDoc(ref, {
          ...newProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setProfile(newProfile);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path);
      }
    },
    [],
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          await loadOrCreateProfile(firebaseUser);
        } catch {
          // Error ya reportado por handleFirestoreError
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [loadOrCreateProfile]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const registerWithEmail = useCallback(
    async ({fullName, businessName, email, password}: RegisterPayload) => {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, {displayName: fullName.trim()});

      const path = `users/${cred.user.uid}`;
      const newProfile: UserProfile = {
        userId: cred.user.uid,
        fullName: fullName.trim(),
        businessName: businessName.trim(),
        email: email.trim(),
        acceptedTermsAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, path), {
          ...newProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setProfile(newProfile);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }

      try {
        await sendEmailVerification(cred.user);
      } catch {
        // Opcional: no bloquear si el entorno restringe el envío de correo
      }
    },
    [],
  );

  const loginWithGoogle = useCallback(
    async (businessNameOverride?: string) => {
      const result = await signInWithPopup(auth, googleProvider);
      await loadOrCreateProfile(result.user, {
        fullName: result.user.displayName || 'Mi cuenta',
        businessName: businessNameOverride || 'Mi tienda de ropa',
      });
    },
    [loadOrCreateProfile],
  );

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const updateUserProfile = useCallback(
    async (data: {fullName: string; businessName: string}) => {
      if (!user) return;
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, path), {
          fullName: data.fullName.trim(),
          businessName: data.businessName.trim(),
          updatedAt: serverTimestamp(),
        });
        setProfile((prev) =>
          prev
            ? {...prev, fullName: data.fullName.trim(), businessName: data.businessName.trim()}
            : null,
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user],
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        resetPassword,
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
