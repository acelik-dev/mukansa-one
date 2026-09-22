import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AppState as RNAppState, Platform } from 'react-native'
import { api, ApiError, type ServerState, type ServiceRequestDTO } from './api'
import { computeMetrics, DEFAULT_HOUSEHOLD, type Household, type Metrics } from './calc'
import { getPushRegistration } from './push'
import { clearToken, getToken, setToken } from './secure'
import type { ServiceCategory } from './service'
import { DEFAULT_NOTIF, type NotifPrefs } from './types'

export type { NotifPrefs } from './types'

/**
 * none: henüz cihaz bağlanmadı · demo: yerel örnek veri (sunucuya gitmez) · live: aktive edilmiş cihaz
 */
type Mode = 'none' | 'demo' | 'live'

interface AppData {
  mode: Mode
  /** Onboarding tamamlandı → ana uygulama gösterilir */
  activated: boolean
  serialNo: string
  modelId: string
  activationMs: number
  filterInstallMs: number
  household: Household
  notif: NotifPrefs
}

/** Sunucuya henüz ulaşmamış yerel değişiklikler (offline dayanıklılığı) */
interface SyncFlags {
  profileDirty: boolean
  pendingFilterReplaceMs: number | null
}

interface Store extends AppData {
  /** Kayıtlı oturum/veri okunana kadar false (açılışta onboarding'in yanıp sönmemesi için) */
  hydrated: boolean
  /** Cihaz aktive edilmiş ama onboarding bitmemişse kaldığı yerden devam bilgisi */
  resume: { serialNo: string; modelId: string } | null
  metrics: Metrics
  /** Seri numarasını sunucuda doğrular. Başarısızsa ApiError fırlatır. */
  activate: (code: string) => Promise<{ onboarded: boolean }>
  completeOnboarding: (data: { household: Household; allowPush: boolean }) => Promise<void>
  loadDemo: () => void
  /** Cihaz bağlantısını kaldırır (oturum kapanır; cihaz verisi sunucuda kalır) */
  reset: () => Promise<void>
  replaceFilter: () => void
  updateHousehold: (patch: Partial<Household>) => void
  updateNotif: (patch: Partial<NotifPrefs>) => void
  /** Yeni teknik servis talebi oluşturur. Başarısızsa ApiError fırlatır (offline'da kuyruklanmaz). */
  createServiceRequest: (input: {
    category: ServiceCategory
    description: string
    contactPhone: string
    contactName?: string
  }) => Promise<ServiceRequestDTO>
  /** Bu cihaza ait tüm servis taleplerini (en yeni önce) sunucudan getirir. */
  listServiceRequests: () => Promise<ServiceRequestDTO[]>
}

const DAY = 86400000
const STORAGE_KEY = 'mukansa.app.v1'
const PUSH_KEY = 'mukansa.push.v1'
const DEBOUNCE_MS = 700
const RETRY_MS = 30_000
const FOREGROUND_REFRESH_MS = 30_000

const initialData: AppData = {
  mode: 'none',
  activated: false,
  serialNo: '',
  modelId: 'pro',
  activationMs: Date.now(),
  filterInstallMs: Date.now(),
  household: DEFAULT_HOUSEHOLD,
  notif: DEFAULT_NOTIF,
}

const initialSync: SyncFlags = { profileDirty: false, pendingFilterReplaceMs: null }

