import './load-env.js';
import cors from 'cors';
import express from 'express';
import { initScriptStorageSchema, isScriptStorageReady } from './db/sqlite-scripts.js';
import { initUserSchema } from './db/sqlite-users.js';
import {
  closeOraclePool,
  isOracleConfigured,
  isOracleReady,
  prevalidateScript,
  waitForOraclePool
} from './oracle-validator.js';
import { closeAllPools } from './connections/oracle-pools.js';
import authRouter from './routes/auth.js';
import compareRouter from './routes/compare.js';
import scriptsRouter from './routes/scripts.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  const oracleConfigured = isOracleConfigured();
  const oracleAvailable = oracleConfigured ? await isOracleReady() : false;
  const storageAvailable = await isScriptStorageReady();

  res.json({
    available: oracleAvailable,
    configured: oracleConfigured,
    service: 'vox-script-salux-api',
    mode: oracleAvailable ? 'oracle-validation' : 'sqlite-storage',
    storage: {
      configured: true,
      available: storageAvailable
    },
    oracle: { configured: oracleConfigured, available: oracleAvailable }
  });
});

app.use('/api/auth', authRouter);
app.use('/api/scripts', scriptsRouter);
app.use('/api/compare', compareRouter);

app.post('/api/prevalidate', async (req, res) => {
  const sql = req.body?.sql ?? '';

  if (!sql.trim()) {
    return res.status(400).json({
      mode: 'oracle',
      success: false,
      message: 'Informe um script para pré-validar.',
      statements: [],
      errors: [{ linha: 0, descricao: 'Script vazio.' }],
      oracleAvailable: isOracleConfigured()
    });
  }

  if (!isOracleConfigured()) {
    return res.status(503).json({
      mode: 'static',
      success: false,
      message: 'Oracle não configurado no servidor.',
      statements: [],
      errors: [
        {
          linha: 0,
          descricao:
            'Configure ORACLE_USER, ORACLE_PASSWORD e a conexão (CONNECT_STRING, TNS ou Easy Connect) para pré-validação Oracle.'
        }
      ],
      oracleAvailable: false
    });
  }

  try {
    await waitForOraclePool();
    const result = await prevalidateScript(sql);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      mode: 'oracle',
      success: false,
      message: 'Falha ao conectar ou analisar no Oracle.',
      statements: [],
      errors: [
        {
          linha: 0,
          descricao: error?.message ?? 'Erro desconhecido na pré-validação Oracle.'
        }
      ],
      oracleAvailable: true
    });
  }
});

const server = app.listen(port, async () => {
  console.log(`API ouvindo na porta ${port}`);

  try {
    await initUserSchema();
    await initScriptStorageSchema();
    console.log('SQLite inicializado (autenticação + armazenamento de scripts).');
  } catch (error) {
    console.error('Falha ao inicializar SQLite:', error.message);
  }

  if (!isOracleConfigured()) {
    console.log('Oracle não configurado. Pré-validação Oracle indisponível; validação estática segue disponível no frontend.');
    return;
  }

  try {
    await waitForOraclePool();
    console.log('Pool Oracle inicializado para pré-validação.');
  } catch (error) {
    console.error('Falha ao inicializar Oracle:', error.message);
  }
});

process.on('SIGTERM', async () => {
  server.close(async () => {
    await closeAllPools();
    await closeOraclePool();
    process.exit(0);
  });
});
