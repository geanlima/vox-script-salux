import cors from 'cors';
import express from 'express';
import {
  closeOraclePool,
  initOraclePool,
  isOracleConfigured,
  prevalidateScript
} from './oracle-validator.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    available: isOracleConfigured(),
    service: 'vox-script-salux-api'
  });
});

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
            'Configure ORACLE_USER, ORACLE_PASSWORD e ORACLE_CONNECT_STRING para pré-validação Oracle.'
        }
      ],
      oracleAvailable: false
    });
  }

  try {
    await initOraclePool();
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
  if (isOracleConfigured()) {
    try {
      await initOraclePool();
      console.log('Pool Oracle inicializado.');
    } catch (error) {
      console.error('Falha ao inicializar Oracle:', error.message);
    }
  } else {
    console.log('Oracle não configurado. Apenas /api/health disponível.');
  }

  console.log(`API ouvindo na porta ${port}`);
});

process.on('SIGTERM', async () => {
  server.close(async () => {
    await closeOraclePool();
    process.exit(0);
  });
});
