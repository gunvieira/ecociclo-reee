import {
  CollectionPoint,
  CollectionPointInput,
  ElectronicProduct,
  InventoryResponse,
  ProductCategory,
  ProductCondition,
  ReceiptAttachment,
  User,
  UserRole,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const TOKEN_KEY = 'ecociclo_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Ocorreu um erro na comunicação com o servidor.');
  }

  return data as T;
}

export interface AuthPayload {
  user: User;
  token: string;
  storageMode: 'firebase' | 'local';
}

export const api = {
  register(input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    lgpdConsent: boolean;
  }): Promise<AuthPayload> {
    return request<AuthPayload>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  login(input: { email: string; password: string }): Promise<AuthPayload> {
    return request<AuthPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  getMe(): Promise<{ user: User; storageMode: 'firebase' | 'local' }> {
    return request<{ user: User; storageMode: 'firebase' | 'local' }>('/auth/me');
  },

  listInventory(): Promise<InventoryResponse> {
    return request<InventoryResponse>('/products');
  },

  createProduct(input: {
    name: string;
    brand: string;
    category: ProductCategory;
    purchaseDate: string;
    warrantyMonths: number;
    estimatedLifespanMonths: number;
    condition: ProductCondition;
    notes?: string;
    receipt?: ReceiptAttachment | null;
  }): Promise<{ product: ElectronicProduct }> {
    return request<{ product: ElectronicProduct }>('/products', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateProduct(
    id: string,
    input: Partial<{
      name: string;
      brand: string;
      category: ProductCategory;
      purchaseDate: string;
      warrantyMonths: number;
      estimatedLifespanMonths: number;
      condition: ProductCondition;
      notes: string;
      receipt: ReceiptAttachment | null;
    }>
  ): Promise<{ product: ElectronicProduct }> {
    return request<{ product: ElectronicProduct }>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  deleteProduct(id: string): Promise<void> {
    return request<void>(`/products/${id}`, {
      method: 'DELETE',
    });
  },

  seedDemoProducts(): Promise<InventoryResponse> {
    return request<InventoryResponse>('/products/seed-demo', {
      method: 'POST',
    });
  },

  // ----- Parte 2: Pontos de Coleta (RF04, RF05 e RF12) -----

  listCollectionPoints(wasteType?: ProductCategory): Promise<{ items: CollectionPoint[] }> {
    const query = wasteType ? `?wasteType=${encodeURIComponent(wasteType)}` : '';
    return request<{ items: CollectionPoint[] }>(`/collection-points${query}`);
  },

  listMyCollectionPoints(): Promise<{ items: CollectionPoint[] }> {
    return request<{ items: CollectionPoint[] }>('/collection-points/mine');
  },

  createCollectionPoint(input: CollectionPointInput): Promise<{ point: CollectionPoint }> {
    return request<{ point: CollectionPoint }>('/collection-points', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateCollectionPoint(
    id: string,
    input: Partial<CollectionPointInput>
  ): Promise<{ point: CollectionPoint }> {
    return request<{ point: CollectionPoint }>(`/collection-points/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  deleteCollectionPoint(id: string): Promise<void> {
    return request<void>(`/collection-points/${id}`, {
      method: 'DELETE',
    });
  },
};
