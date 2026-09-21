import { computeMetrics, formatNum, formatTL, type Metrics } from '../../mobile/src/lib/calc.ts'
import type { DB } from './db.ts'
import type { PushSender } from './push.ts'
import { readProfile, type DeviceRow } from './state.ts'

const DAY = 86400000
// Türkiye yıl boyunca UTC+3 (2016'dan beri yaz saati uygulaması yok)
const TR_OFFSET_MS = 3 * 3600 * 1000
const QUIET_BEFORE_HOUR = 9
const QUIET_FROM_HOUR = 21
const WEEKLY_HOUR = 10

const SAVING_MILESTONES_TL = [500, 1000, 2500, 5000, 10000, 25000]
const BOTTLE_MILESTONES = [100, 250, 500, 1000, 2500]
/** Bir kilometre taşı bundan eski ise bildirim atılmaz, sessizce işaretlenir */
const MILESTONE_FRESH_DAYS = 3

interface Candidate {
  key: string
  title: string
  body: string
  data: Record<string, unknown>
  /** Bu bildirimle birlikte "gönderilmiş sayılacak" düşük öncelikli anahtarlar */
  supersedes?: string[]
}

export interface PassResult {
  devices: number
  sent: number
  skippedQuietHours: boolean
}

function trParts(now: number) {
  const d = new Date(now + TR_OFFSET_MS)
  return { hour: d.getUTCHours(), weekday: d.getUTCDay(), date: d }
}

