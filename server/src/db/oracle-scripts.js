import oracledb from 'oracledb';
import {
  isOracleConfigured,
  isOracleReady,
  waitForOraclePool,
  withOracleConnection
} from '../oracle-validator.js';

export { isOracleConfigured, isOracleReady, waitForOraclePool };

export function isScriptStorageConfigured() {
  return isOracleConfigured();
}

export async function isScriptStorageReady() {
  return isOracleReady();
}

export async function initScriptStorageSchema() {
  await waitForOraclePool();

  await withOracleConnection(async (connection) => {
    const exists = await connection.execute(
      `SELECT COUNT(*) AS cnt FROM user_tables WHERE table_name = 'VOX_SCRIPTS'`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (Number(exists.rows[0].CNT) > 0) {
      return;
    }

    await connection.execute(`
      CREATE TABLE vox_scripts (
        id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        card_number VARCHAR2(50) NOT NULL,
        script_type VARCHAR2(50) NOT NULL,
        table_name VARCHAR2(30),
        file_name VARCHAR2(255) NOT NULL,
        form_data CLOB NOT NULL,
        generated_sql CLOB NOT NULL,
        created_at TIMESTAMP DEFAULT SYSTimestamp NOT NULL,
        updated_at TIMESTAMP DEFAULT SYSTimestamp NOT NULL
      )
    `);

    await connection.execute(`
      CREATE INDEX idx_vox_scripts_card ON vox_scripts (card_number)
    `);
    await connection.execute(`
      CREATE INDEX idx_vox_scripts_type ON vox_scripts (script_type)
    `);
    await connection.execute(`
      CREATE INDEX idx_vox_scripts_updated ON vox_scripts (updated_at DESC)
    `);

    await connection.commit();
  });
}

async function readClob(value) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value.getData === 'function') {
    return await value.getData();
  }
  return String(value);
}

function mapSummaryRow(row) {
  return {
    id: Number(row.ID),
    cardNumber: row.CARD_NUMBER,
    scriptType: row.SCRIPT_TYPE,
    tableName: row.TABLE_NAME,
    fileName: row.FILE_NAME,
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT
  };
}

async function mapFullRow(row) {
  const formDataRaw = await readClob(row.FORM_DATA);
  return {
    ...mapSummaryRow(row),
    formData: JSON.parse(formDataRaw),
    generatedSql: await readClob(row.GENERATED_SQL)
  };
}

export async function listScripts(filters = {}) {
  return withOracleConnection(async (connection) => {
    let sql = `
      SELECT id, card_number, script_type, table_name, file_name, created_at, updated_at
      FROM vox_scripts
      WHERE 1 = 1
    `;
    const binds = {};
    const limit = Math.min(Number(filters.limit ?? 100) || 100, 500);

    if (filters.cardNumber?.trim()) {
      sql += ' AND UPPER(card_number) LIKE UPPER(:cardNumber)';
      binds.cardNumber = `%${filters.cardNumber.trim()}%`;
    }

    if (filters.scriptType?.trim()) {
      sql += ' AND script_type = :scriptType';
      binds.scriptType = filters.scriptType.trim().toUpperCase();
    }

    if (filters.q?.trim()) {
      sql += `
        AND (
          UPPER(file_name) LIKE UPPER(:search)
          OR UPPER(NVL(table_name, ' ')) LIKE UPPER(:search)
          OR UPPER(card_number) LIKE UPPER(:search)
        )
      `;
      binds.search = `%${filters.q.trim()}%`;
    }

    sql += ' ORDER BY updated_at DESC FETCH FIRST :limit ROWS ONLY';
    binds.limit = limit;

    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT
    });

    return result.rows.map(mapSummaryRow);
  });
}

export async function getScriptById(id) {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT * FROM vox_scripts WHERE id = :id`,
      { id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapFullRow(result.rows[0]);
  });
}

export async function createScript(payload) {
  const { formData, generatedSql, fileName } = payload;
  let newId;

  await withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `INSERT INTO vox_scripts (
         card_number, script_type, table_name, file_name, form_data, generated_sql
       ) VALUES (
         :cardNumber, :scriptType, :tableName, :fileName, :formData, :generatedSql
       ) RETURNING id INTO :id`,
      {
        cardNumber: formData.cardNumber.trim(),
        scriptType: formData.scriptType.trim(),
        tableName: formData.tableName?.trim() || null,
        fileName: fileName.trim(),
        formData: JSON.stringify(formData),
        generatedSql: generatedSql.trim(),
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: true }
    );

    const outId = result.outBinds?.id;
    newId = Array.isArray(outId) ? outId[0] : outId;
  });

  return getScriptById(Number(newId));
}

export async function updateScript(id, payload) {
  const { formData, generatedSql, fileName } = payload;

  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `UPDATE vox_scripts
       SET card_number = :cardNumber,
           script_type = :scriptType,
           table_name = :tableName,
           file_name = :fileName,
           form_data = :formData,
           generated_sql = :generatedSql,
           updated_at = SYSTimestamp
       WHERE id = :id`,
      {
        id,
        cardNumber: formData.cardNumber.trim(),
        scriptType: formData.scriptType.trim(),
        tableName: formData.tableName?.trim() || null,
        fileName: fileName.trim(),
        formData: JSON.stringify(formData),
        generatedSql: generatedSql.trim()
      },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return null;
    }

    return getScriptById(id);
  });
}

export async function deleteScript(id) {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `DELETE FROM vox_scripts WHERE id = :id`,
      { id },
      { autoCommit: true }
    );

    return result.rowsAffected > 0;
  });
}
