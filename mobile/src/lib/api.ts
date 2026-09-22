import type { Household, Metrics } from './calc'
import { apiBaseUrl } from './config'
import type { ServiceCategory, ServiceStatus } from './service'
import type { NotifPrefs } from './types'

const TIMEOUT_MS = 12_000

export class ApiError extends Error {
  /** HTTP durumu; ağ hatası/zaman aşımında 0 */
  status: number
  code: string
  constructor(status: number, code: string) {
    super(`${status} ${code}`)
    this.status = status
    this.code = code
  }
  get isNetwork() {
    return this.status === 0
  }
}

/** Sunucunun döndüğü cihaz durumu (server/src/state.ts ile aynı şekil) */
export interface ServerState {
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

export interface ServiceRequestDTO {
  id: number
  category: ServiceCategory
  description: string
  contactName: string | null
  contactPhone: string
  status: ServiceStatus
  adminNote: string | null
  createdAt: number
  updatedAt: number
}

async function request<T>(
  method: string,
  path: string,
  opts: { token?: string | null; body?: unknown } = {},
): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    })
  } catch {
    throw new ApiError(0, 'network')
  } finally {
    clearTimeout(timer)
  }
  if (res.status === 204) return undefined as T
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    // gövde JSON değil
  }
  if (!res.ok) {
    const code = (json as { error?: string } | null)?.error ?? 'unknown'
    throw new ApiError(res.status, code)
  }
  return json as T
}

export const api = {
  activate: (code: string, platform: 'ios' | 'android' | 'web') =>
    request<{ token: string; state: ServerState }>('POST', '/v1/activate', {
      body: { code, platform },
    }),

  me: (token: string) => request<ServerState>('GET', '/v1/me', { token }),

  completeOnboarding: (token: string, household: Household, notif: NotifPrefs) =>
    request<ServerState>('POST', '/v1/onboarding', { token, body: { household, notif } }),

  saveProfile: (token: string, patch: { household?: Household; notif?: NotifPrefs }) =>
    request<ServerState>('PUT', '/v1/profile', { token, body: patch }),

  replaceFilter: (token: string, replacedAt: number) =>
    request<ServerState>('POST', '/v1/filter/replace', { token, body: { replacedAt } }),

  setPushToken: (token: string, pushToken: string, platform: 'ios' | 'android') =>
    request<void>('PUT', '/v1/push-token', { token, body: { token: pushToken, platform } }),

  logout: (token: string) => request<void>('DELETE', '/v1/session', { token }),

  createServiceRequest: (
    token: string,
    body: { category: ServiceCategory; description: string; contactPhone: string; contactName?: string },
  ) => request<ServiceRequestDTO>('POST', '/v1/service-requests', { token, body }),

  listServiceRequests: (token: string) =>
    request<{ items: ServiceRequestDTO[] }>('GET', '/v1/service-requests', { token }),
}
