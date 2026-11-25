import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middlewares/authMiddleware';
import {
  DEFAULT_LIFESPAN_MONTHS,
  computeProductLifecycle,
  enrichProductsWithLifecycle,
} from '../services/lifecycleService';
import {
  createProductRecord,
  deleteProductRecord,
  getProductById,
  listProductsByUser,
  updateProductRecord,
} from '../services/storageService';
import {
  ElectronicProduct,
  ProductCategory,
  ProductCondition,
  ReceiptAttachment,
} from '../types/models';

export const productRouter = Router();

const VALID_CATEGORIES: ProductCategory[] = [
  'smartphone',
  'computer',
  'tv_monitor',
  'appliance',
  'battery_accessory',
  'other',
];

const VALID_CONDITIONS: ProductCondition[] = ['in_use', 'idle', 'defective'];

const ALLOWED_RECEIPT_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];

// Atenção: no Firestore o documento inteiro tem limite de 1 MiB, e o Base64 aumenta o
// arquivo em ~33%. Na prática, notas acima de ~700 KB falham no modo Firebase.
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB

function validateReceiptInput(
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

type ProductFields = Pick<
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
function sanitizeProductPayload(
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

productRouter.use(requireAuth);

// RF02 + RF03: Lista o Inventário Virtual enriquecido com alertas de garantia e vida útil
productRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const products = await listProductsByUser(userId);
    const enriched = enrichProductsWithLifecycle(products);
    res.json(enriched);
  } catch (err) {
    console.error('[List Products Error]', err);
    res.status(500).json({ error: 'Erro ao carregar o Inventário Virtual.' });
  }
});

// RF02: Cadastra um novo equipamento eletrônico no Inventário Virtual
productRouter.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const body = (req.body || {}) as Record<string, unknown>;

    const result = sanitizeProductPayload(body);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    const receiptCheck = validateReceiptInput(body.receipt);
    if (!receiptCheck.valid) {
      res.status(400).json({ error: receiptCheck.error });
      return;
    }

    const created = await createProductRecord({
      ...result.data,
      userId,
      receipt: receiptCheck.receipt ?? null,
    });

    res.status(201).json({
      product: {
        ...created,
        lifecycle: computeProductLifecycle(created),
      },
    });
  } catch (err) {
    console.error('[Create Product Error]', err);
    res.status(500).json({ error: 'Erro ao cadastrar produto no Inventário Virtual.' });
  }
});

// RF02: Atualiza dados de um equipamento eletrônico do usuário
productRouter.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const productId = String(req.params.id);

    const existing = await getProductById(productId);
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: 'Equipamento não encontrado no seu inventário.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;

    // Mescla com o registro atual para aceitar atualizações parciais
    const result = sanitizeProductPayload({ ...existing, ...body });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    const receiptCheck = validateReceiptInput(body.receipt);
    if (!receiptCheck.valid) {
      res.status(400).json({ error: receiptCheck.error });
      return;
    }

    const updated = await updateProductRecord(productId, {
      ...result.data,
      ...(receiptCheck.receipt !== undefined ? { receipt: receiptCheck.receipt } : {}),
    });

    if (!updated) {
      res.status(404).json({ error: 'Não foi possível atualizar o equipamento.' });
      return;
    }

    res.json({
      product: {
        ...updated,
        lifecycle: computeProductLifecycle(updated),
      },
    });
  } catch (err) {
    console.error('[Update Product Error]', err);
    res.status(500).json({ error: 'Erro ao atualizar equipamento.' });
  }
});

// RF02 + RNF03: Remove o equipamento e seus anexos (direito de exclusão LGPD)
productRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const productId = String(req.params.id);

    const existing = await getProductById(productId);
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: 'Equipamento não encontrado no seu inventário.' });
      return;
    }

    await deleteProductRecord(productId);
    res.status(204).send();
  } catch (err) {
    console.error('[Delete Product Error]', err);
    res.status(500).json({ error: 'Erro ao excluir equipamento.' });
  }
});

// Utilitário de demonstração acadêmica: popula 3 aparelhos para evidenciar todos os alertas (RF02 + RF03)
productRouter.post('/seed-demo', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const now = new Date();

    const formatRelativeMonths = (monthsOffset: number, daysOffset = 0): string => {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsOffset, now.getUTCDate() + daysOffset)
      );
      return d.toISOString().slice(0, 10);
    };

    const samples = [
      {
        userId,
        name: 'Smartphone Galaxy S23 256GB',
        brand: 'Samsung',
        category: 'smartphone' as ProductCategory,
        purchaseDate: formatRelativeMonths(-12, 14), // Garantia de 12m vencendo em ~14 dias!
        warrantyMonths: 12,
        estimatedLifespanMonths: 36,
        condition: 'in_use' as ProductCondition,
        notes: 'Aparelho principal de uso diário. Verificar saúde da bateria antes do fim da garantia.',
        receipt: null,
      },
      {
        userId,
        name: 'Notebook IdeaPad 3i Core i5',
        brand: 'Lenovo',
        category: 'computer' as ProductCategory,
        purchaseDate: formatRelativeMonths(-8, 0), // Saudável, em garantia e longe do fim de vida útil
        warrantyMonths: 12,
        estimatedLifespanMonths: 60,
        condition: 'in_use' as ProductCondition,
        notes: 'Utilizado nas aulas do IFPR (CAUF).',
        receipt: null,
      },
      {
        userId,
        name: 'Celular Moto G7 Antigo (Gaveta)',
        brand: 'Motorola',
        category: 'smartphone' as ProductCategory,
        purchaseDate: formatRelativeMonths(-44, 0), // Vida útil estimada (36m) já ultrapassada!
        warrantyMonths: 12,
        estimatedLifespanMonths: 36,
        condition: 'defective' as ProductCondition,
        notes: 'Tela trincada e bateria estufada — encaminhar para Ecoponto de REEE.',
        receipt: null,
      },
    ];

    for (const sample of samples) {
      await createProductRecord(sample);
    }

    const allProducts = await listProductsByUser(userId);
    res.status(201).json(enrichProductsWithLifecycle(allProducts));
  } catch (err) {
    console.error('[Seed Demo Error]', err);
    res.status(500).json({ error: 'Erro ao gerar equipamentos de demonstração.' });
  }
});
