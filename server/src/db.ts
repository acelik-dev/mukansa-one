import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type DB = DatabaseSync

// Her eleman bir sürüm; PRAGMA user_version ile takip edilir. Eski girdileri değiştirme, yenisini ekle.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE devices (
    id INTEGER PRIMARY KEY,
    activation_code TEXT NOT NULL UNIQUE,
    serial_no TEXT NOT NULL UNIQUE,
    model_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    activated_at INTEGER,
    filter_installed_at INTEGER,
    onboarded_at INTEGER,
    household TEXT,
    notif TEXT
  );

  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    platform TEXT,
    push_token TEXT
  );
  CREATE INDEX sessions_device ON sessions(device_id);
  CREATE UNIQUE INDEX sessions_push_token ON sessions(push_token) WHERE push_token IS NOT NULL;

  CREATE TABLE notification_log (
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    sent_at INTEGER NOT NULL,
    delivered INTEGER NOT NULL,
    PRIMARY KEY (device_id, key)
  );
  `,
  // v2: yönetim paneli (admin hesapları/oturumları, denetim günlüğü), cihaz engelleme/not, bildirim içeriği
  `
  ALTER TABLE devices ADD COLUMN note TEXT;
  ALTER TABLE devices ADD COLUMN blocked_at INTEGER;
  ALTER TABLE notification_log ADD COLUMN title TEXT;
  ALTER TABLE notification_log ADD COLUMN body TEXT;

  CREATE TABLE admins (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER
  );

  CREATE TABLE admin_sessions (
    id INTEGER PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    ip TEXT,
    ua TEXT
  );

  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    at INTEGER NOT NULL,
    admin_name TEXT,
    action TEXT NOT NULL,
    device_id INTEGER,
    detail TEXT
  );
  CREATE INDEX audit_at ON audit_log(at DESC);
  CREATE INDEX audit_device ON audit_log(device_id);
  `,
  // v3: teknik servis talepleri (kullanıcı uygulamadan, yönetici panelden yönetir)
  `
  CREATE TABLE service_requests (
    id INTEGER PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    contact_name TEXT,
    contact_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    admin_note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX service_requests_device ON service_requests(device_id);
  CREATE INDEX service_requests_status ON service_requests(status, created_at DESC);
  `,
]

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  migrate(db)
  return db
}

function migrate(db: DB) {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[v]!)
      db.exec(`PRAGMA user_version = ${v + 1}`)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
}

export function tx<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
