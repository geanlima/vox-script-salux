import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const serverDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(serverDir, '../..');

dotenv.config({ path: resolve(projectRoot, '.env') });
dotenv.config({ path: resolve(serverDir, '../.env') });

// Fora do Docker: API local conecta ao Oracle exposto pelo docker compose em localhost:ORACLE_PORT
if (!existsSync('/.dockerenv')) {
  const port = process.env.ORACLE_PORT || '1521';
  const service = process.env.ORACLE_SERVICE_NAME || 'XEPDB1';
  const host = process.env.ORACLE_HOST || 'localhost';
  const mode = (process.env.ORACLE_CONNECTION_MODE || '').toLowerCase();

  if (mode === 'easy_connect' || host === 'localhost') {
    process.env.ORACLE_CONNECTION_MODE = 'easy_connect';
    process.env.ORACLE_HOST = host;
    process.env.ORACLE_PORT = port;
    process.env.ORACLE_SERVICE_NAME = service;
    delete process.env.ORACLE_CONNECT_STRING;
  } else if (process.env.ORACLE_CONNECT_STRING?.startsWith('oracle:')) {
    process.env.ORACLE_CONNECTION_MODE = 'connect_string';
    process.env.ORACLE_CONNECT_STRING = `localhost:${port}/${service}`;
  }
}
