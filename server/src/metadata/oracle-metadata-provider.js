import oracledb from 'oracledb';
import { withConfigConnection } from '../connections/oracle-pools.js';

function buildDataType(row) {
  const type = row.DATA_TYPE;

  if (type === 'NUMBER') {
    if (row.DATA_PRECISION != null) {
      return row.DATA_SCALE != null && row.DATA_SCALE > 0
        ? `NUMBER(${row.DATA_PRECISION},${row.DATA_SCALE})`
        : `NUMBER(${row.DATA_PRECISION})`;
    }
    return 'NUMBER';
  }

  if (['VARCHAR2', 'CHAR', 'NVARCHAR2', 'NCHAR', 'RAW'].includes(type)) {
    return row.DATA_LENGTH ? `${type}(${row.DATA_LENGTH})` : type;
  }

  if (type === 'TIMESTAMP' || type === 'TIMESTAMP WITH TIME ZONE' || type === 'TIMESTAMP WITH LOCAL TIME ZONE') {
    return row.DATA_SCALE != null ? `${type}(${row.DATA_SCALE})` : type;
  }

  if (type === 'FLOAT' && row.DATA_PRECISION != null) {
    return `FLOAT(${row.DATA_PRECISION})`;
  }

  return type;
}

function normalizeIdentifier(value) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeDefault(value) {
  if (value == null) {
    return null;
  }

  return String(value).trim().replace(/\s+/g, ' ');
}

export async function listSchemasForConfig(config) {
  return withConfigConnection(config, async (connection) => {
    const result = await connection.execute(
      `SELECT DISTINCT owner
       FROM all_tables
       WHERE owner NOT IN (
         'SYS', 'SYSTEM', 'OUTLN', 'DBSNMP', 'APPQOSSYS', 'WMSYS',
         'XDB', 'CTXSYS', 'ORDSYS', 'MDSYS', 'OLAPSYS', 'ORDDATA'
       )
       ORDER BY owner`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return (result.rows ?? []).map((row) => row.OWNER ?? row[0]);
  });
}

export async function listTablesForConfig(config, schema) {
  const owner = normalizeIdentifier(schema);

  return withConfigConnection(config, async (connection) => {
    const result = await connection.execute(
      `SELECT table_name
       FROM all_tables
       WHERE owner = :owner
       ORDER BY table_name`,
      { owner },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return (result.rows ?? []).map((row) => row.TABLE_NAME ?? row[0]);
  });
}

export async function getTableMetadataForConfig(config, schema, tableName) {
  const owner = normalizeIdentifier(schema);
  const table = normalizeIdentifier(tableName);

  return withConfigConnection(config, async (connection) => {
    const columnsResult = await connection.execute(
      `SELECT column_name, data_type, data_length, data_precision, data_scale,
              nullable, data_default, column_id
       FROM all_tab_columns
       WHERE owner = :owner AND table_name = :tableName
       ORDER BY column_id`,
      { owner, tableName: table },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const pkResult = await connection.execute(
      `SELECT cols.column_name, cols.position
       FROM all_constraints cons
       JOIN all_cons_columns cols
         ON cons.owner = cols.owner AND cons.constraint_name = cols.constraint_name
       WHERE cons.owner = :owner
         AND cons.table_name = :tableName
         AND cons.constraint_type = 'P'
       ORDER BY cols.position`,
      { owner, tableName: table },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const columns = (columnsResult.rows ?? []).map((row) => ({
      name: row.COLUMN_NAME ?? row[0],
      dataType: buildDataType({
        DATA_TYPE: row.DATA_TYPE ?? row[1],
        DATA_LENGTH: row.DATA_LENGTH ?? row[2],
        DATA_PRECISION: row.DATA_PRECISION ?? row[3],
        DATA_SCALE: row.DATA_SCALE ?? row[4]
      }),
      nullable: (row.NULLABLE ?? row[5]) === 'Y',
      defaultValue: normalizeDefault(row.DATA_DEFAULT ?? row[6]),
      position: row.COLUMN_ID ?? row[7]
    }));

    const primaryKey = (pkResult.rows ?? [])
      .map((row) => row.COLUMN_NAME ?? row[0])
      .filter(Boolean);

    return {
      schema: owner,
      table,
      columns,
      primaryKey
    };
  });
}

export async function getSchemaMetadataForConfig(config, schema, tableFilter = null) {
  const tables = await listTablesForConfig(config, schema);
  const filtered = tableFilter
    ? tables.filter((name) => normalizeIdentifier(name) === normalizeIdentifier(tableFilter))
    : tables;

  const tableMetadata = [];

  for (const table of filtered) {
    tableMetadata.push(await getTableMetadataForConfig(config, schema, table));
  }

  return tableMetadata;
}

// Compatibilidade com profileId (rotas legadas)
export async function listSchemas(profileId) {
  const { getProfile } = await import('../connections/connection-profiles.js');
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error(`Perfil "${profileId}" não configurado.`);
  }
  return listSchemasForConfig(profile);
}

export async function listTables(profileId, schema) {
  const { getProfile } = await import('../connections/connection-profiles.js');
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error(`Perfil "${profileId}" não configurado.`);
  }
  return listTablesForConfig(profile, schema);
}

export async function getTableMetadata(profileId, schema, tableName) {
  const { getProfile } = await import('../connections/connection-profiles.js');
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error(`Perfil "${profileId}" não configurado.`);
  }
  return getTableMetadataForConfig(profile, schema, tableName);
}

export async function getSchemaMetadata(profileId, schema, tableFilter = null) {
  const { getProfile } = await import('../connections/connection-profiles.js');
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error(`Perfil "${profileId}" não configurado.`);
  }
  return getSchemaMetadataForConfig(profile, schema, tableFilter);
}
