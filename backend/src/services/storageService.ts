import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { firestoreDb, isFirebaseEnabled } from '../config/firebase';
import { CollectionPoint, ElectronicProduct, PublicUser, UserRecord } from '../types/models';

interface LocalDatabaseSchema {
  users: UserRecord[];
  products: ElectronicProduct[];
  collectionPoints: CollectionPoint[];
  meta: { collectionPointsSeeded?: boolean };
}

const DATA_FILE_PATH = process.env.LOCAL_DB_FILE
  ? path.resolve(process.env.LOCAL_DB_FILE)
  : path.resolve(__dirname, '../../data/db.json');
const LOCAL_SECRET =
  process.env.LOCAL_AUTH_SECRET || 'ecociclo-reee-dev-secret-change-in-production';

function ensureLocalDb(): LocalDatabaseSchema {
  const dir = path.dirname(DATA_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE_PATH)) {
    const initial: LocalDatabaseSchema = { users: [], products: [], collectionPoints: [], meta: {} };
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LocalDatabaseSchema>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      collectionPoints: Array.isArray(parsed.collectionPoints) ? parsed.collectionPoints : [],
      meta: parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {},
    };
  } catch {
    return { users: [], products: [], collectionPoints: [], meta: {} };
  }
}

function saveLocalDb(data: LocalDatabaseSchema): void {
  const dir = path.dirname(DATA_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash: _ignored, ...publicData } = user;
  return publicData;
}

// Hash seguro com scrypt nativo (RNF03 - Segurança e LGPD)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

// Token assinado HMAC-SHA256 para sessão local/API
export function issueLocalToken(user: PublicUser): string {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 dias
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', LOCAL_SECRET)
    .update(base64Payload)
    .digest('base64url');
  return `${base64Payload}.${signature}`;
}

