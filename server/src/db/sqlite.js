import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let database;

export function getSqliteDatabase() {
  if (database) {
    return database;
  }

  const filename = process.env.SQLITE_DB_PATH || path.resolve('data/vox-script-salux.sqlite');
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  database = new Database(filename);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');

  return database;
}