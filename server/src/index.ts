import { buildAdminApp } from './admin/app.ts'
import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { openDb } from './db.ts'
import { expoSender } from './push.ts'
import { runNotificationPass, type PassResult } from './scheduler.ts'
import { newSchedulerStatus } from './status.ts'

const VERSION = '1.1.0'

const config = loadConfig()
const db = openDb(config.dbPath)
const app = await buildApp({ db, trustProxy: config.trustProxy, corsOrigins: config.corsOrigins, logger: true })

const send = expoSender({
  dryRun: config.pushDryRun,
  accessToken: config.expoAccessToken,
  log: (m) => app.log.info(m),
})

const status = newSchedulerStatus(config.schedulerIntervalMin, config.pushDryRun)

/** Zamanlayıcı ve yönetim panelindeki "şimdi çalıştır" aynı fonksiyonu kullanır; üst üste binmez */
let inFlight: Promise<PassResult> | null = null
const tick = (): Promise<PassResult> => {
  if (inFlight) return inFlight
  status.running = true
  inFlight = runNotificationPass(db, Date.now(), send, (m) => app.log.info(m))
    .then((r) => {
      status.lastResult = r
      status.lastError = null
      if (r.sent > 0) app.log.info(r, 'notification pass')
      return r
    })
    .catch((err: Error) => {
      status.lastError = err.message
      app.log.error(err, 'notification pass failed')
      throw err
    })
    .finally(() => {
      status.lastRunAt = Date.now()
      status.running = false
      inFlight = null
    })
  return inFlight
}

let timer: NodeJS.Timeout | undefined
if (config.schedulerIntervalMin > 0) {
  timer = setInterval(() => void tick().catch(() => {}), config.schedulerIntervalMin * 60_000)
}

// Yönetim paneli: ayrı port/uygulama (API alan adında admin uçları yok)
const adminApp =
  config.adminPort > 0
    ? await buildAdminApp({
        db,
        send,
        tick,
        status,
        version: VERSION,
        secureCookies: config.adminSecureCookies,
        trustProxy: config.trustProxy,
        logger: true,
      })
    : null

const shutdown = async () => {
  if (timer) clearInterval(timer)
  await adminApp?.close()
  await app.close()
  db.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await app.listen({ port: config.port, host: config.host })
if (adminApp) await adminApp.listen({ port: config.adminPort, host: config.host })
