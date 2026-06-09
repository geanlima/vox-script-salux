export const MAX_OBJECT_NAME_LENGTH = 30;

export function normalizeObjectName(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '_');
}

export function formatConstraintSequence(sequence: number): string {
  const n = Number(sequence);
  const safe = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  return String(safe).padStart(2, '0');
}

export function buildSequencedConstraintName(
  prefix: 'FK' | 'CKC',
  table: string,
  sequence: number
): string {
  const normalizedTable = normalizeObjectName(table) || 'TABELA';
  const seq = formatConstraintSequence(sequence);
  const suffix = `_${seq}`;
  const prefixPart = `${prefix}_`;
  const maxTableLen = MAX_OBJECT_NAME_LENGTH - prefixPart.length - suffix.length;
  const tablePart =
    normalizedTable.length > maxTableLen
      ? normalizedTable.substring(0, maxTableLen)
      : normalizedTable;

  return `${prefixPart}${tablePart}${suffix}`;
}

export function buildCkcConstraintName(table: string, sequence: number): string {
  return buildSequencedConstraintName('CKC', table, sequence);
}

export function buildFkConstraintName(table: string, sequence: number): string {
  return buildSequencedConstraintName('FK', table, sequence);
}
