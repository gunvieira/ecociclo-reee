import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll } from 'vitest';

// Cada arquivo de teste recebe um banco local próprio e descartável
const dbFile = path.join(
  os.tmpdir(),
  `ecociclo-test-${process.pid}-${Math.random().toString(36).slice(2)}.json`
);
process.env.LOCAL_DB_FILE = dbFile;

afterAll(() => {
  fs.rmSync(dbFile, { force: true });
});
