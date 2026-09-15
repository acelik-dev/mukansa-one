'use client'

import {
  Droplets,
  Leaf,
  MapPin,
  Recycle,
  TrendingUp,
  Truck,
} from 'lucide-react'
import { bottlesPrevented, formatNum, formatTL } from '@/lib/calc'
import { useApp } from '@/lib/store'
import { FilterRing } from '../filter-ring'
import { LiveSavings } from '../live-savings'

function haptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8)
}

export function Dashboard({ onOpenDevice }: { onOpenDevice: () => void }) {
  const { metrics, household, serialNo } = useApp()
  const {
    filter,
    tone,
    dailyL,
    monthlyL,
    dailySaving,
    cumulativeSaving,
    bottles,
    co2Kg,
    trees,
    paybackMonths,
  } = metrics

  const deviceCost = 8900 // örnek cihaz fiyatı (amortisman kartı için)
  const amortized = cumulativeSaving >= deviceCost
  const monthlyBottles = bottlesPrevented(monthlyL, household.source)

  return (
    <div className="flex flex-col pb-6">
      {/* dekoratif su başlığı */}
      <div className="relative overflow-hidden px-6 pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">İyi günler,</p>
            <h1 className="font-display text-xl font-semibold">Eviniz temiz suda.</h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5">
            <MapPin className="size-3.5 text-accent" />
            <span className="text-xs text-muted-foreground">
              {household.region?.split(' / ')[1] ?? 'Bölge'}
            </span>
          </div>
        </div>
      </div>

      {/* kahraman: filtre halkası */}
      <div className="flex flex-col items-center pt-6">
        <FilterRing
          percent={filter.percent}
          tone={tone}
          remainingDays={filter.remainingDays}
          onClick={() => {
            haptic()
            onOpenDevice()
          }}
        />
      </div>

      {/* kümülatif tasarruf sayacı */}
      <div className="mt-6 flex flex-col items-center">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Aktivasyondan beri tasarruf
        </span>
        <LiveSavings
          base={cumulativeSaving}
          dailyRate={dailySaving}
          className="mt-1 font-display text-5xl font-semibold text-accent"
        />
        <div className="mt-2 flex items-center gap-1.5 text-sm text-water-light">
          <TrendingUp className="size-4" />
          <span className="tabular">Günde ~{formatTL(dailySaving)} birikiyor</span>
        </div>
      </div>

      {/* hızlı eylem: filtre siparişi */}
      {filter.percent <= 25 && (
        <div className="mt-6 px-6">
          <button
            onClick={haptic}
            className="flex w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-left transition-all active:scale-[0.98]"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-accent">
              <Truck className="size-5 text-accent-foreground" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">Filtre sipariş et</span>
              <span className="block text-xs text-muted-foreground">
                Değişim zamanına {filter.remainingDays} gün — tam gününde kapınızda
                olsun
              </span>
            </span>
          </button>
        </div>
      )}

      {/* günün kartları — yatay ray */}
      <div className="mt-7">
        <div className="mb-3 flex items-center justify-between px-6">
          <h2 className="text-sm font-semibold">Bugün</h2>
          <span className="text-xs text-muted-foreground">Kaydırın</span>
        </div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-6 pb-1">
          <InsightCard
            icon={Droplets}
            value={`~${formatNum(dailyL)} L`}
            label="bugün temiz su"
            accent="water"
          />
          <InsightCard
            icon={Recycle}
            value={formatNum(monthlyBottles)}
            label="bu ay engellenen şişe"
            accent="water"
          />
          <InsightCard
            icon={Leaf}
            value={`${formatNum(co2Kg)} kg`}
            label={`CO₂ · ~${trees} ağaç`}
            accent="ok"
          />
          <InsightCard
            icon={TrendingUp}
            value={amortized ? 'Tamam' : `${paybackMonths.toFixed(1)} ay`}
            label={amortized ? 'cihaz kendini amorti etti' : 'amortismana kalan'}
            accent="gold"
          />
        </div>
      </div>

      {/* engellenen plastik özeti */}
      <div className="mt-6 px-6">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-2 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Toplam engellenen plastik
              </p>
              <p className="mt-1 font-display text-3xl font-semibold tabular">
                {formatNum(bottles)}{' '}
                <span className="text-base font-normal text-muted-foreground">şişe</span>
              </p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-full bg-water/20">
              <Recycle className="size-6 text-water-light" />
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Seri no {serialNo} · yaklaşık {formatNum(metrics.totalLiters)} L arıtılmış
            su ürettiniz.
          </p>
        </div>
      </div>
    </div>
  )
}

function InsightCard({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: typeof Droplets
  value: string
  label: string
  accent: 'water' | 'gold' | 'ok'
}) {
  const color =
    accent === 'gold'
      ? 'text-accent'
      : accent === 'ok'
        ? 'text-water-light'
        : 'text-water-light'
  return (
    <div className="flex min-w-[150px] flex-col justify-between rounded-2xl border border-border bg-surface p-4">
      <Icon className={`size-5 ${color}`} />
      <div className="mt-6">
        <p className="font-display text-xl font-semibold tabular">{value}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
