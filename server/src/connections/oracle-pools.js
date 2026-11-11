import oracledb from 'oracledb';
import { getConnectionKey, resolveSaluxTnsConnection } from './connection-resolver.js';
import { getProfile } from './connection-profiles.js';

const pools = new Map();

async function createPool(config) {
    const poolConfig = {
      user: config.user,
      password: config.password,
      connectString: config.connectString,
      poolMin: 0,
      poolMax: 4,
      connectTimeout: 5
    };

  if (config.configDir) {
    poolConfig.configDir = config.configDir;
  }

  return oracledb.createPool(poolConfig);
}

export async function getOraclePoolForConfig(config) {
  const key = getConnectionKey(config);

  if (!pools.has(key)) {
    const pool = await createPool(config);
    pools.set(key, pool);
  }

  return pools.get(key);
}

export async function getOraclePool(profileId) {
  const profile = getProfile(profileId);

  if (!profile) {
    throw new Error(`Perfil de conexão "${profileId}" não configurado.`);
  }

  if (profile.type !== 'oracle') {
    throw new Error(`Perfil "${profileId}" não é Oracle.`);
  }

  return getOraclePoolForConfig(profile);
}

export async function withConfigConnection(config, fn) {
  const pool = await getOraclePoolForConfig(config);
  const connection = await pool.getConnection();

  try {
    return await fn(connection);
  } finally {
    await connection.close();
  }
}

export async function withProfileConnection(profileId, fn) {
  const profile = getProfile(profileId);

  if (!profile) {
    throw new Error(`Perfil de conexão "${profileId}" não configurado.`);
  }

  return withConfigConnection(profile, fn);
}

export async function withTnsConnection(tnsName, fn) {
  const config = resolveSaluxTnsConnection(tnsName);
  return withConfigConnection(config, fn);
}

export async function closeAllPools() {
  for (const [, pool] of pools.entries()) {
    await pool.close(0);
  }
  pools.clear();
}
