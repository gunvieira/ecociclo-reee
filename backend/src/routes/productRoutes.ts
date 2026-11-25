import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middlewares/authMiddleware';
import {
  computeProductLifecycle,
  enrichProductsWithLifecycle,
} from '../services/lifecycleService';
import { sanitizeProductPayload, validateReceiptInput } from '../services/productService';
import {
  createProductRecord,
  deleteProductRecord,
  getProductById,
  listProductsByUser,
  updateProductRecord,
} from '../services/storageService';
import { ProductCategory, ProductCondition } from '../types/models';

export const productRouter = Router();

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
