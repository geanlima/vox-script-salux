export const CONNECTION_MODES = {
  CONNECT_STRING: 'connect_string',
  TNS: 'tns',
  EASY_CONNECT: 'easy_connect'
};

const MODE_LABELS = {
  [CONNECTION_MODES.CONNECT_STRING]: 'Connection String',
  [CONNECTION_MODES.TNS]: 'TNS (tnsnames.ora)',
  [CONNECTION_MODES.EASY_CONNECT]: 'Easy Connect (host/porta/serviço)'
};

function readEnv(envPrefix, suffix) {
  return process.env[`${envPrefix}_${suffix}`]?.trim() ?? '';
}

function detectConnectionMode(envPrefix) {
  if (readEnv(envPrefix, 'CONNECT_STRING')) {
    return CONNECTION_MODES.CONNECT_STRING;
  }

  if (readEnv(envPrefix, 'TNS_NAME')) {
    return CONNECTION_MODES.TNS;
  }

  if (readEnv(envPrefix, 'HOST')) {
    return CONNECTION_MODES.EASY_CONNECT;
  }

  return null;
}

function buildConnectString(envPrefix, mode) {
  switch (mode) {
    case CONNECTION_MODES.CONNECT_STRING: {
      const connectString = readEnv(envPrefix, 'CONNECT_STRING');
      if (!connectString) {
        throw new Error(`Informe ${envPrefix}_CONNECT_STRING.`);
      }
      return { connectString, configDir: null };
    }

    case CONNECTION_MODES.TNS: {
      const tnsName = readEnv(envPrefix, 'TNS_NAME');
      if (!tnsName) {
        throw new Error(`Informe ${envPrefix}_TNS_NAME.`);
      }
      const configDir = readEnv(envPrefix, 'TNS_ADMIN') || null;
      return { connectString: tnsName, configDir };
    }

    case CONNECTION_MODES.EASY_CONNECT: {
      const host = readEnv(envPrefix, 'HOST');
      const port = readEnv(envPrefix, 'PORT') || '1521';
      const serviceName = readEnv(envPrefix, 'SERVICE_NAME');
      const sid = readEnv(envPrefix, 'SID');

      if (!host) {
        throw new Error(`Informe ${envPrefix}_HOST.`);
      }

      if (serviceName) {
        return { connectString: `${host}:${port}/${serviceName}`, configDir: null };
      }

      if (sid) {
        return { connectString: `${host}:${port}:${sid}`, configDir: null };
      }

      throw new Error(
        `Informe ${envPrefix}_SERVICE_NAME ou ${envPrefix}_SID para Easy Connect.`
      );
    }

    default:
      throw new Error(
        `Modo de conexão "${mode}" inválido. Use connect_string, tns ou easy_connect.`
      );
  }
}

function buildConnectionSummary(mode, connectString, configDir) {
  const label = MODE_LABELS[mode] ?? mode;

  if (mode === CONNECTION_MODES.TNS) {
    const admin = configDir ? ` — admin: ${configDir}` : '';
    return `${label}: ${connectString}${admin}`;
  }

  return `${label}: ${connectString}`;
}

/**
 * Resolve credenciais e connect string a partir do prefixo de variáveis de ambiente.
 * Ex.: ORACLE (ORACLE_USER, ORACLE_CONNECT_STRING) ou ORACLE_COMPARE (ORACLE_COMPARE_USER, ...).
 */
export function resolveOracleConnection(envPrefix) {
  const user = readEnv(envPrefix, 'USER');
  const password = readEnv(envPrefix, 'PASSWORD');
  const explicitMode = readEnv(envPrefix, 'CONNECTION_MODE').toLowerCase();
  const mode = explicitMode || detectConnectionMode(envPrefix);

  if (!user || !password) {
    return {
      valid: false,
      envPrefix,
      user: user || null,
      password: null,
      connectString: null,
      configDir: null,
      connectionMode: mode,
      connectionModeLabel: mode ? MODE_LABELS[mode] : null,
      connectionSummary: null
    };
  }

  if (!mode) {
    return {
      valid: false,
      envPrefix,
      user,
      password: null,
      connectString: null,
      configDir: null,
      connectionMode: null,
      connectionModeLabel: null,
      connectionSummary: null,
      error: `Configure a conexão com ${envPrefix}_CONNECTION_MODE ou informe ${envPrefix}_CONNECT_STRING, ${envPrefix}_TNS_NAME ou ${envPrefix}_HOST.`
    };
  }

  try {
    const { connectString, configDir } = buildConnectString(envPrefix, mode);

    return {
      valid: true,
      envPrefix,
      user,
      password,
      connectString,
      configDir,
      connectionMode: mode,
      connectionModeLabel: MODE_LABELS[mode],
      connectionSummary: buildConnectionSummary(mode, connectString, configDir)
    };
  } catch (error) {
    return {
      valid: false,
      envPrefix,
      user,
      password: null,
      connectString: null,
      configDir: null,
      connectionMode: mode,
      connectionModeLabel: MODE_LABELS[mode],
      connectionSummary: null,
      error: error.message
    };
  }
}

export function getConnectionModeHelp() {
  return [
    {
      mode: CONNECTION_MODES.CONNECT_STRING,
      label: MODE_LABELS[CONNECTION_MODES.CONNECT_STRING],
      description: 'String completa de conexão Oracle (Easy Connect ou descriptor TNS).',
      variables: ['{PREFIX}_CONNECTION_MODE=connect_string', '{PREFIX}_CONNECT_STRING=host:1521/servico']
    },
    {
      mode: CONNECTION_MODES.TNS,
      label: MODE_LABELS[CONNECTION_MODES.TNS],
      description: 'Alias definido no tnsnames.ora.',
      variables: [
        '{PREFIX}_CONNECTION_MODE=tns',
        '{PREFIX}_TNS_NAME=MEU_ALIAS',
        '{PREFIX}_TNS_ADMIN=/caminho/para/network/admin (opcional)'
      ]
    },
    {
      mode: CONNECTION_MODES.EASY_CONNECT,
      label: MODE_LABELS[CONNECTION_MODES.EASY_CONNECT],
      description: 'Host, porta e service name ou SID montados automaticamente.',
      variables: [
        '{PREFIX}_CONNECTION_MODE=easy_connect',
        '{PREFIX}_HOST=meu-servidor',
        '{PREFIX}_PORT=1521',
        '{PREFIX}_SERVICE_NAME=XE ou {PREFIX}_SID=ORCL'
      ]
    }
  ];
}
