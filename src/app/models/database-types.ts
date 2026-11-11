export interface SaluxIniConnection {
  serverName: string;
  active: boolean;
}

export interface SaluxIniData {
  available: boolean;
  filePath?: string;
  message?: string;
  activeServerName?: string | null;
  dirExe?: string | null;
  connections: SaluxIniConnection[];
}

export type ConnectionSource = 'profile' | 'salux_ini' | 'local_tns';

export interface LocalTnsInfo {
  available: boolean;
  configDir?: string | null;
  aliases: string[];
  message?: string | null;
}

export type DatabaseType = 'oracle';

export interface ConnectionProfile {
  id: string;
  type: DatabaseType;
  label: string;
  connectionMode: 'connect_string' | 'tns' | 'easy_connect';
  connectionModeLabel: string;
  connectionSummary: string;
}

export interface ConnectionModeHelp {
  mode: string;
  label: string;
  description: string;
  variables: string[];
  examples: {
    primary: string[];
    secondary: string[];
  };
}

export interface CompareEndpoint {
  profileId?: string;
  tnsName?: string;
  tnsConfigId?: string;
  oracleUser?: string;
  oraclePassword?: string;
  schema: string;
  table?: string;
}

export type ConnectionTestState = 'idle' | 'testing' | 'success' | 'error';

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  connectionSummary?: string;
}
