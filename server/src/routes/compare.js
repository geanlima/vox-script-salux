import { Router } from 'express';
import { requireAuth, requireMaster } from '../auth/auth-middleware.js';
import { withConfigConnection } from '../connections/oracle-pools.js';
import { loadSaluxIniFromServer, resolveCompareEndpoint } from '../connections/connection-resolver.js';
import { getLocalTnsInfo } from '../connections/local-tns.js';
import { getConfiguredProfiles, getPublicProfileInfo } from '../connections/connection-profiles.js';
import { getConnectionModeHelp } from '../connections/oracle-connect-string.js';
import { parseSaluxIni } from '../connections/salux-ini-parser.js';
import { registerTnsNamesContent } from '../connections/tns-cache.js';
import * as oracleProvider from '../metadata/oracle-metadata-provider.js';
import { compareSchemaMetadata, compareTableMetadata } from '../schema/schema-diff.js';

const router = Router();

router.use(requireAuth, requireMaster);

function validateEndpoint(body) {
  const errors = [];

  const hasSource = body?.source?.profileId || body?.source?.tnsName;
  const hasTarget = body?.target?.profileId || body?.target?.tnsName;

  if (!hasSource) {
    errors.push('Informe profileId ou tnsName (ServerName) na origem.');
  }

  if (!body?.source?.schema?.trim()) {
    errors.push('source.schema é obrigatório.');
  }

  if (!hasTarget) {
    errors.push('Informe profileId ou tnsName (ServerName) no destino.');
  }

  if (!body?.target?.schema?.trim()) {
    errors.push('target.schema é obrigatório.');
  }

  if (errors.length > 0) {
    return errors;
  }

  const sourceKey = body?.source?.tnsName?.trim().toUpperCase() || body?.source?.profileId || '';
  const targetKey = body?.target?.tnsName?.trim().toUpperCase() || body?.target?.profileId || '';

  if (sourceKey && targetKey && sourceKey === targetKey) {
    errors.push('Origem e destino não podem usar a mesma conexão.');
  }

  return errors;
}

function buildEndpointMeta(endpoint, config) {
  return {
    profileId: endpoint.profileId ?? null,
    tnsName: endpoint.tnsName ?? null,
    schema: endpoint.schema,
    table: endpoint.table ?? null,
    connectionSummary: config.connectionSummary
  };
}

router.get('/profiles', (_req, res) => {
  const profiles = getConfiguredProfiles().map(getPublicProfileInfo);
  res.json({ profiles });
});

router.get('/connection-modes', (_req, res) => {
  res.json({
    modes: getConnectionModeHelp().map((mode) => ({
      ...mode,
      examples: {
        primary: mode.variables.map((variable) => variable.replace('{PREFIX}', 'ORACLE')),
        secondary: mode.variables.map((variable) => variable.replace('{PREFIX}', 'ORACLE_COMPARE'))
      }
    }))
  });
});

router.get('/local-tns', async (_req, res) => {
  try {
    const info = await getLocalTnsInfo();
    return res.json(info);
  } catch (error) {
    return res.status(500).json({
      available: false,
      configDir: null,
      aliases: [],
      message: error?.message ?? 'Falha ao ler tnsnames.ora local.'
    });
  }
});

router.get('/ini', async (_req, res) => {
  try {
    const ini = await loadSaluxIniFromServer();

    if (!ini) {
      return res.json({
        available: false,
        message: 'Configure SALUX_INI_PATH no servidor ou carregue o arquivo .ini na interface.'
      });
    }

    return res.json({
      available: true,
      filePath: ini.filePath,
      activeServerName: ini.activeServerName,
      dirExe: ini.dirExe,
      connections: ini.connections
    });
  } catch (error) {
    return res.status(500).json({
      message: error?.message ?? 'Falha ao ler arquivo INI Salux.'
    });
  }
});

router.post('/ini/parse', (req, res) => {
  const content = req.body?.content;

  if (!content?.trim()) {
    return res.status(400).json({ message: 'Informe o conteúdo do arquivo INI.' });
  }

  try {
    const parsed = parseSaluxIni(content);
    return res.json({
      available: true,
      activeServerName: parsed.activeServerName,
      dirExe: parsed.dirExe,
      connections: parsed.connections
    });
  } catch (error) {
    return res.status(400).json({
      message: error?.message ?? 'Falha ao interpretar arquivo INI.'
    });
  }
});

