import dotenv from 'dotenv';
import { createApp } from './app';
import { isFirebaseEnabled } from './config/firebase';

dotenv.config();

const PORT = Number(process.env.PORT) || 3333;

createApp().listen(PORT, () => {
  console.log(`==========================================================`);
  console.log(` EcoCiclo REEE API rodando em http://localhost:${PORT}`);
  console.log(` Modo de persistência: ${isFirebaseEnabled ? 'Firebase Firestore' : 'Local JSON (dev)'}`);
  console.log(`==========================================================`);
});
