import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { isFirebaseEnabled } from './config/firebase';
import { authRouter } from './routes/authRoutes';
import { productRouter } from './routes/productRoutes';
import { collectionPointRouter } from './routes/collectionPointRoutes';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3333;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: [CORS_ORIGIN, 'http://127.0.0.1:5173'],
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

app.listen(PORT, () => {
  console.log(`==========================================================`);
  console.log(` EcoCiclo REEE API rodando em http://localhost:${PORT}`);
  console.log(` Modo de persistência: ${isFirebaseEnabled ? 'Firebase Firestore' : 'Local JSON (dev)'}`);
  console.log(`==========================================================`);
});
