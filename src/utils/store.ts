import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(__dirname, '../../data');

export function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readJson<T>(fileName: string, fallback: T): T {
  ensureDataDir();
  const path = join(DATA_DIR, fileName);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(fileName: string, data: unknown): void {
  ensureDataDir();
  writeFileSync(join(DATA_DIR, fileName), JSON.stringify(data, null, 2), 'utf-8');
}
