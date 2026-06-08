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

const STRING_ORACLE_TYPES: OracleBaseType[] = ['VARCHAR2', 'CHAR', 'CLOB'];

export function isStringOracleType(baseType: string): boolean {
  return STRING_ORACLE_TYPES.includes(baseType.trim().toUpperCase() as OracleBaseType);
}

export function formatOracleDefaultValue(baseType: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (!isStringOracleType(baseType)) {
    return trimmed;
  }

  if (/^'.*'$/.test(trimmed)) {
    return trimmed;
  }

  if (/^[A-Z_][A-Z0-9_]*\s*\(/i.test(trimmed)) {
    return trimmed;
  }

  return `'${trimmed.replace(/'/g, "''")}'`;
}
