import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

export const isFirebaseEnabled = Boolean(projectId && clientEmail && privateKey);

if (isFirebaseEnabled && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  console.log(`[Firebase] Conectado ao projeto Firestore: ${projectId}`);
} else if (!isFirebaseEnabled) {
  console.log(
    '[Storage] Credenciais Firebase ausentes no .env — executando em Modo Local Persistente (backend/data/db.json).'
  );
}

export const firestoreDb = isFirebaseEnabled ? admin.firestore() : null;
export const firebaseAuth = isFirebaseEnabled ? admin.auth() : null;
