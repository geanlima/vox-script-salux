/**
 * Perfis de conexão configurados via variáveis de ambiente.
 * Para adicionar um novo banco, registre um perfil aqui e implemente o provider em metadata/.
 */

import { resolveOracleConnection } from './oracle-connect-string.js';

export const DATABASE_TYPES = {
  ORACLE: 'oracle'
};

const PROFILE_DEFINITIONS = [
  {
    id: 'oracle-primary',
    type: DATABASE_TYPES.ORACLE,
    label: 'Oracle Principal',
    envPrefix: 'ORACLE'
  },
  {
    id: 'oracle-secondary',
    type: DATABASE_TYPES.ORACLE,
    label: 'Oracle Secundário',
    envPrefix: 'ORACLE_COMPARE'
  }
];

function readProfileConfig(definition) {
  const resolved = resolveOracleConnection(definition.envPrefix);

  if (!resolved.valid) {
    return null;
  }

  return {
    id: definition.id,
    type: definition.type,
    label: definition.label,
    envPrefix: definition.envPrefix,
    user: resolved.user,
    password: resolved.password,
    connectString: resolved.connectString,
    configDir: resolved.configDir,
    connectionMode: resolved.connectionMode,
    connectionModeLabel: resolved.connectionModeLabel,
    connectionSummary: resolved.connectionSummary
  };
}

export function getConfiguredProfiles() {
  return PROFILE_DEFINITIONS.map(readProfileConfig).filter(Boolean);
}

export function getProfile(profileId) {
  return getConfiguredProfiles().find((profile) => profile.id === profileId) ?? null;
}

export function getProfileDefinitions() {
  return PROFILE_DEFINITIONS;
}

export function isCompareConfigured() {
  return getConfiguredProfiles().length > 0;
}

export function getPublicProfileInfo(profile) {
  return {
    id: profile.id,
    type: profile.type,
    label: profile.label,
    connectionMode: profile.connectionMode,
    connectionModeLabel: profile.connectionModeLabel,
    connectionSummary: profile.connectionSummary
  };
}
