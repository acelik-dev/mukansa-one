import { computeMetrics, MODELS, type Metrics } from '../../../mobile/src/lib/calc.ts'
import type { DB } from '../db.ts'
import { readProfile, toServiceRequestDTO, type DeviceRow, type ServiceRequestRow } from '../state.ts'

const DAY = 86400000
const TR_OFFSET_MS = 3 * 3600 * 1000

export type DeviceStatus = 'pending' | 'activated' | 'ready' | 'blocked'

export function deviceStatus(row: DeviceRow): DeviceStatus {
  if (row.blocked_at !== null) return 'blocked'
  if (row.onboarded_at !== null) return 'ready'
  if (row.activated_at !== null) return 'activated'
  return 'pending'
}

interface ListRow extends DeviceRow {
  session_count: number
  push_count: number
  last_seen_at: number | null
}

const LIST_SQL = `
  SELECT d.*,
    (SELECT COUNT(*) FROM sessions s WHERE s.device_id = d.id) AS session_count,
    (SELECT COUNT(*) FROM sessions s WHERE s.device_id = d.id AND s.push_token IS NOT NULL) AS push_count,
    (SELECT MAX(s.last_seen_at) FROM sessions s WHERE s.device_id = d.id) AS last_seen_at
  FROM devices d`

export interface FilterInfo {
  percent: number
  days: number
  litres: number
  tone: Metrics['tone']
  capacityBound: boolean
}

export interface DeviceSummary {
  id: number
  serialNo: string
  modelId: string
  status: DeviceStatus
  region: string | null
  people: number | null
  createdAt: number
  activatedAt: number | null
  onboardedAt: number | null
  blockedAt: number | null
  note: string | null
  sessions: number
  pushDevices: number
  lastSeenAt: number | null
  filter: FilterInfo | null
  dailyL: number | null
  totalLiters: number | null
  cumulativeSaving: number | null
  bottles: number | null
  co2Kg: number | null
}

function metricsOf(row: DeviceRow, now: number): Metrics | null {
  if (row.onboarded_at === null || row.activated_at === null) return null
  const { household } = readProfile(row)
  return computeMetrics(
    {
      modelId: row.model_id,
      household,
      activationMs: row.activated_at,
      filterInstallMs: row.filter_installed_at ?? row.activated_at,
    },
    new Date(now),
  )
}

function summarize(row: ListRow, now: number): DeviceSummary {
  const m = metricsOf(row, now)
  const profile = row.onboarded_at !== null ? readProfile(row) : null
  return {
    id: row.id,
    serialNo: row.serial_no,
    modelId: row.model_id,
    status: deviceStatus(row),
    region: profile?.household.region ?? null,
    people: profile?.household.people ?? null,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    onboardedAt: row.onboarded_at,
    blockedAt: row.blocked_at,
    note: row.note,
    sessions: row.session_count,
    pushDevices: row.push_count,
    lastSeenAt: row.last_seen_at,
    filter: m
      ? {
          percent: m.filter.percent,
          days: m.filter.remainingDays,
          litres: m.filter.remainingL,
          tone: m.tone,
          capacityBound: m.filter.capacityBound,
        }
      : null,
    dailyL: m?.dailyL ?? null,
    totalLiters: m?.totalLiters ?? null,
    cumulativeSaving: m?.cumulativeSaving ?? null,
    bottles: m?.bottles ?? null,
    co2Kg: m?.co2Kg ?? null,
  }
}

export interface ListParams {
  q?: string
  status?: string
  model?: string
  tone?: string
  sort?: string
  dir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

const tr = (s: string) => s.toLocaleLowerCase('tr-TR')

export function listDevices(db: DB, p: ListParams, now: number) {
  const rows = (db.prepare(`${LIST_SQL} ORDER BY d.id`).all() as unknown as ListRow[]).map((r) => ({
    row: r,
    sum: summarize(r, now),
  }))
  const q = p.q ? tr(p.q.trim()) : ''

  let items = rows.filter(({ row, sum }) => {
    if (p.status && p.status !== 'all' && sum.status !== p.status) return false
    if (p.model && p.model !== 'all' && sum.modelId !== p.model) return false
    if (p.tone && p.tone !== 'all' && sum.filter?.tone !== p.tone) return false
    if (q) {
      const hay = tr(`${sum.serialNo} ${row.activation_code} ${sum.region ?? ''} ${sum.note ?? ''}`)
      if (!hay.includes(q)) return false
    }
    return true
  })

  const dir = p.dir === 'asc' ? 1 : -1
  const key: Record<string, (s: DeviceSummary) => number | string> = {
    serial: (s) => s.serialNo,
    created: (s) => s.createdAt,
    activated: (s) => s.activatedAt ?? 0,
    seen: (s) => s.lastSeenAt ?? 0,
    filter: (s) => s.filter?.percent ?? 101,
    region: (s) => s.region ?? '',
  }
  const pick = key[p.sort ?? 'created'] ?? key.created!
  items = items.sort((a, b) => {
    const x = pick(a.sum)
    const y = pick(b.sum)
    return (x < y ? -1 : x > y ? 1 : 0) * dir
  })

  const pageSize = Math.min(Math.max(p.pageSize ?? 25, 5), 100)
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(p.page ?? 1, 1), pages)
  return {
    total,
    page,
    pages,
    pageSize,
    items: items.slice((page - 1) * pageSize, page * pageSize).map((x) => x.sum),
  }
}

