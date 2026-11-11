import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { parseTnsNamesContent } from './tnsnames-parser.js';

function buildTnsAdminCandidates() {
  const candidates = [];

  const oracleTnsAdmin = process.env.ORACLE_TNS_ADMIN?.trim();
  if (oracleTnsAdmin) {
    candidates.push(oracleTnsAdmin);
  }

  const tnsAdmin = process.env.TNS_ADMIN?.trim();
  if (tnsAdmin && !candidates.includes(tnsAdmin)) {
    candidates.push(tnsAdmin);
  }

  const oracleHome = process.env.ORACLE_HOME?.trim();
  if (oracleHome) {
    const fromHome = join(oracleHome, 'network', 'admin');
    if (!candidates.includes(fromHome)) {
      candidates.push(fromHome);
    }
  }

  return candidates;
}

export function resolveLocalTnsAdminDirSync() {
  for (const dir of buildTnsAdminCandidates()) {
    if (existsSync(join(dir, 'tnsnames.ora'))) {
      return dir;
    }
  }

  return null;
}

export async function getLocalTnsInfo() {
  const configDir = resolveLocalTnsAdminDirSync();

  if (!configDir) {
    return {
      available: false,
      configDir: null,
      aliases: [],
      message:
        'tnsnames.ora local não encontrado. Configure ORACLE_TNS_ADMIN, TNS_ADMIN ou ORACLE_HOME na máquina onde a API está rodando.'
    };
  }

  const content = await readFile(join(configDir, 'tnsnames.ora'), 'utf8');
  const aliases = parseTnsNamesContent(content);

  return {
    available: aliases.length > 0,
    configDir,
    aliases,
    message:
      aliases.length > 0
        ? null
        : `Arquivo encontrado em ${configDir}, mas nenhum alias TNS válido foi identificado.`
  };
}
