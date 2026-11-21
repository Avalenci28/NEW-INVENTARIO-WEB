export type GarmentCategory =
  | 'camiseta'
  | 'jean'
  | 'pantalón'
  | 'buzo'
  | 'gorra'
  | 'zapatos'
  | 'accesorio'
  | 'otro';

export type SpaceType = 'estante' | 'bodega' | 'vitrina' | 'otro';

export type SpaceColor = '#1F69FC' | '#EF8D2A' | '#24B570' | '#16A297' | '#5C7B98';

export interface UserProfile {
  userId: string;
  fullName: string;
  businessName: string;
  email: string;
  acceptedTermsAt: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Space {
  id: string;
  userId: string;
  name: string;
  type: SpaceType;
  color: SpaceColor;
  location: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Product {
  id: string;
  userId: string;
  spaceId: string;
  name: string;
  category: GarmentCategory;
  size: string;
  color: string;
  quantity: number;
  minStock: number;
  autoMinStock: boolean;
  barcode: string;
  imageUrl: string;
  aiRecognized: boolean;
  expiresAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Movement {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  spaceId: string;
  type: 'entrada' | 'salida';
  quantity: number;
  note: string;
  occurredAt: string;
  createdAt?: unknown;
}

export interface OrderItem {
  productId: string;
  productName: string;
  size: string;
  category: GarmentCategory;
  currentQty: number;
  suggestedQty: number;
  finalQty: number;
}

export interface Order {
  id: string;
  userId: string;
  status: 'borrador' | 'enviado' | 'recibido';
  items: OrderItem[];
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AbcClass = 'A' | 'B' | 'C';

export interface AbcProductStats {
  product: Product;
  sold30d: number;
  dailySales: number;
  abcClass: AbcClass;
  frequencyLabel: string;
  daysRemaining: number | null;
  suggestedQty: number;
}

export type AlertSeverity =
  | 'agotado'
  | 'bajo_minimo'
  | 'se_acaba_pronto'
  | 'caducada'
  | 'proxima_a_caducar';

export interface LowStockAlertItem {
  product: Product;
  spaceName: string;
  severity: AlertSeverity;
  abcClass: AbcClass;
  sold30d: number;
  daysRemaining: number | null;
  expiresInDays: number | null;
  suggestedQty: number;
  contextText: string;
  urgencyScore: number;
}

export interface FcmDeviceToken {
  id: string;
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceLabel: string;
  enabled: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationPreferences {
  userId: string;
  pushEnabled: boolean;
  lowStockEnabled: boolean;
  expiringEnabled: boolean;
  expiryWarningDays: number;
  updatedAt?: unknown;
}
