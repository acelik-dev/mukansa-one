export interface Config {
  port: number
  host: string
  dbPath: string
  trustProxy: boolean
  /** Tarayıcıdan (expo web) erişim için izinli origin'ler; native uygulama CORS'a ihtiyaç duymaz */
  corsOrigins: string[]
  schedulerIntervalMin: number
  /** Yönetim paneli portu; 0 = kapalı */
  adminPort: number
  /** Panel çerezleri için Secure bayrağı (HTTPS arkasında 1) */
  adminSecureCookies: boolean
  pushDryRun: boolean
  expoAccessToken?: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 3035),
    host: env.HOST ?? '127.0.0.1',
    dbPath: env.DB_PATH ?? './data/mukansa.db',
    trustProxy: env.TRUST_PROXY === '1',
    corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
    schedulerIntervalMin: Number(env.SCHEDULER_INTERVAL_MIN ?? 15),
    adminPort: Number(env.ADMIN_PORT ?? 0),
    adminSecureCookies: env.ADMIN_SECURE_COOKIES === '1',
    pushDryRun: env.PUSH_DRY_RUN === '1',
    expoAccessToken: env.EXPO_ACCESS_TOKEN || undefined,
  }
}
