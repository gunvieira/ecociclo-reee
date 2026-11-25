export type UserRole = 'consumer' | 'manager';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash?: string;
  lgpdConsentAt: string;
  createdAt: string;
}

export type PublicUser = Omit<UserRecord, 'passwordHash'>;

export type ProductCategory =
  | 'smartphone'
  | 'computer'
  | 'tv_monitor'
  | 'appliance'
  | 'battery_accessory'
  | 'other';

export type ProductCondition = 'in_use' | 'idle' | 'defective';

export interface ReceiptAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  uploadedAt: string;
}

export interface ElectronicProduct {
  id: string;
  userId: string;
  name: string;
  brand: string;
  category: ProductCategory;
  purchaseDate: string; // YYYY-MM-DD
  warrantyMonths: number;
  estimatedLifespanMonths: number;
  condition: ProductCondition;
  notes?: string;
  receipt?: ReceiptAttachment | null;
  createdAt: string;
  updatedAt: string;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertType =
  | 'warranty_expiring'
  | 'warranty_expired'
  | 'lifespan_nearing_end'
  | 'lifespan_reached'
  | 'defective_ready_for_disposal';

export interface LifecycleAlert {
  id: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  daysRemaining: number;
  targetDate: string;
}

export interface ProductLifecycleStatus {
  warrantyEndDate: string;
  warrantyDaysRemaining: number;
  warrantyStatus: 'active' | 'expiring_soon' | 'expired';
  lifespanEndDate: string;
  lifespanDaysRemaining: number;
  lifespanProgressPercent: number;
  lifespanStatus: 'healthy' | 'nearing_end' | 'reached';
  alerts: LifecycleAlert[];
}

export interface ProductWithLifecycle extends ElectronicProduct {
  lifecycle: ProductLifecycleStatus;
}

// ============================================================================
// PARTE 2 — Pontos de Coleta / Ecopontos (RF04, RF05 e RF12)
// ============================================================================

// Os tipos de resíduo aceitos reutilizam as categorias do Inventário Virtual,
// permitindo cruzar "meu aparelho" com "pontos que aceitam este aparelho".
export type WasteType = ProductCategory;

export interface CollectionPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  acceptedWasteTypes: WasteType[];
  openingHours: string;
  phone: string;
  description: string;
  managerId: string;
  managerName: string;
  isActive: boolean;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}
