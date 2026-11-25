import { NextFunction, Request, Response } from 'express';
import { firebaseAuth, isFirebaseEnabled } from '../config/firebase';
import {
  createUserRecord,
  findUserById,
  toPublicUser,
  verifyLocalToken,
} from '../services/storageService';
import { PublicUser } from '../types/models';

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autenticação não informado.' });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();

    // 1. Tenta validar token local assinado pela API
    const localPayload = verifyLocalToken(token);
    if (localPayload) {
      const user = await findUserById(localPayload.sub);
      if (!user) {
        res.status(401).json({ error: 'Sessão inválida ou usuário não encontrado.' });
        return;
      }
      req.user = toPublicUser(user);
      next();
      return;
    }

    // 2. Caso o Firebase Auth esteja ativo, aceita ID Token emitido pelo Firebase Client SDK
    if (isFirebaseEnabled && firebaseAuth) {
      const decoded = await firebaseAuth.verifyIdToken(token);
      let user = await findUserById(decoded.uid);
      if (!user) {
        user = await createUserRecord({
          id: decoded.uid,
          name: decoded.name || decoded.email?.split('@')[0] || 'Usuário',
          email: decoded.email || `${decoded.uid}@firebase.local`,
          role: 'consumer',
        });
      }
      req.user = toPublicUser(user);
      next();
      return;
    }

    res.status(401).json({ error: 'Token inválido ou expirado. Faça login novamente.' });
  } catch {
    res.status(401).json({ error: 'Falha na validação de autenticação.' });
  }
}

// RF12: restringe rotas administrativas ao perfil Gestor de Ponto de Coleta
export function requireManager(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.role !== 'manager') {
    res.status(403).json({
      error: 'Acesso restrito a Gestores de Pontos de Coleta (cooperativas, ONGs ou órgãos públicos).',
    });
    return;
  }
  next();
}
