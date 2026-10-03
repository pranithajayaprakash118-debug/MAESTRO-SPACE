const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const databaseDirectory = path.join(__dirname, 'database');
fs.mkdirSync(databaseDirectory, { recursive: true });

const database = new Database(path.join(databaseDirectory, 'faculty.db'));

database.exec(`
  CREATE TABLE IF NOT EXISTS faculty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    department TEXT,
    designation TEXT,
    phone TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    picture_data BLOB,
    picture_mime_type TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

database.prepare(`
  INSERT OR IGNORE INTO profile (id, name, email)
  VALUES (1, 'Faculty', '')
`).run();

database.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    important INTEGER NOT NULL DEFAULT 0,
    highlighted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS timetable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    days TEXT NOT NULL,
    periods TEXT NOT NULL,
    classes TEXT NOT NULL,
    show_on_dashboard INTEGER NOT NULL DEFAULT 0
  );
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    class_name TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '📚',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS pending_works (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task TEXT NOT NULL,
    deadline TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Medium',
    status TEXT NOT NULL DEFAULT 'Pending',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT '',
    file_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT '',
    file_id INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = database;