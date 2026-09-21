import type { PassResult } from './scheduler.ts'

/** Bildirim zamanlayıcısının çalışma durumu (yönetim panelinde gösterilir) */
export interface SchedulerStatus {
  intervalMin: number
  running: boolean
  lastRunAt: number | null
  lastResult: PassResult | null
  lastError: string | null
  pushDryRun: boolean
}

export function newSchedulerStatus(intervalMin: number, pushDryRun: boolean): SchedulerStatus {
  return { intervalMin, running: false, lastRunAt: null, lastResult: null, lastError: null, pushDryRun }
}
