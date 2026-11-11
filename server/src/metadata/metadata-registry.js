import { DATABASE_TYPES } from '../connections/connection-profiles.js';
import * as oracleProvider from './oracle-metadata-provider.js';

const providers = {
  [DATABASE_TYPES.ORACLE]: oracleProvider
};

export function getMetadataProvider(type) {
  const provider = providers[type];

  if (!provider) {
    throw new Error(`Tipo de banco "${type}" ainda não suportado.`);
  }

  return provider;
}

export function getProviderForProfile(profile) {
  return getMetadataProvider(profile.type);
}
