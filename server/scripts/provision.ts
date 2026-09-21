// Cihaz aktivasyon kodu üretimi / içe aktarımı.
//   npm run provision -- generate --model pro --count 5
//   npm run provision -- import kodlar.csv        (satır: KOD,model)
//   npm run provision -- list
import { readFileSync } from 'node:fs'
import { MODELS } from '../../mobile/src/lib/calc.ts'
import { generateCode, normalizeCode, serialFromCode } from '../src/codes.ts'
import { loadConfig } from '../src/config.ts'
import { openDb, type DB } from '../src/db.ts'

function insert(db: DB, code: string, modelId: string): boolean {
  const res = db
    .prepare(
      'INSERT OR IGNORE INTO devices (activation_code, serial_no, model_id, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(code, serialFromCode(code), modelId, Date.now())
  return Number(res.changes) === 1
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}

const db = openDb(loadConfig().dbPath)
const cmd = process.argv[2]

if (cmd === 'generate') {
  const model = arg('model', 'pro')!
  const count = Number(arg('count', '1'))
  if (!(model in MODELS)) throw new Error(`Bilinmeyen model: ${model} (${Object.keys(MODELS).join(', ')})`)
  let made = 0
  while (made < count) {
    // serial_no (ilk 8 hane) de tekil olmalı; çakışırsa yeniden dene
    if (insert(db, generateCode(), model)) made++
  }
  const rows = db
    .prepare('SELECT activation_code, serial_no FROM devices WHERE model_id = ? ORDER BY id DESC LIMIT ?')
    .all(model, count) as { activation_code: string; serial_no: string }[]
  for (const r of rows.reverse()) console.log(`${r.activation_code}\t${r.serial_no}\t${model}`)
} else if (cmd === 'import') {
  const file = process.argv[3]
  if (!file) throw new Error('Kullanım: import <dosya.csv>')
  let added = 0
  let skipped = 0
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue
    const [rawCode, rawModel] = line.split(/[,;\t]/).map((s) => s.trim())
    const code = normalizeCode(rawCode ?? '')
    const model = rawModel ?? 'pro'
    if (!code || !(model in MODELS)) {
      console.warn(`atlandı: ${line}`)
      skipped++
      continue
    }
    if (insert(db, code, model)) added++
    else skipped++
  }
  console.log(`eklendi: ${added}, atlandı: ${skipped}`)
} else if (cmd === 'list') {
  const rows = db
    .prepare('SELECT activation_code, serial_no, model_id, activated_at, onboarded_at FROM devices ORDER BY id')
    .all() as { activation_code: string; serial_no: string; model_id: string; activated_at: number | null; onboarded_at: number | null }[]
  for (const r of rows) {
    const state = r.onboarded_at ? 'kurulu' : r.activated_at ? 'aktive' : 'bekliyor'
    console.log(`${r.activation_code}\t${r.serial_no}\t${r.model_id}\t${state}`)
  }
} else {
  console.error('Komutlar: generate | import | list')
  process.exit(1)
}
db.close()
