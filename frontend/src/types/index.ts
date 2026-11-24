export type UserRole = 'consumer' | 'manager';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  lgpdConsentAt: string;
  createdAt: string;
}

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
  uploadedAt?: string;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface LifecycleAlert {
  id: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  type:
    | 'warranty_expiring'
    | 'warranty_expired'
    | 'lifespan_nearing_end'
    | 'lifespan_reached'
    | 'defective_ready_for_disposal';
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

export interface ElectronicProduct {
  id: string;
  userId: string;
  name: string;
  brand: string;
  category: ProductCategory;
  purchaseDate: string;
  warrantyMonths: number;
  estimatedLifespanMonths: number;
  condition: ProductCondition;
  notes?: string;
  receipt?: ReceiptAttachment | null;
  createdAt: string;
  updatedAt: string;
  lifecycle: ProductLifecycleStatus;
}

export interface InventorySummary {
  totalProducts: number;
  activeWarranties: number;
  expiringWarranties: number;
  nearingOrReachedEndOfLife: number;
  withReceiptCount: number;
}

export interface InventoryResponse {
  items: ElectronicProduct[];
  alerts: LifecycleAlert[];
  summary: InventorySummary;
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  smartphone: 'Smartphone / Celular',
  computer: 'Notebook / Computador',
  tv_monitor: 'TV / Monitor',
  appliance: 'Eletroportátil',
  battery_accessory: 'Pilhas / Baterias / Acessórios',
  other: 'Outro Eletrônico',
};

export const CATEGORY_DEFAULT_LIFESPAN: Record<ProductCategory, number> = {
  smartphone: 36,
  computer: 60,
  tv_monitor: 72,
  appliance: 48,
  battery_accessory: 24,
  other: 48,
};

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  in_use: 'Em uso normal',
  idle: 'Guardado / Sem uso',
  defective: 'Com defeito / Obsoleto',
};
