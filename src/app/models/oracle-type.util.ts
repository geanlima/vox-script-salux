export const ORACLE_BASE_TYPES = [
  'VARCHAR2',
  'CHAR',
  'NUMBER',
  'DATE',
  'TIMESTAMP',
  'CLOB',
  'BLOB'
] as const;

export type OracleBaseType = (typeof ORACLE_BASE_TYPES)[number];

const TYPES_WITH_SIZE: OracleBaseType[] = ['VARCHAR2', 'CHAR', 'NUMBER'];

export function requiresSize(baseType: string): boolean {
  return TYPES_WITH_SIZE.includes(baseType.trim().toUpperCase() as OracleBaseType);
}

export function sizeIsRequired(baseType: string): boolean {
  const base = baseType.trim().toUpperCase();
  return base === 'VARCHAR2' || base === 'CHAR';
}

export function buildOracleDataType(baseType: string, size: string): string {
  const base = baseType.trim().toUpperCase();
  const trimmedSize = size.trim();

  if (!requiresSize(base) || !trimmedSize) {
    return base;
  }

  return `${base}(${trimmedSize})`;
}
