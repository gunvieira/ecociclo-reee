import { Router, Request, Response } from 'express';
import { isFirebaseEnabled } from '../config/firebase';
import { AuthenticatedRequest, requireAuth } from '../middlewares/authMiddleware';
import {
  createUserRecord,
  findUserByEmail,
  hashPassword,
  issueLocalToken,
  toPublicUser,
  verifyPassword,
} from '../services/storageService';
import { UserRole } from '../types/models';

export const authRouter = Router();

// RF01 + RNF03: Cadastro de usuário com consentimento explícito LGPD
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, lgpdConsent } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
      lgpdConsent?: boolean;
    };

    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: 'Informe seu nome completo (mínimo 2 caracteres).' });
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'Informe um endereço de e-mail válido.' });
      return;
    }

    if (!password || password.length < 6) {
      res.status(400).json({ error: 'A senha deve possuir no mínimo 6 caracteres.' });
      return;
    }

    if (!lgpdConsent) {
      res.status(400).json({
        error:
          'É necessário aceitar o termo de privacidade (LGPD) para armazenar dados de inventário e notas fiscais.',
      });
      return;
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'Já existe uma conta cadastrada com este e-mail.' });
      return;
    }

    const validRole: UserRole = role === 'manager' ? 'manager' : 'consumer';
    const userRecord = await createUserRecord({
      name,
      email,
      passwordHash: hashPassword(password),
      role: validRole,
    });

    const publicUser = toPublicUser(userRecord);
    const token = issueLocalToken(publicUser);

    res.status(201).json({
      user: publicUser,
      token,
      storageMode: isFirebaseEnabled ? 'firebase' : 'local',
    });
  } catch (err) {
    console.error('[Auth Register Error]', err);
    res.status(500).json({ error: 'Erro interno ao realizar o cadastro.' });
  }
});

// RF01: Autenticação de usuário
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Informe e-mail e senha para entrar.' });
      return;
    }

    const userRecord = await findUserByEmail(email);
    if (!userRecord || !verifyPassword(password, userRecord.passwordHash)) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    const publicUser = toPublicUser(userRecord);
    const token = issueLocalToken(publicUser);

    res.json({
      user: publicUser,
      token,
      storageMode: isFirebaseEnabled ? 'firebase' : 'local',
    });
  } catch (err) {
    console.error('[Auth Login Error]', err);
    res.status(500).json({ error: 'Erro interno ao autenticar usuário.' });
  }
});

// Perfil da sessão autenticada
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({
    user: req.user,
    storageMode: isFirebaseEnabled ? 'firebase' : 'local',
  });
});
