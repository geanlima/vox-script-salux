import { getSqliteDatabase } from './sqlite.js';
import { hashPassword } from '../auth/auth-utils.js';

const MASTER_USERNAME = (process.env.MASTER_USERNAME ?? 'master').trim().toLowerCase();
const MASTER_PASSWORD = process.env.MASTER_PASSWORD ?? 'master@123';

function mapUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at
  };
}

export async function initUserSchema() {
  const db = getSqliteDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS vox_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const master = db.prepare("SELECT id FROM vox_users WHERE role = 'master' LIMIT 1").get();
  if (!master) {
    db.prepare(`
      INSERT INTO vox_users (username, display_name, password_hash, role)
      VALUES (?, ?, ?, 'master')
    `).run(MASTER_USERNAME, 'Administrador', hashPassword(MASTER_PASSWORD));
    console.log(`Usuário master "${MASTER_USERNAME}" criado no SQLite.`);
  }
}

export async function findUserByUsername(username) {
  const row = getSqliteDatabase()
    .prepare('SELECT * FROM vox_users WHERE username = ?')
    .get(String(username ?? '').trim().toLowerCase());
  return mapUser(row);
}

export async function findUserById(id) {
  const row = getSqliteDatabase().prepare('SELECT * FROM vox_users WHERE id = ?').get(Number(id));
  return mapUser(row);
}

export async function createUser({ username, displayName, password }) {
  const result = getSqliteDatabase().prepare(`
    INSERT INTO vox_users (username, display_name, password_hash, role)
    VALUES (?, ?, ?, 'user')
  `).run(username.trim().toLowerCase(), displayName.trim(), hashPassword(password));
  return findUserById(Number(result.lastInsertRowid));
}

export async function updateUserPassword(id, newPassword) {
  const result = getSqliteDatabase().prepare(`
    UPDATE vox_users
    SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(hashPassword(newPassword), Number(id));
  return result.changes > 0;
}