export function notificationKind(key: string): string {
  if (key.startsWith('filter-')) return 'filter'
  if (key.startsWith('weekly')) return 'weekly'
  if (key.startsWith('milestone-')) return 'milestone'
  if (key.startsWith('manual:')) return 'manual'
  if (key.startsWith('service:')) return 'service'
  return 'other'
}

export function overview(db: DB, now: number) {
  const rows = (db.prepare(`${LIST_SQL}`).all() as unknown as ListRow[]).map((r) => summarize(r, now))

  const totals = { devices: rows.length, pending: 0, activated: 0, ready: 0, blocked: 0, sessions: 0, pushDevices: 0 }
  const fleet = { totalLiters: 0, dailyLiters: 0, savingTL: 0, people: 0, bottles: 0, co2Kg: 0 }
  const health = { ok: 0, warning: 0, danger: 0 }
  const buckets = [0, 0, 0, 0, 0] // 0-10, 10-25, 25-50, 50-75, 75-100
  const models = new Map<string, number>()
  const regions = new Map<string, number>()
  for (const s of rows) {
    totals[s.status]++
    totals.sessions += s.sessions
    if (s.pushDevices > 0) totals.pushDevices++
    models.set(s.modelId, (models.get(s.modelId) ?? 0) + 1)
    if (s.status === 'ready' || s.status === 'blocked') {
      if (s.region) regions.set(s.region, (regions.get(s.region) ?? 0) + 1)
    }
    if (s.status === 'ready' && s.filter) {
      health[s.filter.tone]++
      const p = s.filter.percent
      buckets[p <= 10 ? 0 : p <= 25 ? 1 : p <= 50 ? 2 : p <= 75 ? 3 : 4]!++
      fleet.totalLiters += s.totalLiters ?? 0
      fleet.dailyLiters += s.dailyL ?? 0
      fleet.savingTL += s.cumulativeSaving ?? 0
      fleet.people += s.people ?? 0
      fleet.bottles += s.bottles ?? 0
      fleet.co2Kg += s.co2Kg ?? 0
    }
  }

  const attention = rows
    .filter((s) => s.status === 'ready' && s.filter && s.filter.tone !== 'ok')
    .sort((a, b) => a.filter!.percent - b.filter!.percent)
    .slice(0, 8)
    .map((s) => ({ id: s.id, serialNo: s.serialNo, region: s.region, ...s.filter! }))

  // Son 30 gün aktivasyonlar (TR gününe göre)
  const dayKey = (ms: number) => new Date(ms + TR_OFFSET_MS).toISOString().slice(0, 10)
  const perDay = new Map<string, number>()
  for (const s of rows) if (s.activatedAt) perDay.set(dayKey(s.activatedAt), (perDay.get(dayKey(s.activatedAt)) ?? 0) + 1)
  const activationsByDay = Array.from({ length: 30 }, (_, i) => {
    const day = dayKey(now - (29 - i) * DAY)
    return { day, count: perDay.get(day) ?? 0 }
  })

  const notif = db
    .prepare(`SELECT key, delivered FROM notification_log WHERE sent_at >= ? AND delivered = 1`)
    .all(now - 7 * DAY) as { key: string; delivered: number }[]
  const byKind: Record<string, number> = {}
  for (const n of notif) byKind[notificationKind(n.key)] = (byKind[notificationKind(n.key)] ?? 0) + 1

  const openServiceRequests = (
    db.prepare("SELECT COUNT(*) AS n FROM service_requests WHERE status IN ('open','in_progress')").get() as { n: number }
  ).n

  return {
    totals,
    fleet,
    health,
    buckets,
    attention,
    activationsByDay,
    notifications: { last7d: notif.length, byKind },
    models: [...models].map(([id, count]) => ({ id, name: MODELS[id]?.name ?? id, count })),
    regions: [...regions].map(([region, count]) => ({ region, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    openServiceRequests,
    serverTime: now,
  }
}

export function maskPushToken(token: string | null): string | null {
  if (!token) return null
  const inner = token.replace(/^Expo(nent)?PushToken\[/, '').replace(/\]$/, '')
  return `${token.startsWith('ExponentPushToken') ? 'ExponentPushToken' : 'ExpoPushToken'}[${inner.slice(0, 4)}…${inner.slice(-3)}]`
}

export function deviceDetail(db: DB, row: DeviceRow, now: number) {
  const list = db.prepare(`${LIST_SQL} WHERE d.id = ?`).get(row.id) as unknown as ListRow
  const summary = summarize(list, now)
  const { household, notif } = readProfile(row)
  const metrics = metricsOf(row, now)
  const sessions = (
    db
      .prepare('SELECT id, platform, created_at, last_seen_at, push_token FROM sessions WHERE device_id = ? ORDER BY last_seen_at DESC')
      .all(row.id) as { id: number; platform: string | null; created_at: number; last_seen_at: number; push_token: string | null }[]
  ).map((s) => ({
    id: s.id,
    platform: s.platform,
    createdAt: s.created_at,
    lastSeenAt: s.last_seen_at,
    push: maskPushToken(s.push_token),
  }))
  const notifications = (
    db
      .prepare('SELECT key, sent_at, delivered, title, body FROM notification_log WHERE device_id = ? ORDER BY sent_at DESC LIMIT 40')
      .all(row.id) as { key: string; sent_at: number; delivered: number; title: string | null; body: string | null }[]
  ).map((n) => ({ key: n.key, kind: notificationKind(n.key), at: n.sent_at, delivered: n.delivered === 1, title: n.title, body: n.body }))
  const audit = db
    .prepare('SELECT id, at, admin_name, action, detail FROM audit_log WHERE device_id = ? ORDER BY at DESC, id DESC LIMIT 30')
    .all(row.id) as { id: number; at: number; admin_name: string | null; action: string; detail: string | null }[]
  const serviceRequests = (
    db.prepare('SELECT * FROM service_requests WHERE device_id = ? ORDER BY created_at DESC').all(row.id) as unknown as ServiceRequestRow[]
  ).map(toServiceRequestDTO)

  return {
    summary,
    profile: row.onboarded_at !== null ? { household, notif } : null,
    filterInstallMs: row.filter_installed_at,
    metrics: metrics
      ? {
          dailyL: metrics.dailyL,
          monthlyL: metrics.monthlyL,
          dailySaving: metrics.dailySaving,
          totalLiters: metrics.totalLiters,
          cumulativeSaving: metrics.cumulativeSaving,
          bottles: metrics.bottles,
          co2Kg: metrics.co2Kg,
          trees: metrics.trees,
          paybackMonths: metrics.paybackMonths,
          daysSinceActivation: metrics.daysSinceActivation,
          model: metrics.model,
        }
      : null,
    sessions,
    notifications,
    audit: audit.map((a) => ({ id: a.id, at: a.at, admin: a.admin_name, action: a.action, detail: a.detail })),
    serviceRequests,
  }
}

export interface ServiceRequestListParams {
  status?: string
  page?: number
  pageSize?: number
}

/** Yönetim paneli için: tüm cihazlardaki servis taleplerinin genel listesi (cihaz bilgisiyle birlikte) */
export function listServiceRequests(db: DB, p: ServiceRequestListParams) {
  const rows = db
    .prepare(
      `SELECT sr.*, d.serial_no, d.model_id
       FROM service_requests sr JOIN devices d ON d.id = sr.device_id
       ${p.status && p.status !== 'all' ? 'WHERE sr.status = ?' : ''}
       ORDER BY sr.created_at DESC`,
    )
    .all(...(p.status && p.status !== 'all' ? [p.status] : [])) as unknown as (ServiceRequestRow & {
    serial_no: string
    model_id: string
  })[]

  const pageSize = Math.min(Math.max(p.pageSize ?? 25, 5), 100)
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(p.page ?? 1, 1), pages)
  const items = rows.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
    ...toServiceRequestDTO(r),
    deviceId: r.device_id,
    serialNo: r.serial_no,
    modelId: r.model_id,
  }))
  return { total, page, pages, pageSize, items }
}
