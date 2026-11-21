import {initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {doc, getDocFromServer, getFirestore} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const firebaseApp = app;
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatInventoryError(error: unknown, fallback: string): string {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  let innerMessage = rawMessage;

  try {
    const parsed = JSON.parse(rawMessage) as {error?: string};
    if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
      innerMessage = parsed.error;
    }
  } catch {
    // No es JSON de FirestoreErrorInfo; usar texto directo
  }

  const lower = innerMessage.toLowerCase();
  if (lower.includes('the client is offline') || lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Sin conexión con Firebase. Verifica tu internet e intenta de nuevo.';
  }
  if (lower.includes('unavailable') || lower.includes('deadline-exceeded')) {
    return 'No pudimos conectar con Firebase en este momento. Intenta de nuevo en unos segundos.';
  }
  if (lower.includes('missing or insufficient permissions') || lower.includes('permission-denied')) {
    return 'No tienes permisos en Firestore para guardar este cambio. Inicia sesión de nuevo.';
  }
  if (lower.includes('resource-exhausted') || lower.includes('quota')) {
    return 'Se alcanzó el límite temporal de consultas en Firestore. Intenta en unos segundos.';
  }

  return innerMessage.trim() || fallback;
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Por favor verifica tu configuración de Firebase (cliente sin conexión).');
    }
  }
}

void testConnection();
