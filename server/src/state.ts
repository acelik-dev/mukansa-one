import { computeMetrics, type Household, type Metrics } from '../../mobile/src/lib/calc.ts'
import type { DB } from './db.ts'
import {
  DEFAULT_HOUSEHOLD,
  DEFAULT_NOTIF,
  householdSchema,
  notifSchema,
  type NotifPrefs,
} from './schema.ts'

export interface DeviceRow {
  id: number
  activation_code: string
  serial_no: string
  model_id: string
  created_at: number
  activated_at: number | null
  filter_installed_at: number | null
  onboarded_at: number | null
  note: string | null
  blocked_at: number | null
  household: string | null
  notif: string | null
}

export interface StateDTO {
  device: {
    serialNo: string
    modelId: string
    activationMs: number
    filterInstallMs: number
  }
  onboarded: boolean
  household: Household
  notif: NotifPrefs
  metrics: Metrics
  serverTime: number
}

export function getDevice(db: DB, id: number): DeviceRow {
  const row = db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as unknown as DeviceRow | undefined
  if (!row) throw new Error(`device ${id} not found`)
  return row
}

function parseJson<T>(raw: string | null, parse: (v: unknown) => T, fallback: T): T {
  if (!raw) return fallback
  try {
    return parse(JSON.parse(raw))
  } catch {
    return fallback
  }
}

export function readProfile(row: DeviceRow): { household: Household; notif: NotifPrefs } {
  return {
    household: parseJson(row.household, (v) => householdSchema.parse(v), DEFAULT_HOUSEHOLD),
    notif: parseJson(row.notif, (v) => notifSchema.parse(v), DEFAULT_NOTIF),
  }
}

export function toState(row: DeviceRow, now: number): StateDTO {
  const { household, notif } = readProfile(row)
  // Oturum yalnızca aktivasyonla açıldığı için activated_at pratikte hep dolu
  const activationMs = row.activated_at ?? now
  const filterInstallMs = row.filter_installed_at ?? activationMs
  return {
    device: {
      serialNo: row.serial_no,
      modelId: row.model_id,
      activationMs,
      filterInstallMs,
    },
    onboarded: row.onboarded_at !== null,
    household,
    notif,
    metrics: computeMetrics(
      { modelId: row.model_id, household, activationMs, filterInstallMs },
      new Date(now),
    ),
    serverTime: now,
  }
}
