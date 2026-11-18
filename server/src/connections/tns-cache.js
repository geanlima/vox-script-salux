import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildTnsAliasMap } from './tnsnames-parser.js';
import { resolveLocalTnsAdminDirSync } from './local-tns.js';

const CACHE_TTL_MS = 30 * 60 * 1000;
const BASE_DIR = join(tmpdir(), 'vox-script-salux-tns');
const cache = new Map();

export async function registerTnsNamesContent(content) {
  const normalized = String(content ?? '').trim();

  if (!normalized) {
    throw new Error('Conteúdo do tnsnames.ora vazio.');
  }

  const aliasMap = buildTnsAliasMap(normalized);

  if (aliasMap.size === 0) {
    throw new Error('Nenhum alias TNS válido encontrado no tnsnames.ora.');
  }

  const id = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  const configDir = join(BASE_DIR, id);

  if (!cache.has(id)) {
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, 'tnsnames.ora'), normalized, 'utf8');
    cache.set(id, { configDir, aliasMap, lastUsed: Date.now() });
  } else {
    const entry = cache.get(id);
    entry.aliasMap = aliasMap;
    entry.lastUsed = Date.now();
  }

  return { tnsConfigId: id, aliasCount: aliasMap.size };
}

export function getTnsConfigDir(tnsConfigId) {
  const id = String(tnsConfigId ?? '').trim();
  if (!id) {
    return null;
  }

  const entry = cache.get(id);
  if (!entry) {
    return null;
  }

  entry.lastUsed = Date.now();
  return entry.configDir;
}

export function getTnsConnectString(tnsConfigId, alias) {
  const id = String(tnsConfigId ?? '').trim();
  const name = String(alias ?? '').trim().toUpperCase();

  if (!id || !name) {
    return null;
  }

  const entry = cache.get(id);
  if (!entry) {
    return null;
  }

  entry.lastUsed = Date.now();
  return entry.aliasMap.get(name) ?? null;
}

export function resolveTnsConfigDir(options = {}) {
  const fromCache = getTnsConfigDir(options.tnsConfigId);
  if (fromCache) {
    return fromCache;
  }

  return process.env.ORACLE_TNS_ADMIN?.trim() || process.env.TNS_ADMIN?.trim() || resolveLocalTnsAdminDirSync() || null;
}

export function pruneTnsCache() {
  const now = Date.now();

  for (const [id, entry] of cache.entries()) {
    if (now - entry.lastUsed > CACHE_TTL_MS) {
      cache.delete(id);
    }
  }
}

setInterval(pruneTnsCache, 5 * 60 * 1000).unref();
