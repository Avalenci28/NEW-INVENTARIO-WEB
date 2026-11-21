import type {
  FcmDeviceToken,
  Movement,
  NotificationPreferences,
  Order,
  Product,
  Space,
} from '../types/inventory';

export interface DemoInventoryState {
  spaces: Space[];
  products: Product[];
  movements: Movement[];
  orders: Order[];
  fcmTokens: FcmDeviceToken[];
  notificationPrefs: NotificationPreferences;
}

const DEMO_STORE_KEY = 'inventario_facil_demo_store_v1';

let memoryFallback: DemoInventoryState | null = null;

export function getDefaultDemoState(userId: string): DemoInventoryState {
  return {
    spaces: [],
    products: [],
    movements: [],
    orders: [],
    fcmTokens: [],
    notificationPrefs: {
      userId,
      pushEnabled: typeof Notification !== 'undefined' && Notification.permission === 'granted',
      lowStockEnabled: true,
      expiringEnabled: true,
      expiryWarningDays: 7,
    },
  };
}

export function loadDemoStore(userId: string): DemoInventoryState {
  if (memoryFallback) return memoryFallback;
  try {
    const raw = window.localStorage.getItem(DEMO_STORE_KEY);
    if (!raw) {
      const fresh = getDefaultDemoState(userId);
      memoryFallback = fresh;
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<DemoInventoryState>;
    const defaults = getDefaultDemoState(userId);
    const loaded: DemoInventoryState = {
      spaces: Array.isArray(parsed.spaces) ? parsed.spaces : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      movements: Array.isArray(parsed.movements) ? parsed.movements : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      fcmTokens: Array.isArray(parsed.fcmTokens) ? parsed.fcmTokens : [],
      notificationPrefs: parsed.notificationPrefs
        ? {
            ...defaults.notificationPrefs,
            ...parsed.notificationPrefs,
            userId,
          }
        : defaults.notificationPrefs,
    };
    memoryFallback = loaded;
    return loaded;
  } catch {
    const fresh = getDefaultDemoState(userId);
    memoryFallback = fresh;
    return fresh;
  }
}

export function saveDemoStore(state: DemoInventoryState): void {
  memoryFallback = state;
  try {
    window.localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(state));
  } catch {
    // Respaldo en memoria si Safari privado restringe localStorage
  }
}

export function createDemoId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
