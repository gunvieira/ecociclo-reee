import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const backendRootDir = path.resolve(__dirname, '../..');

function findServiceAccountJsonPath(): string | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const customPath = path.resolve(backendRootDir, process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(customPath)) return customPath;
  }

  try {
    const files = fs.readdirSync(backendRootDir);
    const match = files.find(
      (file) => file.includes('firebase-adminsdk') && file.endsWith('.json')
    );
    return match ? path.join(backendRootDir, match) : null;
  } catch {
    return null;
  }
}

const envProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
const envClientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
const envPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
const serviceAccountPath = findServiceAccountJsonPath();

let initializedProjectId: string | null = null;

if (!admin.apps.length) {
  if (envProjectId && envClientEmail && envPrivateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: envProjectId,
        clientEmail: envClientEmail,
        privateKey: envPrivateKey,
      }),
    });
    initializedProjectId = envProjectId;
    console.log(`[Firebase] Conectado via .env ao projeto Firestore: ${initializedProjectId}`);
  } else if (serviceAccountPath) {
    const rawJson = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8')) as admin.ServiceAccount & {
      project_id?: string;
    };
    admin.initializeApp({
      credential: admin.credential.cert(rawJson),
    });
    initializedProjectId = rawJson.projectId || rawJson.project_id || 'firebase-project';
    console.log(
      `[Firebase] Conectado via chave JSON (${path.basename(
        serviceAccountPath
      )}) ao projeto: ${initializedProjectId}`
    );
  } else {
    console.log(
      '[Storage] Credenciais Firebase ausentes — executando em Modo Local Persistente (backend/data/db.json).'
    );
  }
} else {
  initializedProjectId = admin.app().options.projectId || 'firebase-project';
}

export const isFirebaseEnabled = admin.apps.length > 0;
export const firestoreDb = isFirebaseEnabled ? admin.firestore() : null;
export const firebaseAuth = isFirebaseEnabled ? admin.auth() : null;