export function verifyLocalToken(token: string): { sub: string; email: string; role: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [base64Payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', LOCAL_SECRET)
    .update(base64Payload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf-8')) as {
      sub: string;
      email: string;
      role: string;
      exp: number;
    };
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ============================================================================
// REPOSITÓRIO DE USUÁRIOS (Firestore ou Local JSON)
// ============================================================================

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  if (isFirebaseEnabled && firestoreDb) {
    const snap = await firestoreDb
      .collection('users')
      .where('email', '==', normalized)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as UserRecord;
  }

  const db = ensureLocalDb();
  return db.users.find((u) => u.email === normalized) || null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (isFirebaseEnabled && firestoreDb) {
    const doc = await firestoreDb.collection('users').doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as UserRecord;
  }

  const db = ensureLocalDb();
  return db.users.find((u) => u.id === id) || null;
}

export async function createUserRecord(input: {
  id?: string;
  name: string;
  email: string;
  passwordHash?: string;
  role: UserRecord['role'];
}): Promise<UserRecord> {
  const now = new Date().toISOString();
  const user: UserRecord = {
    id: input.id || crypto.randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    passwordHash: input.passwordHash,
    lgpdConsentAt: now,
    createdAt: now,
  };

  if (isFirebaseEnabled && firestoreDb) {
    await firestoreDb.collection('users').doc(user.id).set(user);
    return user;
  }

  const db = ensureLocalDb();
  db.users.push(user);
  saveLocalDb(db);
  return user;
}

// ============================================================================
// REPOSITÓRIO DE PRODUTOS DO INVENTÁRIO VIRTUAL (Firestore ou Local JSON)
// ============================================================================

export async function listProductsByUser(userId: string): Promise<ElectronicProduct[]> {
  if (isFirebaseEnabled && firestoreDb) {
    const snap = await firestoreDb
      .collection('products')
      .where('userId', '==', userId)
      .get();
    const list = snap.docs.map((d) => d.data() as ElectronicProduct);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const db = ensureLocalDb();
  return db.products
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getProductById(productId: string): Promise<ElectronicProduct | null> {
  if (isFirebaseEnabled && firestoreDb) {
    const doc = await firestoreDb.collection('products').doc(productId).get();
    if (!doc.exists) return null;
    return doc.data() as ElectronicProduct;
  }

  const db = ensureLocalDb();
  return db.products.find((p) => p.id === productId) || null;
}

export async function createProductRecord(
  input: Omit<ElectronicProduct, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ElectronicProduct> {
  const now = new Date().toISOString();
  const product: ElectronicProduct = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  if (isFirebaseEnabled && firestoreDb) {
    await firestoreDb.collection('products').doc(product.id).set(product);
    return product;
  }

  const db = ensureLocalDb();
  db.products.push(product);
  saveLocalDb(db);
  return product;
}

export async function updateProductRecord(
  productId: string,
  updates: Partial<Omit<ElectronicProduct, 'id' | 'userId' | 'createdAt'>>
): Promise<ElectronicProduct | null> {
  const existing = await getProductById(productId);
  if (!existing) return null;

  const updated: ElectronicProduct = {
    ...existing,
    ...updates,
    id: existing.id,
    userId: existing.userId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  if (isFirebaseEnabled && firestoreDb) {
    await firestoreDb.collection('products').doc(productId).set(updated);
    return updated;
  }

  const db = ensureLocalDb();
  const index = db.products.findIndex((p) => p.id === productId);
  if (index === -1) return null;
  db.products[index] = updated;
  saveLocalDb(db);
  return updated;
}

export async function deleteProductRecord(productId: string): Promise<boolean> {
  if (isFirebaseEnabled && firestoreDb) {
    await firestoreDb.collection('products').doc(productId).delete();
    return true;
  }

  const db = ensureLocalDb();
  const before = db.products.length;
  db.products = db.products.filter((p) => p.id !== productId);
  if (db.products.length === before) return false;
  saveLocalDb(db);
  return true;
}

// ============================================================================
// REPOSITÓRIO DE PONTOS DE COLETA / ECOPONTOS (RF04, RF05 e RF12)
// ============================================================================

export async function listCollectionPoints(): Promise<CollectionPoint[]> {
  if (isFirebaseEnabled && firestoreDb) {
    const snap = await firestoreDb.collection('collectionPoints').get();
    return snap.docs
      .map((d) => d.data() as CollectionPoint)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const db = ensureLocalDb();
  return [...db.collectionPoints].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCollectionPointById(id: string): Promise<CollectionPoint | null> {
  if (isFirebaseEnabled && firestoreDb) {
    const doc = await firestoreDb.collection('collectionPoints').doc(id).get();
    return doc.exists ? (doc.data() as CollectionPoint) : null;
  }

  const db = ensureLocalDb();
  return db.collectionPoints.find((p) => p.id === id) || null;
}

export async function createCollectionPointRecord(
  input: Omit<CollectionPoint, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CollectionPoint> {
  const now = new Date().toISOString();
  const point: CollectionPoint = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };

  if (isFirebaseEnabled && firestoreDb) {
    await firestoreDb.collection('collectionPoints').doc(point.id).set(point);
    return point;
  }

  const db = ensureLocalDb();
  db.collectionPoints.push(point);
  saveLocalDb(db);
  return point;
}

export async function updateCollectionPointRecord(
  id: string,
  updates: Partial<Omit<CollectionPoint, 'id' | 'createdAt'>>
): Promise<CollectionPoint | null> {
  const existing = await getCollectionPointById(id);
  if (!existing) return null;

  const updated: CollectionPoint = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  if (isFirebaseEnabled && firestoreDb) {
    await firestoreDb.collection('collectionPoints').doc(id).set(updated);
    return updated;
  }

  const db = ensureLocalDb();
  const index = db.collectionPoints.findIndex((p) => p.id === id);
  if (index === -1) return null;
  db.collectionPoints[index] = updated;
  saveLocalDb(db);
  return updated;
}

export async function deleteCollectionPointRecord(id: string): Promise<boolean> {
  if (isFirebaseEnabled && firestoreDb) {
    await firestoreDb.collection('collectionPoints').doc(id).delete();
    return true;
  }

  const db = ensureLocalDb();
  const before = db.collectionPoints.length;
  db.collectionPoints = db.collectionPoints.filter((p) => p.id !== id);
  if (db.collectionPoints.length === before) return false;
  saveLocalDb(db);
  return true;
}

// Controle para semear os pontos de exemplo apenas UMA vez (não recria se o gestor apagar)
export async function isCollectionPointSeedDone(): Promise<boolean> {
  if (isFirebaseEnabled && firestoreDb) {
    const doc = await firestoreDb.collection('system').doc('seed').get();
    return Boolean(doc.exists && doc.data()?.collectionPointsSeededAt);
  }
  return Boolean(ensureLocalDb().meta.collectionPointsSeeded);
}

export async function markCollectionPointSeedDone(): Promise<void> {
  if (isFirebaseEnabled && firestoreDb) {
    await firestoreDb
      .collection('system')
      .doc('seed')
      .set({ collectionPointsSeededAt: new Date().toISOString() }, { merge: true });
    return;
  }
  const db = ensureLocalDb();
  db.meta.collectionPointsSeeded = true;
  saveLocalDb(db);
}
