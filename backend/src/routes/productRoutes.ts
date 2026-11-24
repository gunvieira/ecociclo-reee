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

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB

function validateReceiptInput(
  rawReceipt: unknown
): { valid: true; receipt: ReceiptAttachment | null | undefined } | { valid: false; error: string } {
  if (rawReceipt === undefined) return { valid: true, receipt: undefined };
  if (rawReceipt === null) return { valid: true, receipt: null };

  const candidate = rawReceipt as Partial<ReceiptAttachment>;
  if (
    !candidate.fileName ||
    !candidate.mimeType ||
    !candidate.dataUrl ||
    typeof candidate.sizeBytes !== 'number'
  ) {
    return { valid: false, error: 'Formato do anexo de Nota Fiscal inválido.' };
  }

  if (!ALLOWED_RECEIPT_MIMES.includes(candidate.mimeType)) {
    return {
      valid: false,
      error: 'A Nota Fiscal deve estar em formato PNG, JPG, WEBP ou PDF.',
    };
  }

  if (candidate.sizeBytes > MAX_RECEIPT_BYTES) {
    return { valid: false, error: 'O arquivo da Nota Fiscal deve ter no máximo 5 MB.' };
  }

  if (!candidate.dataUrl.startsWith(`data:${candidate.mimeType};base64,`)) {
    return { valid: false, error: 'Conteúdo codificado da Nota Fiscal inválido.' };
  }

  return {
    valid: true,
    receipt: {
      fileName: candidate.fileName.slice(0, 120),
      mimeType: candidate.mimeType,
      sizeBytes: candidate.sizeBytes,
      dataUrl: candidate.dataUrl,
      uploadedAt: new Date().toISOString(),
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
    const {
      name,
      brand,
      category,
      purchaseDate,
      warrantyMonths,
      estimatedLifespanMonths,
      condition,
      notes,
      receipt,
    } = req.body as {
      name?: string;
      brand?: string;
      category?: ProductCategory;
      purchaseDate?: string;
      warrantyMonths?: number;
      estimatedLifespanMonths?: number;
      condition?: ProductCondition;
      notes?: string;
      receipt?: unknown;
    };

    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: 'Informe o nome ou modelo do equipamento eletrônico.' });
      return;
    }

    const safeCategory: ProductCategory = VALID_CATEGORIES.includes(category as ProductCategory)
      ? (category as ProductCategory)
      : 'other';

    if (!purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      res.status(400).json({ error: 'Informe uma data de compra válida (AAAA-MM-DD).' });
      return;
    }

    const parsedWarranty =
      typeof warrantyMonths === 'number' && warrantyMonths >= 0 && warrantyMonths <= 120
        ? Math.round(warrantyMonths)
        : 12;

    const parsedLifespan =
      typeof estimatedLifespanMonths === 'number' &&
      estimatedLifespanMonths >= 6 &&
      estimatedLifespanMonths <= 240
        ? Math.round(estimatedLifespanMonths)
        : DEFAULT_LIFESPAN_MONTHS[safeCategory];

    const safeCondition: ProductCondition = VALID_CONDITIONS.includes(
      condition as ProductCondition
    )
      ? (condition as ProductCondition)
      : 'in_use';

    const receiptCheck = validateReceiptInput(receipt);
    if (!receiptCheck.valid) {
      res.status(400).json({ error: receiptCheck.error });
      return;
    }

    const created = await createProductRecord({
      userId,
      name: name.trim(),
      brand: (brand || '').trim() || 'Não informada',
      category: safeCategory,
      purchaseDate,
      warrantyMonths: parsedWarranty,
      estimatedLifespanMonths: parsedLifespan,
      condition: safeCondition,
      notes: notes?.trim() || '',
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

    const {
      name,
      brand,
      category,
      purchaseDate,
      warrantyMonths,
      estimatedLifespanMonths,
      condition,
      notes,
      receipt,
    } = req.body as Partial<{
      name: string;
      brand: string;
      category: ProductCategory;
      purchaseDate: string;
      warrantyMonths: number;
      estimatedLifespanMonths: number;
      condition: ProductCondition;
      notes: string;
      receipt: unknown;
    }>;

    const receiptCheck = validateReceiptInput(receipt);
    if (!receiptCheck.valid) {
      res.status(400).json({ error: receiptCheck.error });
      return;
    }

    const updated = await updateProductRecord(productId, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(brand !== undefined ? { brand: brand.trim() } : {}),
      ...(category && VALID_CATEGORIES.includes(category) ? { category } : {}),
      ...(purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ? { purchaseDate } : {}),
      ...(typeof warrantyMonths === 'number' ? { warrantyMonths: Math.round(warrantyMonths) } : {}),
      ...(typeof estimatedLifespanMonths === 'number'
        ? { estimatedLifespanMonths: Math.round(estimatedLifespanMonths) }
        : {}),
      ...(condition && VALID_CONDITIONS.includes(condition) ? { condition } : {}),
      ...(notes !== undefined ? { notes: notes.trim() } : {}),
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
