/**
 * db.js — SQLite persistence using Node's built-in `node:sqlite` module
 * (no native build step). Creates the schema on first run.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} [file] path to the .db file, or ':memory:' for tests
 */
export function openDatabase(file = path.join(here, 'data', 'deadlock.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS simulations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      mode        TEXT    NOT NULL,
      title       TEXT    NOT NULL DEFAULT '',
      input_json  TEXT    NOT NULL,
      result_json TEXT    NOT NULL,
      summary     TEXT    NOT NULL DEFAULT '',
      deadlocks   INTEGER NOT NULL DEFAULT 0,
      steps       INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS game_scores (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      level       TEXT    NOT NULL,
      level_name  TEXT    NOT NULL DEFAULT '',
      score       INTEGER NOT NULL,
      moves       INTEGER NOT NULL,
      hints_used  INTEGER NOT NULL DEFAULT 0,
      deadlocked  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tutor_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      simulation_id INTEGER,
      mode          TEXT NOT NULL DEFAULT '',
      question      TEXT NOT NULL,
      intent        TEXT NOT NULL DEFAULT '',
      answer        TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}
