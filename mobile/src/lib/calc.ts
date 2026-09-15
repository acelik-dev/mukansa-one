// Mukansa One — Tahmine dayalı hesaplama motoru (§3)
// Cihazda sensör yoktur; tüm değerler onboarding cevaplarından türetilir.
// Tüm parametreler sunucudan güncellenebilir varsayılır; burada statik tutulur.

export type UseCase = 'drinking' | 'tea' | 'cooking' | 'pet'
export type Presence = 'home' | 'mixed' | 'away'
export type SourceType = 'damacana' | 'pet' | 'tap' | 'mixed'

export interface DeviceModel {
  id: string
  name: string
  filterModel: string
  /** Filtre kapasitesi (litre) */
  capacityL: number
  /** Kartuş fiyatı (TL) — amortisman hesabı için */
  cartridgePriceTL: number
}

export const MODELS: Record<string, DeviceModel> = {
  standard: {
    id: 'standard',
    name: 'Mukansa One — Standart',
    filterModel: 'Kartuş S1',
    capacityL: 3750,
    cartridgePriceTL: 900,
  },
  pro: {
    id: 'pro',
    name: 'Mukansa One — Pro',
    filterModel: 'Kartuş P1',
    capacityL: 5000,
    cartridgePriceTL: 1200,
  },
}

// §3.1 Kişi başı katsayı (L/kişi/gün)
export const USE_COEFF: Record<Exclude<UseCase, 'pet'>, number> = {
  drinking: 2.0,
  tea: 1.0,
  cooking: 1.5,
}
export const PET_FLAT_L = 1.0 // hane başına sabit

export const PRESENCE_MULT: Record<Presence, number> = {
  home: 1.0,
  mixed: 0.85,
  away: 0.7,
}

// §3.2 Zaman tavanı — hijyen gereği en geç 6 ay
export const TIME_CAP_DAYS = 180

// §3.3 Litre başına maliyet referansları (TL/L)
export const SOURCE_COST_TL_PER_L: Record<SourceType, number> = {
  damacana: 8.95, // 19L belediye markası, iadeli
  pet: 11.0, // 5L kolisi
  tap: 0.08, // şebeke — arıtsa da arıtmasa da bu maliyet var
  mixed: 6.0, // damacana + pet karışımı ortalaması
}

/** Şebeke suyu tarifesi (TL/L) — arıtılmış suyun ham maliyeti */
export const TAP_TARIFF_TL_PER_L = 0.08

export interface Household {
  people: number
  uses: UseCase[]
  presence: Presence
  source: SourceType
  /** Damacana seçilince aylık damacana adedi (opsiyonel override) */
  damacanaPerMonth?: number
  /** Kullanıcının kendi girdiği damacana fiyatı (TL) */
  damacanaPriceTL?: number
  region?: string
}

/** §3.1 Günlük tüketim tahmini (L/gün) */
export function dailyConsumptionL(h: Household): number {
  const perPerson =
    (h.uses.includes('drinking') ? USE_COEFF.drinking : 0) +
    (h.uses.includes('tea') ? USE_COEFF.tea : 0) +
    (h.uses.includes('cooking') ? USE_COEFF.cooking : 0)
  const petFlat = h.uses.includes('pet') ? PET_FLAT_L : 0
  return h.people * perPerson * PRESENCE_MULT[h.presence] + petFlat
}

/** Önceki kaynağın litre başı maliyeti (TL/L) */
export function previousCostPerL(h: Household): number {
  if (h.source === 'damacana' && h.damacanaPriceTL) {
    // 19L damacana varsayımı
    return h.damacanaPriceTL / 19
  }
  return SOURCE_COST_TL_PER_L[h.source]
}

/** §3.3 Arıtılmış su maliyeti (TL/L) = şebeke + filtre amortismanı */
export function purifiedCostPerL(model: DeviceModel): number {
  return TAP_TARIFF_TL_PER_L + model.cartridgePriceTL / model.capacityL
}

/** Günlük tasarruf (TL/gün) */
export function dailySavingsTL(h: Household, model: DeviceModel): number {
  const saving =
    dailyConsumptionL(h) * (previousCostPerL(h) - purifiedCostPerL(model))
  return Math.max(0, saving)
}

export interface FilterStatus {
  remainingL: number
  remainingDays: number
  percent: number // 0-100
  capacityBound: boolean // true ise kapasite belirleyici, false ise zaman tavanı
}

/** §3.2 Filtre durumu — kapasite bazlı kalan ile zaman tavanının minimumu */
export function filterStatus(
  h: Household,
  model: DeviceModel,
  daysSinceInstall: number,
): FilterStatus {
  const daily = dailyConsumptionL(h)
  const usedL = daily * daysSinceInstall
  const remainingCapL = Math.max(0, model.capacityL - usedL)
  const capacityDays = daily > 0 ? remainingCapL / daily : 0
  const timeCapDays = Math.max(0, TIME_CAP_DAYS - daysSinceInstall)

  const remainingDays = Math.min(capacityDays, timeCapDays)
  const capacityBound = capacityDays <= timeCapDays

  // Yüzde: hangisi belirleyiciyse ona göre normalize edilir (kullanıcıya kalan ömür hissi)
  const percent = capacityBound
    ? (remainingCapL / model.capacityL) * 100
    : (timeCapDays / TIME_CAP_DAYS) * 100

  return {
    remainingL: Math.round(remainingCapL),
    remainingDays: Math.round(remainingDays),
    percent: Math.max(0, Math.min(100, percent)),
    capacityBound,
  }
}

export type RingTone = 'ok' | 'warning' | 'danger'
export function ringTone(percent: number): RingTone {
  if (percent <= 10) return 'danger'
  if (percent <= 25) return 'warning'
  return 'ok'
}

/** §3.4 Çevresel etki */
export function bottlesPrevented(totalLiters: number, source: SourceType): number {
  if (source === 'damacana') return Math.round(totalLiters / 19)
  // pet / mixed / tap → 1.5L şişe eşdeğeri
  return Math.round(totalLiters / 1.5)
}

const CO2_PER_BOTTLE_G = 83
export function co2SavedKg(bottles: number): number {
  return Math.round((bottles * CO2_PER_BOTTLE_G) / 1000)
}

/** Ağaç eşdeğeri — yılda ~21 kg CO2 emen ağaç varsayımı */
export function treeEquivalent(co2Kg: number): number {
  return Math.round(co2Kg / 21)
}

export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000))
}

// Biçimlendiriciler
export const trCurrency = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
})
export const trNumber = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0,
})
export function formatTL(n: number): string {
  return trCurrency.format(Math.round(n))
}
export function formatNum(n: number): string {
  return trNumber.format(Math.round(n))
}
