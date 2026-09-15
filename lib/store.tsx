'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  bottlesPrevented,
  co2SavedKg,
  dailyConsumptionL,
  dailySavingsTL,
  daysBetween,
  filterStatus,
  MODELS,
  previousCostPerL,
  purifiedCostPerL,
  ringTone,
  treeEquivalent,
  type DeviceModel,
  type FilterStatus,
  type Household,
  type RingTone,
} from './calc'

interface NotifPrefs {
  weeklySummary: boolean
  filterAlerts: boolean
  milestones: boolean
  marketing: boolean
}

interface AppState {
  activated: boolean
  serialNo: string
  modelId: string
  activationMs: number
  filterInstallMs: number
  household: Household
  notif: NotifPrefs
}

interface Metrics {
  model: DeviceModel
  dailyL: number
  monthlyL: number
  dailySaving: number
  filter: FilterStatus
  tone: RingTone
  daysSinceActivation: number
  totalLiters: number
  cumulativeSaving: number
  bottles: number
  co2Kg: number
  trees: number
  prevCostPerL: number
  purifiedCostPerL: number
  paybackMonths: number
}

interface Store extends AppState {
  metrics: Metrics
  completeOnboarding: (data: {
    serialNo: string
    modelId: string
    household: Household
  }) => void
  loadDemo: () => void
  reset: () => void
  replaceFilter: () => void
  updateHousehold: (patch: Partial<Household>) => void
  updateNotif: (patch: Partial<NotifPrefs>) => void
}

const DAY = 86400000

const DEFAULT_HOUSEHOLD: Household = {
  people: 4,
  uses: ['drinking', 'tea', 'cooking'],
  presence: 'home',
  source: 'damacana',
  region: 'İstanbul / Beşiktaş',
}

const DEFAULT_NOTIF: NotifPrefs = {
  weeklySummary: true,
  filterAlerts: true,
  milestones: true,
  marketing: false,
}

const initialState: AppState = {
  activated: false,
  serialNo: '',
  modelId: 'pro',
  activationMs: Date.now(),
  filterInstallMs: Date.now(),
  household: DEFAULT_HOUSEHOLD,
  notif: DEFAULT_NOTIF,
}

const AppContext = createContext<Store | null>(null)

function computeMetrics(state: AppState): Metrics {
  const model = MODELS[state.modelId] ?? MODELS.pro
  const now = new Date()
  const dailyL = dailyConsumptionL(state.household)
  const daysSinceActivation = daysBetween(new Date(state.activationMs), now)
  const daysSinceInstall = daysBetween(new Date(state.filterInstallMs), now)
  const filter = filterStatus(state.household, model, daysSinceInstall)
  const dailySaving = dailySavingsTL(state.household, model)
  const totalLiters = dailyL * daysSinceActivation
  const cumulativeSaving = dailySaving * daysSinceActivation
  const bottles = bottlesPrevented(totalLiters, state.household.source)
  const co2Kg = co2SavedKg(bottles)
  const paybackMonths =
    dailySaving > 0 ? (model.cartridgePriceTL * 6) / (dailySaving * 30) : 0

  return {
    model,
    dailyL,
    monthlyL: dailyL * 30,
    dailySaving,
    filter,
    tone: ringTone(filter.percent),
    daysSinceActivation,
    totalLiters,
    cumulativeSaving,
    bottles,
    co2Kg,
    trees: treeEquivalent(co2Kg),
    prevCostPerL: previousCostPerL(state.household),
    purifiedCostPerL: purifiedCostPerL(model),
    paybackMonths,
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)

  const completeOnboarding: Store['completeOnboarding'] = useCallback((data) => {
    const now = Date.now()
    setState((s) => ({
      ...s,
      activated: true,
      serialNo: data.serialNo,
      modelId: data.modelId,
      household: data.household,
      activationMs: now,
      filterInstallMs: now,
    }))
  }, [])

  const loadDemo = useCallback(() => {
    const now = Date.now()
    setState({
      activated: true,
      serialNo: 'MKP-4820-7391',
      modelId: 'pro',
      activationMs: now - 152 * DAY,
      filterInstallMs: now - 38 * DAY,
      household: { ...DEFAULT_HOUSEHOLD },
      notif: DEFAULT_NOTIF,
    })
  }, [])

  const reset = useCallback(() => setState(initialState), [])

  const replaceFilter = useCallback(() => {
    setState((s) => ({ ...s, filterInstallMs: Date.now() }))
  }, [])

  const updateHousehold: Store['updateHousehold'] = useCallback((patch) => {
    setState((s) => ({ ...s, household: { ...s.household, ...patch } }))
  }, [])

  const updateNotif: Store['updateNotif'] = useCallback((patch) => {
    setState((s) => ({ ...s, notif: { ...s.notif, ...patch } }))
  }, [])

  const value = useMemo<Store>(
    () => ({
      ...state,
      metrics: computeMetrics(state),
      completeOnboarding,
      loadDemo,
      reset,
      replaceFilter,
      updateHousehold,
      updateNotif,
    }),
    [state, completeOnboarding, loadDemo, reset, replaceFilter, updateHousehold, updateNotif],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): Store {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
