// Bildirim turunu elle çalıştırır (test için).
//   npm run tick                       → şimdi, gerçek gönderim (PUSH_DRY_RUN=1 ile sadece log)
//   npm run tick -- --at 2026-09-20T10:30:00+03:00
import { loadConfig } from '../src/config.ts'
import { openDb } from '../src/db.ts'
import { expoSender } from '../src/push.ts'
import { runNotificationPass } from '../src/scheduler.ts'

const config = loadConfig()
const db = openDb(config.dbPath)
const i = process.argv.indexOf('--at')
const at = i >= 0 ? Date.parse(process.argv[i + 1] ?? '') : Date.now()
if (Number.isNaN(at)) throw new Error('--at geçerli bir tarih olmalı')

const send = expoSender({ dryRun: config.pushDryRun, accessToken: config.expoAccessToken, log: console.log })
console.log(await runNotificationPass(db, at, send, console.log))
db.close()
