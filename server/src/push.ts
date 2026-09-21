export interface PushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
}

export interface PushResult {
  ok: boolean
  /** Token artık geçersiz (uygulama silinmiş vb.) — DB'den temizlenmeli */
  invalidToken?: boolean
}

export type PushSender = (messages: PushMessage[]) => Promise<PushResult[]>

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const BATCH = 100

interface ExpoTicket {
  status: 'ok' | 'error'
  message?: string
  details?: { error?: string }
}

export function expoSender(opts: {
  dryRun: boolean
  accessToken?: string
  log?: (msg: string) => void
}): PushSender {
  const log = opts.log ?? (() => {})
  return async (messages) => {
    if (opts.dryRun) {
      for (const m of messages) log(`[push dry-run] ${m.to} — ${m.title}: ${m.body}`)
      return messages.map(() => ({ ok: true }))
    }
    const results: PushResult[] = []
    for (let i = 0; i < messages.length; i += BATCH) {
      const batch = messages.slice(i, i + BATCH)
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(opts.accessToken ? { Authorization: `Bearer ${opts.accessToken}` } : {}),
          },
          body: JSON.stringify(batch.map((m) => ({ ...m, sound: 'default' }))),
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`)
        const json = (await res.json()) as { data?: ExpoTicket[] }
        batch.forEach((_, j) => {
          const t = json.data?.[j]
          if (t?.status === 'ok') results.push({ ok: true })
          else {
            log(`push error: ${t?.message ?? 'unknown'}`)
            results.push({ ok: false, invalidToken: t?.details?.error === 'DeviceNotRegistered' })
          }
        })
      } catch (err) {
        log(`push batch failed: ${(err as Error).message}`)
        for (let j = 0; j < batch.length; j++) results.push({ ok: false })
      }
    }
    return results
  }
}
