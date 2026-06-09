/**
 * Erros semânticos esperados em um banco de validação vazio (sem tabelas reais).
 * A sintaxe foi aceita pelo parser Oracle; o objeto referenciado não existe no sandbox.
 * @see https://asktom.oracle.com (classificar ORA codes após DBMS_SQL.PARSE)
 */
const IGNORABLE_SEMANTIC_ORA_CODES = new Set([
  904, // invalid identifier (coluna/objeto inexistente)
  942, // table or view does not exist
  955, // name is already used by an existing object
  1031, // insufficient privileges
  1418, // specified index does not exist
  2289, // sequence does not exist
  2431, // cannot drop constraint - nonexistent
  2443, // cannot drop constraint - nonexistent
  4043, // object does not exist
  4080, // trigger does not exist
  4081, // trigger already exists
  32594 // object not found for COMMENT ON
]);

export function extractOraCode(error) {
  const errorNum = error?.errorNum ?? error?.code;
  if (typeof errorNum === 'number') {
    return Math.abs(errorNum);
  }

  const match = String(error?.message ?? '').match(/ORA-(\d{5})/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function isIgnorableSemanticError(error) {
  const code = extractOraCode(error);
  return code !== null && IGNORABLE_SEMANTIC_ORA_CODES.has(code);
}

export function getOracleErrorSummary(error) {
  const message = error?.message ?? 'Erro desconhecido ao analisar o comando.';
  const firstLine = message.split('\n')[0]?.trim();
  return firstLine || message;
}