const AppContext = createContext<Store | null>(null)

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function isRetryable(err: unknown): boolean {
  return err instanceof ApiError && (err.isNetwork || err.status >= 500 || err.status === 429)
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Refs gerçek kaynak (asenkron sync kodu güncel değeri okur); useState yalnızca render için ayna.
  const dataRef = useRef<AppData>(initialData)
  const syncRef = useRef<SyncFlags>(initialSync)
  const tokenRef = useRef<string | null>(null)
  const [data, setData] = useState<AppData>(initialData)
  const [sync, setSync] = useState<SyncFlags>(initialSync)
  const [hydrated, setHydrated] = useState(false)

  const flushing = useRef(false)
  const flushAgain = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastRefresh = useRef(0)

  const mutate = useCallback((fn: (d: AppData) => AppData) => {
    dataRef.current = fn(dataRef.current)
    setData(dataRef.current)
  }, [])
  const mutateSync = useCallback((fn: (s: SyncFlags) => SyncFlags) => {
    syncRef.current = fn(syncRef.current)
    setSync(syncRef.current)
  }, [])

  const logoutLocal = useCallback(async () => {
    clearTimeout(debounceTimer.current)
    clearTimeout(retryTimer.current)
    tokenRef.current = null
    await clearToken()
    await AsyncStorage.multiRemove([STORAGE_KEY, PUSH_KEY]).catch(() => {})
    mutate(() => ({ ...initialData, activationMs: Date.now(), filterInstallMs: Date.now() }))
    mutateSync(() => initialSync)
  }, [mutate, mutateSync])

  const flush = useCallback(async (): Promise<void> => {
    if (flushing.current) {
      flushAgain.current = true
      return
    }
    flushing.current = true
    try {
      do {
        flushAgain.current = false
        const token = tokenRef.current
        if (!token || dataRef.current.mode !== 'live' || !dataRef.current.activated) break

        const pending = syncRef.current.pendingFilterReplaceMs
        if (pending !== null) {
          await api.replaceFilter(token, pending)
          mutateSync((s) => (s.pendingFilterReplaceMs === pending ? { ...s, pendingFilterReplaceMs: null } : s))
          if (syncRef.current.pendingFilterReplaceMs !== null) flushAgain.current = true
        }

        if (syncRef.current.profileDirty) {
          const { household, notif } = dataRef.current
          await api.saveProfile(token, { household, notif })
          // Kayıt sürerken kullanıcı tekrar değiştirdiyse dirty kalır ve döngü tekrar eder
          if (dataRef.current.household === household && dataRef.current.notif === notif) {
            mutateSync((s) => ({ ...s, profileDirty: false }))
          } else {
            flushAgain.current = true
          }
        }
      } while (flushAgain.current)
    } catch (err) {
      // 401: oturum kapatılmış · 403: cihaz yönetici tarafından engellenmiş → yerel oturum temizlenir
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        await logoutLocal()
      } else if (err instanceof ApiError && err.status === 400) {
        // Sunucu değişikliği geçersiz buldu: sonsuz yeniden denemek yerine bırak, sonraki eşitleme sunucu değerini getirir
        mutateSync(() => initialSync)
      } else if (isRetryable(err)) {
        clearTimeout(retryTimer.current)
        retryTimer.current = setTimeout(() => void flush(), RETRY_MS)
      }
    } finally {
      flushing.current = false
    }
  }, [logoutLocal, mutateSync])

  const scheduleFlush = useCallback(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => void flush(), DEBOUNCE_MS)
  }, [flush])

  /** Expo push token'ını sunucuya iletir. prompt=true ise izin verilmemişse sistem izin penceresini açar. */
  const syncPush = useCallback(async (prompt = false) => {
    const token = tokenRef.current
    const n = dataRef.current.notif
    if (!token || !(n.weeklySummary || n.filterAlerts || n.milestones)) return
    const reg = await getPushRegistration(prompt)
    if (!reg) return
    const marker = `${reg.expoToken}|${token.slice(-12)}`
    if ((await AsyncStorage.getItem(PUSH_KEY).catch(() => null)) === marker) return
    try {
      await api.setPushToken(token, reg.expoToken, reg.platform)
      await AsyncStorage.setItem(PUSH_KEY, marker)
    } catch {
      // sonraki açılışta yeniden denenir
    }
  }, [])

  const applyServerState = useCallback(
    (s: ServerState) => {
      mutate((prev) => {
        const pendingReplace = syncRef.current.pendingFilterReplaceMs
        const keepLocalProfile = syncRef.current.profileDirty || !s.onboarded
        return {
          ...prev,
          mode: 'live',
          serialNo: s.device.serialNo,
          modelId: s.device.modelId,
          activationMs: s.device.activationMs,
          filterInstallMs:
            pendingReplace !== null ? Math.max(pendingReplace, s.device.filterInstallMs) : s.device.filterInstallMs,
          activated: prev.activated || s.onboarded,
          household: keepLocalProfile || sameJson(prev.household, s.household) ? prev.household : s.household,
          notif: keepLocalProfile || sameJson(prev.notif, s.notif) ? prev.notif : s.notif,
        }
      })
    },
    [mutate],
  )

  const refresh = useCallback(async () => {
    const token = tokenRef.current
    if (!token) return
    lastRefresh.current = Date.now()
    try {
      await flush()
      if (tokenRef.current !== token) return // flush sırasında oturum kapandı (401)
      applyServerState(await api.me(token))
      void syncPush()
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) await logoutLocal()
      // ağ hatası: yerel veriyle devam
    }
  }, [applyServerState, flush, logoutLocal, syncPush])

  // Açılış: kayıtlı oturum + yerel durum
  useEffect(() => {
    void (async () => {
      const [token, raw] = await Promise.all([
        getToken(),
        AsyncStorage.getItem(STORAGE_KEY).catch(() => null),
      ])
      let restored = false
      if (token) {
        tokenRef.current = token
        try {
          const parsed = raw ? (JSON.parse(raw) as { data?: AppData; sync?: SyncFlags }) : null
          if (parsed?.data?.mode === 'live') {
            dataRef.current = parsed.data
            setData(parsed.data)
            syncRef.current = parsed.sync ?? initialSync
            setSync(syncRef.current)
            restored = true
          }
        } catch {
          // bozuk kayıt → sunucudan yüklenir
        }
        mutate((d) => ({ ...d, mode: 'live' }))
        // Yerel kayıt yoksa (ör. veri temizlenmiş) ilk ekran sunucudan gelmeli
        if (!restored) await refresh()
      } else if (raw) {
        await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {})
      }
      setHydrated(true)
      if (token && restored) void refresh()
    })()
  }, [mutate, refresh])

  // Kalıcılık: yalnızca gerçek (live) oturum saklanır; demo saklanmaz
  useEffect(() => {
    if (!hydrated || data.mode !== 'live') return
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ data, sync })).catch(() => {})
  }, [hydrated, data, sync])

  // Uygulama öne gelince sunucuyla eşitle
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - lastRefresh.current > FOREGROUND_REFRESH_MS) void refresh()
    })
    return () => sub.remove()
  }, [refresh])

  const activate: Store['activate'] = useCallback(
    async (code) => {
      const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web'
      const res = await api.activate(code, platform)
      await setToken(res.token)
      tokenRef.current = res.token
      mutateSync(() => initialSync)
      // Onboarding daha önce bittiyse (ör. ikinci telefon) sunucudaki profil uygulanır ve doğrudan ana uygulamaya geçilir
      applyServerState(res.state)
      if (res.state.onboarded) void syncPush()
      return { onboarded: res.state.onboarded }
    },
    [applyServerState, mutateSync, syncPush],
  )

  const completeOnboarding: Store['completeOnboarding'] = useCallback(
    async ({ household, allowPush }) => {
      const token = tokenRef.current
      if (!token) throw new ApiError(401, 'unauthorized')
      const s = await api.completeOnboarding(token, household, dataRef.current.notif)
      if (allowPush) {
        // İzin penceresi ana uygulamaya geçmeden önce, onboarding üzerinde çıkar
        const reg = await getPushRegistration(true)
        if (reg) {
          try {
            await api.setPushToken(token, reg.expoToken, reg.platform)
            await AsyncStorage.setItem(PUSH_KEY, `${reg.expoToken}|${token.slice(-12)}`)
          } catch {
            // syncPush sonraki açılışta dener
          }
        }
      }
      mutate((d) => ({ ...d, household: s.household, notif: s.notif, activated: true }))
    },
    [mutate],
  )

  const loadDemo = useCallback(() => {
    const now = Date.now()
    mutate(() => ({
      mode: 'demo',
      activated: true,
      serialNo: 'MKP-4820-7391',
      modelId: 'pro',
      activationMs: now - 152 * DAY,
      filterInstallMs: now - 38 * DAY,
      household: { ...DEFAULT_HOUSEHOLD },
      notif: DEFAULT_NOTIF,
    }))
  }, [mutate])

  const reset = useCallback(async () => {
    const token = tokenRef.current
    // Sunucu oturumu en iyi çabayla kapatılır; çevrimdışıyken kullanıcıyı bekletmemek için yerel çıkış hemen yapılır
    if (token && dataRef.current.mode === 'live') void api.logout(token).catch(() => {})
    await logoutLocal()
  }, [logoutLocal])

  const replaceFilter = useCallback(() => {
    const now = Date.now()
    mutate((d) => ({ ...d, filterInstallMs: now }))
    if (dataRef.current.mode === 'live') {
      mutateSync((s) => ({ ...s, pendingFilterReplaceMs: now }))
      scheduleFlush()
    }
  }, [mutate, mutateSync, scheduleFlush])

  const updateHousehold: Store['updateHousehold'] = useCallback(
    (patch) => {
      mutate((d) => ({ ...d, household: { ...d.household, ...patch } }))
      if (dataRef.current.mode === 'live' && dataRef.current.activated) {
        mutateSync((s) => ({ ...s, profileDirty: true }))
        scheduleFlush()
      }
    },
    [mutate, mutateSync, scheduleFlush],
  )

  const updateNotif: Store['updateNotif'] = useCallback(
    (patch) => {
      mutate((d) => ({ ...d, notif: { ...d.notif, ...patch } }))
      if (dataRef.current.mode === 'live' && dataRef.current.activated) {
        mutateSync((s) => ({ ...s, profileDirty: true }))
        scheduleFlush()
        // Bir bildirim türü açıldıysa izin/token hazır olsun
        const turnedOn = patch.weeklySummary || patch.filterAlerts || patch.milestones
        void syncPush(Boolean(turnedOn))
      }
    },
    [mutate, mutateSync, scheduleFlush, syncPush],
  )

  const createServiceRequest: Store['createServiceRequest'] = useCallback(async (input) => {
    const token = tokenRef.current
    if (!token) throw new ApiError(401, 'unauthorized')
    return api.createServiceRequest(token, input)
  }, [])

  const listServiceRequests: Store['listServiceRequests'] = useCallback(async () => {
    const token = tokenRef.current
    if (!token) throw new ApiError(401, 'unauthorized')
    const { items } = await api.listServiceRequests(token)
    return items
  }, [])

  const value = useMemo<Store>(
    () => ({
      ...data,
      hydrated,
      resume:
        data.mode === 'live' && !data.activated && data.serialNo
          ? { serialNo: data.serialNo, modelId: data.modelId }
          : null,
      metrics: computeMetrics(data),
      activate,
      completeOnboarding,
      loadDemo,
      reset,
      replaceFilter,
      updateHousehold,
      updateNotif,
      createServiceRequest,
      listServiceRequests,
    }),
    [
      data,
      hydrated,
      activate,
      completeOnboarding,
      loadDemo,
      reset,
      replaceFilter,
      updateHousehold,
      updateNotif,
      createServiceRequest,
      listServiceRequests,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): Store {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
