import oracledb from 'oracledb';
import { waitForOraclePool, withOracleConnection } from '../oracle-validator.js';
import { hashPassword } from '../auth/auth-utils.js';

const MASTER_USERNAME = (process.env.MASTER_USERNAME ?? 'master').trim().toLowerCase();
const MASTER_PASSWORD = process.env.MASTER_PASSWORD ?? 'master@123';

let schemaInitialized = false;

export async function initUserSchema() {
  if (schemaInitialized) {
    return;
  }

  await waitForOraclePool();

  await withOracleConnection(async (connection) => {
    const exists = await connection.execute(
      `SELECT COUNT(*) AS cnt FROM user_tables WHERE table_name = 'VOX_USERS'`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (Number(exists.rows[0].CNT) === 0) {
      await connection.execute(`
        CREATE TABLE vox_users (
          id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          username VARCHAR2(50) NOT NULL UNIQUE,
          display_name VARCHAR2(100) NOT NULL,
          password_hash VARCHAR2(300) NOT NULL,
          role VARCHAR2(20) DEFAULT 'user' NOT NULL,
          created_at TIMESTAMP DEFAULT SYSTimestamp NOT NULL,
          updated_at TIMESTAMP DEFAULT SYSTimestamp NOT NULL
        )
      `);
      await connection.commit();
    }

    const master = await connection.execute(
      `SELECT COUNT(*) AS cnt FROM vox_users WHERE role = 'master'`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (Number(master.rows[0].CNT) === 0) {
      await connection.execute(
        `INSERT INTO vox_users (username, display_name, password_hash, role)
         VALUES (:username, :displayName, :passwordHash, 'master')`,
        {
          username: MASTER_USERNAME,
          displayName: 'Administrador',
          passwordHash: hashPassword(MASTER_PASSWORD)
        },
        { autoCommit: true }
      );
      console.log(`Usuário master "${MASTER_USERNAME}" criado.`);
    }
  });

  schemaInitialized = true;
}

function mapUserRow(row) {
  return {
    id: Number(row.ID),
    username: row.USERNAME,
    displayName: row.DISPLAY_NAME,
    passwordHash: row.PASSWORD_HASH,
    role: row.ROLE,
    createdAt: row.CREATED_AT
  };
}

export async function findUserByUsername(username) {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT * FROM vox_users WHERE username = :username`,
      { username: String(username ?? '').trim().toLowerCase() },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return result.rows.length > 0 ? mapUserRow(result.rows[0]) : null;
  });
}

export async function findUserById(id) {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT * FROM vox_users WHERE id = :id`,
      { id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return result.rows.length > 0 ? mapUserRow(result.rows[0]) : null;
  });
}

export async function createUser({ username, displayName, password }) {
  let newId;

  await withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `INSERT INTO vox_users (username, display_name, password_hash, role)
       VALUES (:username, :displayName, :passwordHash, 'user')
       RETURNING id INTO :id`,
      {
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        passwordHash: hashPassword(password),
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: true }
    );

    const outId = result.outBinds?.id;
    newId = Array.isArray(outId) ? outId[0] : outId;
  });

  return findUserById(Number(newId));
}

export async function updateUserPassword(id, newPassword) {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `UPDATE vox_users
       SET password_hash = :passwordHash, updated_at = SYSTimestamp
       WHERE id = :id`,
      { id, passwordHash: hashPassword(newPassword) },
      { autoCommit: true }
    );

    return result.rowsAffected > 0;
  });
}
