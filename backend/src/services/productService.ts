import { DEFAULT_LIFESPAN_MONTHS } from './lifecycleService';
import {
  ElectronicProduct,
  ProductCategory,
  ProductCondition,
  ReceiptAttachment,
} from '../types/models';

export const VALID_CATEGORIES: ProductCategory[] = [
  'smartphone',
  'computer',
  'tv_monitor',
  'appliance',
  'battery_accessory',
  'other',
];

export const VALID_CONDITIONS: ProductCondition[] = ['in_use', 'idle', 'defective'];

export const ALLOWED_RECEIPT_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];

// Atenção: no Firestore o documento inteiro tem limite de 1 MiB, e o Base64 aumenta o
// arquivo em ~33%. Na prática, notas acima de ~700 KB falham no modo Firebase.
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateReceiptInput(
  rawReceipt: unknown
): { valid: true; receipt: ReceiptAttachment | null | undefined } | { valid: false; error: string } {
  if (rawReceipt === undefined) return { valid: true, receipt: undefined };
  if (rawReceipt === null) return { valid: true, receipt: null };

  const candidate = rawReceipt as Partial<ReceiptAttachment>;
  if (
    typeof candidate.fileName !== 'string' ||
    typeof candidate.mimeType !== 'string' ||
    typeof candidate.dataUrl !== 'string' ||
    !candidate.fileName
  ) {
    return { valid: false, error: 'Formato do anexo de Nota Fiscal inválido.' };
  }

  if (!ALLOWED_RECEIPT_MIMES.includes(candidate.mimeType)) {
    return {
      valid: false,
      error: 'A Nota Fiscal deve estar em formato PNG, JPG, WEBP ou PDF.',
    };
  }

  const prefix = `data:${candidate.mimeType};base64,`;
  if (!candidate.dataUrl.startsWith(prefix)) {
    return { valid: false, error: 'Conteúdo codificado da Nota Fiscal inválido.' };
  }

  // O tamanho é medido no próprio conteúdo; o sizeBytes enviado pelo cliente é ignorado
  const sizeBytes = Buffer.byteLength(candidate.dataUrl.slice(prefix.length), 'base64');
  if (sizeBytes === 0) {
    return { valid: false, error: 'O arquivo da Nota Fiscal está vazio.' };
  }
  if (sizeBytes > MAX_RECEIPT_BYTES) {
    return { valid: false, error: 'O arquivo da Nota Fiscal deve ter no máximo 5 MB.' };
  }

  return {
    valid: true,
    receipt: {
      fileName: candidate.fileName.slice(0, 120),
      mimeType: candidate.mimeType,
      sizeBytes,
      dataUrl: candidate.dataUrl,
      uploadedAt: new Date().toISOString(),
    },
  };
}

export type ProductFields = Pick<
  ElectronicProduct,
  | 'name'
  | 'brand'
  | 'category'
  | 'purchaseDate'
  | 'warrantyMonths'
  | 'estimatedLifespanMonths'
  | 'condition'
  | 'notes'
>;

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Rejeita datas inexistentes como 2025-02-30, que o Date "corrige" silenciosamente
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function optionalInt(value: unknown, min: number, max: number): number | null | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
}

// Validação única usada no cadastro e na edição de equipamentos (RF02)
export function sanitizeProductPayload(
  raw: Record<string, unknown>
): { ok: true; data: ProductFields } | { ok: false; error: string } {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name.length < 2) {
    return { ok: false, error: 'Informe o nome ou modelo do equipamento eletrônico.' };
  }

  if (!isValidIsoDate(raw.purchaseDate)) {
    return { ok: false, error: 'Informe uma data de compra válida (AAAA-MM-DD).' };
  }

  if (raw.category !== undefined && !VALID_CATEGORIES.includes(raw.category as ProductCategory)) {
    return { ok: false, error: 'Categoria de equipamento inválida.' };
  }
  const category = (raw.category as ProductCategory | undefined) ?? 'other';

  if (raw.condition !== undefined && !VALID_CONDITIONS.includes(raw.condition as ProductCondition)) {
    return { ok: false, error: 'Estado de conservação inválido.' };
  }
  const condition = (raw.condition as ProductCondition | undefined) ?? 'in_use';

  const warrantyMonths = optionalInt(raw.warrantyMonths, 0, 120);
  if (warrantyMonths === null) {
    return { ok: false, error: 'A garantia deve estar entre 0 e 120 meses.' };
  }

  const estimatedLifespanMonths = optionalInt(raw.estimatedLifespanMonths, 6, 240);
  if (estimatedLifespanMonths === null) {
    return { ok: false, error: 'A vida útil estimada deve estar entre 6 e 240 meses.' };
  }

  const brand = typeof raw.brand === 'string' ? raw.brand.trim() : '';
  const notes = typeof raw.notes === 'string' ? raw.notes.trim() : '';

  return {
    ok: true,
    data: {
      name: name.slice(0, 120),
      brand: (brand || 'Não informada').slice(0, 60),
      category,
      purchaseDate: raw.purchaseDate,
      warrantyMonths: warrantyMonths ?? 12,
      estimatedLifespanMonths: estimatedLifespanMonths ?? DEFAULT_LIFESPAN_MONTHS[category],
      condition,
      notes: notes.slice(0, 1000),
    },
  };
}
