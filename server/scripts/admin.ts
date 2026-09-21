// Yönetim paneli hesapları.
//   npm run admin -- create <kullanici> [--password PAROLA]   (parola verilmezse rastgele üretilir ve yazdırılır)
//   npm run admin -- reset  <kullanici> [--password PAROLA]
//   npm run admin -- list
import { generatePassword, hashPassword, MIN_PASSWORD_LENGTH } from '../src/admin/password.ts'
import { loadConfig } from '../src/config.ts'
import { openDb } from '../src/db.ts'

const [cmd, userArg] = process.argv.slice(2)
const pwIdx = process.argv.indexOf('--password')
const given = pwIdx >= 0 ? process.argv[pwIdx + 1] : undefined
const db = openDb(loadConfig().dbPath)

if (cmd === 'create' || cmd === 'reset') {
  const username = userArg?.trim().toLowerCase()
  if (!username || !/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error('Geçerli kullanıcı adı ver (3-32: harf, rakam, . _ -)')
  const password = given ?? generatePassword()
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Parola en az ${MIN_PASSWORD_LENGTH} karakter olmalı`)
  const hash = await hashPassword(password)
  const exists = db.prepare('SELECT id FROM admins WHERE username = ?').get(username)
  if (cmd === 'create') {
    if (exists) throw new Error('Bu kullanıcı zaten var (parola için: reset)')
    db.prepare('INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)').run(username, hash, Date.now())
  } else {
    if (!exists) throw new Error('Kullanıcı yok')
    db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?').run(hash, username)
    db.prepare('DELETE FROM admin_sessions WHERE admin_id = (SELECT id FROM admins WHERE username = ?)').run(username)
  }
  console.log(`kullanıcı: ${username}\nparola:    ${password}`)
} else if (cmd === 'list') {
  for (const a of db.prepare('SELECT username, created_at, last_login_at FROM admins ORDER BY id').all() as { username: string; created_at: number; last_login_at: number | null }[]) {
    console.log(`${a.username}\toluşturma ${new Date(a.created_at).toISOString()}\tson giriş ${a.last_login_at ? new Date(a.last_login_at).toISOString() : '-'}`)
  }
} else {
  console.error('Komutlar: create | reset | list')
  process.exit(1)
}
db.close()
