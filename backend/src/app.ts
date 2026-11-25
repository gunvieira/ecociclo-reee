import cors from 'cors';
import express, { Request, Response } from 'express';
import { isFirebaseEnabled } from './config/firebase';
import { authRouter } from './routes/authRoutes';
import { productRouter } from './routes/productRoutes';
import { collectionPointRouter } from './routes/collectionPointRoutes';

// Separado do server.ts para que os testes de integração usem o app sem abrir porta
export function createApp() {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

  app.use(
    cors({
      origin: [corsOrigin, 'http://127.0.0.1:5173'],
      credentials: true,
    })
  );

  // Limite de 10MB para suportar upload de foto/PDF da Nota Fiscal em Base64 (RF02)
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      project: 'EcoCiclo REEE API',
      part: 'Parte 2 - RF01 a RF05 + RF12 (Inventário, Alertas, Mapa de Ecopontos e Painel do Gestor)',
      storageMode: isFirebaseEnabled ? 'firebase' : 'local',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/products', productRouter);
  app.use('/api/collection-points', collectionPointRouter);

  return app;
}
