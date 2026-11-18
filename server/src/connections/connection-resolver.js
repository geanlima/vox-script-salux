import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { CONNECTION_MODES } from './oracle-connect-string.js';
import { getProfile } from './connection-profiles.js';
import { getSaluxIniPath, parseSaluxIni } from './salux-ini-parser.js';
import { resolveTnsConfigDir, getTnsConnectString } from './tns-cache.js';

function readOracleCredentials(options = {}) {
  const user = String(options.oracleUser ?? process.env.ORACLE_USER ?? '').trim();
  const password = String(options.oraclePassword ?? process.env.ORACLE_PASSWORD ?? '');

  if (!user || !password) {
    throw new Error('Informe usuário e senha do banco ou configure ORACLE_USER e ORACLE_PASSWORD no servidor.');
  }

  return { user, password };
}

export function resolveSaluxTnsConnection(tnsName, options = {}) {
  const name = String(tnsName ?? '').trim();

  if (!name) {
    throw new Error('Informe o ServerName (alias TNS) do INI Salux.');
  }

  const { user, password } = readOracleCredentials(options);
  const easyConnect = options.tnsConfigId
    ? getTnsConnectString(options.tnsConfigId, name)
    : null;

  if (options.tnsConfigId && !easyConnect) {
    throw new Error(`Alias TNS "${name}" não encontrado no tnsnames.ora carregado.`);
  }

  if (easyConnect) {
    return {
      id: `tns:${name.toUpperCase()}`,
      type: 'oracle',
      label: `TNS: ${name}`,
      user,
      password,
      connectString: easyConnect,
      configDir: null,
      connectionMode: CONNECTION_MODES.CONNECT_STRING,
      connectionModeLabel: 'TNS (INI Salux)',
      connectionSummary: `TNS: ${name} — ${easyConnect}`
    };
  }

  const configDir = resolveTnsConfigDir(options);
  if (!configDir) {
    throw new Error(
      'Carregue o arquivo tnsnames.ora na interface ou configure ORACLE_TNS_ADMIN no servidor.'
    );
  }

  return {
    id: `tns:${name.toUpperCase()}`,
    type: 'oracle',
    label: `TNS: ${name}`,
    user,
    password,
    connectString: name.toUpperCase(),
    configDir,
    connectionMode: CONNECTION_MODES.TNS,
    connectionModeLabel: 'TNS (INI Salux)',
    connectionSummary: `TNS: ${name} — ${configDir}`
  };
}

export function resolveCompareEndpoint(endpoint) {
  const options = {
    tnsConfigId: endpoint?.tnsConfigId,
    oracleUser: endpoint?.oracleUser,
    oraclePassword: endpoint?.oraclePassword
  };

  if (endpoint?.tnsName?.trim()) {
    return resolveSaluxTnsConnection(endpoint.tnsName, options);
  }

  if (endpoint?.profileId) {
    const profile = getProfile(endpoint.profileId);
    if (!profile) {
      throw new Error(`Perfil "${endpoint.profileId}" não configurado.`);
    }

    if (options.oracleUser && options.oraclePassword) {
      return {
        ...profile,
        user: String(options.oracleUser).trim(),
        password: String(options.oraclePassword)
      };
    }

    return profile;
  }

  throw new Error('Informe profileId ou tnsName (ServerName do INI).');
}

export function getConnectionKey(config) {
  const passwordKey = config.password
    ? createHash('sha256').update(String(config.password)).digest('hex').slice(0, 8)
    : '';
  return `oracle:${config.user}@${config.connectString}@${config.configDir ?? ''}@${passwordKey}`;
}

export async function loadSaluxIniFromServer() {
  const iniPath = getSaluxIniPath();

  if (!iniPath) {
    return null;
  }

  const content = await readFile(iniPath, 'utf8');
  const parsed = parseSaluxIni(content);

  return {
    ...parsed,
    filePath: iniPath
  };
}
