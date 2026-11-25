import { Response, Router } from 'express';
import {
  AuthenticatedRequest,
  requireAuth,
  requireManager,
} from '../middlewares/authMiddleware';
import {
  VALID_WASTE_TYPES,
  ensureSampleCollectionPoints,
  sanitizeCollectionPointPayload,
} from '../services/collectionPointService';
import {
  createCollectionPointRecord,
  deleteCollectionPointRecord,
  getCollectionPointById,
  listCollectionPoints,
  updateCollectionPointRecord,
} from '../services/storageService';
import { CollectionPoint, PublicUser, WasteType } from '../types/models';

export const collectionPointRouter = Router();

collectionPointRouter.use(requireAuth);

// O gestor pode administrar os próprios pontos e "assumir" os pontos de exemplo
function canManagePoint(user: PublicUser, point: CollectionPoint): boolean {
  return user.role === 'manager' && (point.managerId === user.id || point.isSample);
}

// RF04 + RF05: lista os pontos de coleta ativos (com filtro opcional por tipo de resíduo)
collectionPointRouter.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await ensureSampleCollectionPoints();
    const user = req.user!;
    const wasteType = typeof req.query.wasteType === 'string' ? req.query.wasteType : '';

    let items = (await listCollectionPoints()).filter(
      (point) => point.isActive || canManagePoint(user, point)
    );

    if (wasteType && (VALID_WASTE_TYPES as string[]).includes(wasteType)) {
      items = items.filter((point) => point.acceptedWasteTypes.includes(wasteType as WasteType));
    }

    res.json({ items });
  } catch (err) {
    console.error('[List Collection Points Error]', err);
    res.status(500).json({ error: 'Erro ao carregar os pontos de coleta.' });
  }
});

// RF12: pontos administrados pelo gestor logado
collectionPointRouter.get(
  '/mine',
  requireManager,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await ensureSampleCollectionPoints();
      const user = req.user!;
      const items = (await listCollectionPoints()).filter((point) => canManagePoint(user, point));
      res.json({ items });
    } catch (err) {
      console.error('[List My Collection Points Error]', err);
      res.status(500).json({ error: 'Erro ao carregar seus pontos de coleta.' });
    }
  }
);

// RF12: cadastro de novo ponto de coleta
collectionPointRouter.post(
  '/',
  requireManager,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const result = sanitizeCollectionPointPayload(req.body || {});
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }

      const point = await createCollectionPointRecord({
        ...result.data,
        managerId: user.id,
        managerName: user.name,
        isSample: false,
      });

      res.status(201).json({ point });
    } catch (err) {
      console.error('[Create Collection Point Error]', err);
      res.status(500).json({ error: 'Erro ao cadastrar ponto de coleta.' });
    }
  }
);

// RF12: atualização (inclui ativar/desativar o ponto)
collectionPointRouter.put(
  '/:id',
  requireManager,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const existing = await getCollectionPointById(String(req.params.id));
      if (!existing || !canManagePoint(user, existing)) {
        res.status(404).json({ error: 'Ponto de coleta não encontrado entre os seus pontos.' });
        return;
      }

      const result = sanitizeCollectionPointPayload({ ...existing, ...(req.body || {}) });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }

      // Ao editar um ponto de exemplo, o gestor passa a ser o responsável por ele
      const point = await updateCollectionPointRecord(existing.id, {
        ...result.data,
        managerId: user.id,
        managerName: user.name,
        isSample: false,
      });

      res.json({ point });
    } catch (err) {
      console.error('[Update Collection Point Error]', err);
      res.status(500).json({ error: 'Erro ao atualizar ponto de coleta.' });
    }
  }
);

// RF12: exclusão do ponto de coleta
collectionPointRouter.delete(
  '/:id',
  requireManager,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const existing = await getCollectionPointById(String(req.params.id));
      if (!existing || !canManagePoint(user, existing)) {
        res.status(404).json({ error: 'Ponto de coleta não encontrado entre os seus pontos.' });
        return;
      }

      await deleteCollectionPointRecord(existing.id);
      res.status(204).send();
    } catch (err) {
      console.error('[Delete Collection Point Error]', err);
      res.status(500).json({ error: 'Erro ao excluir ponto de coleta.' });
    }
  }
);