function mergeEndpointRequest(body, endpoint) {
  const tnsConfigId = body?.tnsConfigId ?? endpoint?.tnsConfigId;
  return tnsConfigId ? { ...endpoint, tnsConfigId } : { ...endpoint };
}

function pickEndpointPayload(body) {
  return {
    profileId: body?.profileId,
    tnsName: body?.tnsName?.trim(),
    tnsConfigId: body?.tnsConfigId,
    oracleUser: body?.oracleUser?.trim(),
    oraclePassword: body?.oraclePassword,
    schema: body?.schema
  };
}

router.post('/tns-cache', async (req, res) => {
  const content = req.body?.content;

  if (!content?.trim()) {
    return res.status(400).json({ message: 'Informe o conteúdo do tnsnames.ora.' });
  }

  try {
    const result = await registerTnsNamesContent(content);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({
      message: error?.message ?? 'Falha ao registrar tnsnames.ora.'
    });
  }
});

router.post('/test-connection', async (req, res) => {
  const profileId = req.body?.profileId;
  const tnsName = req.body?.tnsName;

  if (!profileId && !tnsName?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Informe profileId ou tnsName para testar a conexão.'
    });
  }

  try {
    const config = resolveCompareEndpoint(
      mergeEndpointRequest(req.body, pickEndpointPayload(req.body))
    );
    await withConfigConnection(config, async (connection) => {
      await connection.execute('SELECT 1 FROM DUAL');
    });

    return res.json({
      success: true,
      message: 'Conexão estabelecida com sucesso.',
      connectionSummary: config.connectionSummary
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message ?? 'Falha ao conectar no Oracle.'
    });
  }
});

router.post('/schemas', async (req, res) => {
  const payload = pickEndpointPayload(req.body);

  if (!payload.profileId && !payload.tnsName) {
    return res.status(400).json({ message: 'Informe profileId ou tnsName.' });
  }

  try {
    const config = resolveCompareEndpoint(mergeEndpointRequest(req.body, payload));
    const schemas = await oracleProvider.listSchemasForConfig(config);
    return res.json({ schemas });
  } catch (error) {
    return res.status(500).json({
      message: error?.message ?? 'Falha ao listar schemas.'
    });
  }
});

router.post('/tables', async (req, res) => {
  const payload = pickEndpointPayload(req.body);

  if ((!payload.profileId && !payload.tnsName) || !payload.schema) {
    return res.status(400).json({ message: 'Informe profileId ou tnsName, e schema.' });
  }

  try {
    const config = resolveCompareEndpoint(mergeEndpointRequest(req.body, payload));
    const tables = await oracleProvider.listTablesForConfig(config, payload.schema);
    return res.json({ tables });
  } catch (error) {
    return res.status(500).json({
      message: error?.message ?? 'Falha ao listar tabelas.'
    });
  }
});

router.post('/', async (req, res) => {
  const errors = validateEndpoint(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ message: errors.join(' ') });
  }

  const sourceTable = req.body.source.table?.trim() || null;
  const targetTable = req.body.target.table?.trim() || sourceTable;

  try {
    const sourceConfig = resolveCompareEndpoint(mergeEndpointRequest(req.body, req.body.source));
    const targetConfig = resolveCompareEndpoint(mergeEndpointRequest(req.body, req.body.target));

    if (sourceTable && targetTable) {
      const [sourceMeta, targetMeta] = await Promise.all([
        oracleProvider.getTableMetadataForConfig(sourceConfig, req.body.source.schema, sourceTable),
        oracleProvider.getTableMetadataForConfig(targetConfig, req.body.target.schema, targetTable)
      ]);

      const result = compareTableMetadata(sourceMeta, targetMeta);
      return res.json({
        mode: 'table',
        source: buildEndpointMeta({ ...req.body.source, table: sourceTable }, sourceConfig),
        target: buildEndpointMeta({ ...req.body.target, table: targetTable }, targetConfig),
        result
      });
    }

    const [sourceTables, targetTables] = await Promise.all([
      oracleProvider.getSchemaMetadataForConfig(sourceConfig, req.body.source.schema),
      oracleProvider.getSchemaMetadataForConfig(targetConfig, req.body.target.schema)
    ]);

    const result = compareSchemaMetadata(sourceTables, targetTables);

    return res.json({
      mode: 'schema',
      source: buildEndpointMeta(req.body.source, sourceConfig),
      target: buildEndpointMeta(req.body.target, targetConfig),
      result
    });
  } catch (error) {
    return res.status(500).json({
      message: error?.message ?? 'Falha ao comparar estruturas.'
    });
  }
});

export default router;
