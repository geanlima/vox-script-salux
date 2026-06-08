import oracledb from 'oracledb';
import { splitOracleScript } from './script-splitter.js';

let pool = null;

export function isOracleConfigured() {
  return Boolean(
    process.env.ORACLE_USER &&
      process.env.ORACLE_PASSWORD &&
      process.env.ORACLE_CONNECT_STRING
  );
}

export async function initOraclePool() {
  if (!isOracleConfigured()) {
    return false;
  }

  if (pool) {
    return true;
  }

  pool = await oracledb.createPool({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
    poolMin: 0,
    poolMax: 4
  });

  return true;
}

export async function closeOraclePool() {
  if (pool) {
    await pool.close(0);
    pool = null;
  }
}

function getLanguageFlag(sql) {
  const upper = sql.trim().toUpperCase();

  if (
    upper.startsWith('DECLARE') ||
    upper.startsWith('BEGIN') ||
    /^CREATE\s+OR\s+REPLACE\s+(FUNCTION|PROCEDURE|TRIGGER|PACKAGE)/.test(upper)
  ) {
    return 2;
  }

  return 1;
}

export async function parseStatement(connection, sql) {
  const languageFlag = getLanguageFlag(sql);

  await connection.execute(
    `DECLARE
       l_cursor INTEGER;
     BEGIN
       l_cursor := DBMS_SQL.OPEN_CURSOR;
       DBMS_SQL.PARSE(l_cursor, :sql, :languageFlag);
       DBMS_SQL.CLOSE_CURSOR(l_cursor);
     EXCEPTION
       WHEN OTHERS THEN
         IF DBMS_SQL.IS_OPEN(l_cursor) THEN
           DBMS_SQL.CLOSE_CURSOR(l_cursor);
         END IF;
         RAISE;
     END;`,
    { sql, languageFlag },
    { autoCommit: false }
  );
}

export async function prevalidateScript(sql) {
  if (!pool) {
    throw new Error('Pool Oracle não inicializado.');
  }

  const statements = splitOracleScript(sql);
  const errors = [];
  const statementResults = [];
  const connection = await pool.getConnection();

  try {
    for (const statement of statements) {
      try {
        await parseStatement(connection, statement.text);
        statementResults.push({
          index: statement.index,
          linha: statement.startLine,
          preview: statement.preview,
          valid: true
        });
      } catch (error) {
        const message = error?.message ?? 'Erro desconhecido ao analisar o comando.';
        errors.push({
          linha: statement.startLine,
          descricao: `Comando ${statement.index}: ${message}`
        });
        statementResults.push({
          index: statement.index,
          linha: statement.startLine,
          preview: statement.preview,
          valid: false,
          error: message
        });
      }
    }
  } finally {
    await connection.close();
  }

  const success = errors.length === 0;
  return {
    mode: 'oracle',
    success,
    message: success
      ? `Pré-validação Oracle OK: ${statements.length} comando(s) com sintaxe válida.`
      : `Pré-validação Oracle encontrou ${errors.length} erro(s) de sintaxe.`,
    statements: statementResults,
    errors,
    oracleAvailable: true
  };
}
