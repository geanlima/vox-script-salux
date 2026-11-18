import { getSqliteDatabase } from './sqlite.js';

export function isScriptStorageConfigured() {
  return true;
}

export async function isScriptStorageReady() {
  try {
    getSqliteDatabase().prepare('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}

export async function initScriptStorageSchema() {
  const db = getSqliteDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS vox_scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      card_number TEXT NOT NULL,
      script_type TEXT NOT NULL,
      table_name TEXT,
      file_name TEXT NOT NULL,
      form_data TEXT NOT NULL,
      generated_sql TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES vox_users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vox_scripts_card ON vox_scripts (card_number);
    CREATE INDEX IF NOT EXISTS idx_vox_scripts_type ON vox_scripts (script_type);
    CREATE INDEX IF NOT EXISTS idx_vox_scripts_updated ON vox_scripts (updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_vox_scripts_user ON vox_scripts (user_id);
  `);
}

function mapSummaryRow(row) {
  return {
    id: Number(row.id),
    cardNumber: row.card_number,
    scriptType: row.script_type,
    tableName: row.table_name,
    fileName: row.file_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id == null ? null : Number(row.user_id),
    ownerName: row.owner_name ?? null
  };
}

function mapFullRow(row) {
  return {
    ...mapSummaryRow(row),
    formData: JSON.parse(row.form_data),
    generatedSql: row.generated_sql
  };
}

export async function listScripts(filters = {}, ownerUserId = null) {
  const clauses = [];
  const values = [];

  if (ownerUserId != null) {
    clauses.push('s.user_id = ?');
    values.push(Number(ownerUserId));
  }
  if (filters.cardNumber?.trim()) {
    clauses.push('UPPER(s.card_number) LIKE UPPER(?)');
    values.push(`%${filters.cardNumber.trim()}%`);
  }
  if (filters.scriptType?.trim()) {
    clauses.push('UPPER(s.script_type) = UPPER(?)');
    values.push(filters.scriptType.trim());
  }
  if (filters.q?.trim()) {
    clauses.push(`(
      UPPER(s.file_name) LIKE UPPER(?) OR
      UPPER(COALESCE(s.table_name, ' ')) LIKE UPPER(?) OR
      UPPER(s.card_number) LIKE UPPER(?)
    )`);
    const search = `%${filters.q.trim()}%`;
    values.push(search, search, search);
  }

  const limit = Math.min(Number(filters.limit ?? 100) || 100, 500);
  values.push(limit);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = getSqliteDatabase().prepare(`
    SELECT s.id, s.card_number, s.script_type, s.table_name, s.file_name,
           s.created_at, s.updated_at, s.user_id, u.display_name AS owner_name
    FROM vox_scripts s
    LEFT JOIN vox_users u ON u.id = s.user_id
    ${where}
    ORDER BY s.updated_at DESC, s.id DESC
    LIMIT ?
  `).all(...values);

  return rows.map(mapSummaryRow);
}

export async function getScriptById(id) {
  const row = getSqliteDatabase().prepare(`
    SELECT s.*, u.display_name AS owner_name
    FROM vox_scripts s
    LEFT JOIN vox_users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(Number(id));
  return row ? mapFullRow(row) : null;
}

export async function createScript(payload, userId = null) {
  const { formData, generatedSql, fileName } = payload;
  const result = getSqliteDatabase().prepare(`
    INSERT INTO vox_scripts (
      user_id, card_number, script_type, table_name, file_name, form_data, generated_sql
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId == null ? null : Number(userId),
    formData.cardNumber.trim(),
    formData.scriptType.trim(),
    formData.tableName?.trim() || null,
    fileName.trim(),
    JSON.stringify(formData),
    generatedSql.trim()
  );

  return getScriptById(Number(result.lastInsertRowid));
}

export async function updateScript(id, payload) {
  const { formData, generatedSql, fileName } = payload;
  const result = getSqliteDatabase().prepare(`
    UPDATE vox_scripts
    SET card_number = ?, script_type = ?, table_name = ?, file_name = ?,
        form_data = ?, generated_sql = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    formData.cardNumber.trim(),
    formData.scriptType.trim(),
    formData.tableName?.trim() || null,
    fileName.trim(),
    JSON.stringify(formData),
    generatedSql.trim(),
    Number(id)
  );

  return result.changes > 0 ? getScriptById(id) : null;
}

export async function deleteScript(id) {
  const result = getSqliteDatabase().prepare('DELETE FROM vox_scripts WHERE id = ?').run(Number(id));
  return result.changes > 0;
}