/** ISO 8601 hafta anahtarı (YYYY-Www), TR yerel tarihine göre */
function isoWeekKey(local: Date): string {
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / DAY + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function filterCandidates(m: Metrics, filterInstallMs: number): Candidate[] {
  const pct = Math.round(m.filter.percent)
  const days = m.filter.remainingDays
  const data = { type: 'filter', screen: 'device' }
  const k = (level: string) => `filter-${level}:${filterInstallMs}`
  if (m.filter.percent <= 0 || (days <= 0 && m.filter.percent < 1)) {
    return [
      {
        key: k('expired'),
        title: 'Filtre ömrünü tamamladı',
        body: 'Kartuşun ömrü doldu. En iyi su kalitesi için filtreyi hemen değiştirin.',
        data,
        supersedes: [k('danger'), k('warning')],
      },
    ]
  }
  if (m.filter.percent <= 10) {
    return [
      {
        key: k('danger'),
        title: 'Filtreyi değiştirme zamanı',
        body: `Filtrede %${pct} ömür kaldı (yaklaşık ${days} gün). Kartuşu bu hafta değiştirmenizi öneririz.`,
        data,
        supersedes: [k('warning')],
      },
    ]
  }
  if (m.filter.percent <= 25) {
    return [
      {
        key: k('warning'),
        title: 'Filtre değişimi yaklaşıyor',
        body: `Filtrede %${pct} ömür kaldı (yaklaşık ${days} gün). Yeni kartuşu şimdiden hazırlayın.`,
        data,
      },
    ]
  }
  return []
}

function milestoneCandidates(row: DeviceRow, m: Metrics, household: { source: string }, now: number): Candidate[] {
  const out: Candidate[] = []
  const data = { type: 'milestone', screen: 'stats' }
  const activation = row.activated_at ?? now

  const reached = (
    kind: 'saving' | 'bottles',
    thresholds: number[],
    value: number,
    perDay: number,
    text: (t: number) => { title: string; body: string },
  ) => {
    const done = thresholds.filter((t) => value >= t)
    const top = done[done.length - 1]
    if (top === undefined || perDay <= 0) return
    const crossedAt = activation + (top / perDay) * DAY
    const fresh = now - crossedAt <= MILESTONE_FRESH_DAYS * DAY
    const lower = done.slice(0, -1).map((t) => `milestone-${kind}:${t}`)
    if (fresh) {
      out.push({ key: `milestone-${kind}:${top}`, ...text(top), data, supersedes: lower })
    } else {
      // Eski eşikler: bildirim atmadan işaretle ki bir daha değerlendirilmesin
      out.push({ key: `milestone-${kind}:${top}`, title: '', body: '', data, supersedes: lower })
    }
  }

  reached('saving', SAVING_MILESTONES_TL, m.cumulativeSaving, m.dailySaving, (t) => ({
    title: 'Yeni bir kilometre taşı',
    body: `Tahmini toplam tasarrufunuz ${formatTL(t)} eşiğini aştı. 🎉`,
  }))
  const bottleL = household.source === 'damacana' ? 19 : 1.5
  reached('bottles', BOTTLE_MILESTONES, m.bottles, m.dailyL / bottleL, (t) => ({
    title: 'Doğaya katkınız büyüyor',
    body: `Şimdiye kadar yaklaşık ${formatNum(t)} plastik şişe atığını önlediniz. 🌱`,
  }))
  return out
}

/**
 * Tüm cihazlar için bildirim kurallarını değerlendirir. Idempotent: aynı anahtar bir daha gönderilmez,
 * bu yüzden sık aralıkla (ör. 15 dk) çağrılabilir.
 */
export async function runNotificationPass(
  db: DB,
  now: number,
  send: PushSender,
  log: (msg: string) => void = () => {},
): Promise<PassResult> {
  const { hour, weekday, date } = trParts(now)
  if (hour < QUIET_BEFORE_HOUR || hour >= QUIET_FROM_HOUR) {
    return { devices: 0, sent: 0, skippedQuietHours: true }
  }

  const devices = db
    .prepare(
      `SELECT d.* FROM devices d
       WHERE d.onboarded_at IS NOT NULL AND d.blocked_at IS NULL
         AND EXISTS (SELECT 1 FROM sessions s WHERE s.device_id = d.id AND s.push_token IS NOT NULL)`,
    )
    .all() as unknown as DeviceRow[]

  const logged = db.prepare('SELECT 1 FROM notification_log WHERE device_id = ? AND key = ?')
  const insertLog = db.prepare(
    'INSERT OR IGNORE INTO notification_log (device_id, key, sent_at, delivered, title, body) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const tokensOf = db.prepare(
    'SELECT id, push_token FROM sessions WHERE device_id = ? AND push_token IS NOT NULL',
  )
  const clearToken = db.prepare('UPDATE sessions SET push_token = NULL WHERE id = ?')

  let sent = 0
  for (const row of devices) {
    const { household, notif } = readProfile(row)
    const activationMs = row.activated_at ?? now
    const filterInstallMs = row.filter_installed_at ?? activationMs
    const m = computeMetrics({ modelId: row.model_id, household, activationMs, filterInstallMs }, new Date(now))

    const candidates: Candidate[] = []
    if (notif.filterAlerts) candidates.push(...filterCandidates(m, filterInstallMs))
    if (notif.milestones) candidates.push(...milestoneCandidates(row, m, household, now))
    if (notif.weeklySummary && weekday === 0 && hour >= WEEKLY_HOUR && m.daysSinceActivation >= 7) {
      const litres = `Bu hafta yaklaşık ${formatNum(m.dailyL * 7)} L arıtılmış su kullandınız`
      const body =
        m.dailySaving > 0
          ? `${litres} ve tahmini ${formatTL(m.dailySaving * 7)} tasarruf ettiniz.`
          : `${litres}.`
      candidates.push({
        key: `weekly:${isoWeekKey(date)}`,
        title: 'Haftalık özetiniz hazır',
        body,
        data: { type: 'weekly', screen: 'stats' },
      })
    }

    for (const c of candidates) {
      if (logged.get(row.id, c.key)) continue
      for (const s of c.supersedes ?? []) insertLog.run(row.id, s, now, 0, null, null)

      if (!c.title) {
        insertLog.run(row.id, c.key, now, 0, null, null) // sessiz işaretleme (bayat kilometre taşı)
        continue
      }
      const tokens = tokensOf.all(row.id) as unknown as { id: number; push_token: string }[]
      const results = await send(
        tokens.map((t) => ({ to: t.push_token, title: c.title, body: c.body, data: c.data })),
      )
      results.forEach((r, i) => {
        if (r.invalidToken) clearToken.run(tokens[i]!.id)
      })
      if (results.some((r) => r.ok)) {
        insertLog.run(row.id, c.key, now, 1, c.title, c.body)
        sent++
        log(`sent ${c.key} → device ${row.id}`)
      }
      // Hiçbiri iletilemediyse loglanmaz: sonraki turda yeniden denenir
    }
  }
  return { devices: devices.length, sent, skippedQuietHours: false }
}
