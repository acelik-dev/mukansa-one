import { MODELS } from '../../mobile/src/lib/calc.ts'
import { generateCode, normalizeCode, serialFromCode } from './codes.ts'
import type { DB } from './db.ts'

export function isKnownModel(model: string): boolean {
  return model in MODELS
}

/** Kod zaten varsa (veya aynı seri numarası çakışırsa) eklemez; eklendiyse true */
export function insertDevice(db: DB, code: string, modelId: string, now: number): boolean {
  const res = db
    .prepare('INSERT OR IGNORE INTO devices (activation_code, serial_no, model_id, created_at) VALUES (?, ?, ?, ?)')
    .run(code, serialFromCode(code), modelId, now)
  return Number(res.changes) === 1
}

export function generateDevices(
  db: DB,
  modelId: string,
  count: number,
  now: number,
): { code: string; serialNo: string }[] {
  if (!isKnownModel(modelId)) throw new Error(`Bilinmeyen model: ${modelId}`)
  const out: { code: string; serialNo: string }[] = []
  let guard = 0
  while (out.length < count) {
    if (++guard > count * 20 + 100) throw new Error('Benzersiz kod üretilemedi')
    const code = generateCode()
    if (insertDevice(db, code, modelId, now)) out.push({ code, serialNo: serialFromCode(code) })
  }
  return out
}

export interface ImportResult {
  added: number
  duplicates: number
  invalid: string[]
}

/** Satır biçimi: KOD[,model] (ayraç: virgül, noktalı virgül veya tab). Model yoksa varsayılan verilir. */
export function importDevices(db: DB, text: string, defaultModel: string, now: number): ImportResult {
  const result: ImportResult = { added: 0, duplicates: 0, invalid: [] }
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const [rawCode, rawModel] = line.split(/[,;\t]/).map((s) => s.trim())
    const code = normalizeCode(rawCode ?? '')
    const model = rawModel || defaultModel
    if (!code || !isKnownModel(model)) {
      result.invalid.push(line.trim().slice(0, 60))
      continue
    }
    if (insertDevice(db, code, model, now)) result.added++
    else result.duplicates++
  }
  return result
}
