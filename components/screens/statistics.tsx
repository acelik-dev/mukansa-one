'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Leaf, Recycle } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import { formatNum, formatTL } from '@/lib/calc'
import { useApp } from '@/lib/store'

type Period = 'week' | 'month' | 'year' | 'all'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: 'Hafta' },
  { id: 'month', label: 'Ay' },
  { id: 'year', label: 'Yıl' },
  { id: 'all', label: 'Tümü' },
]

// tüketimi doğal görünür kılmak için sabit tohumlu ufak varyasyon
function variance(i: number) {
  return 0.82 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) / 2 * 0.36
}

export function Statistics() {
  const { metrics } = useApp()
  const { dailyL, dailySaving, daysSinceActivation } = metrics
  const [period, setPeriod] = useState<Period>('month')
  const [showHow, setShowHow] = useState(false)

  const data = useMemo(() => {
    if (period === 'week') {
      const labels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
      let cum = 0
      return labels.map((label, i) => {
        const liters = dailyL * variance(i)
        cum += liters * (dailySaving / dailyL)
        return { label, liters: Math.round(liters), saving: Math.round(cum) }
      })
    }
    if (period === 'month') {
      let cum = 0
      return Array.from({ length: 4 }, (_, i) => {
        const liters = dailyL * 7 * variance(i + 3)
        cum += liters * (dailySaving / dailyL)
        return {
          label: `${i + 1}. hf`,
          liters: Math.round(liters),
          saving: Math.round(cum),
        }
      })
    }
    if (period === 'year') {
      const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
      let cum = 0
      return months.map((label, i) => {
        const liters = dailyL * 30 * variance(i + 1)
        cum += liters * (dailySaving / dailyL)
        return { label, liters: Math.round(liters), saving: Math.round(cum) }
      })
    }
    // all — aktivasyondan beri, aylık kovalar
    const monthsCount = Math.max(1, Math.ceil(daysSinceActivation / 30))
    let cum = 0
    return Array.from({ length: monthsCount }, (_, i) => {
      const liters = dailyL * 30 * variance(i + 2)
      cum += liters * (dailySaving / dailyL)
      return { label: `${i + 1}. ay`, liters: Math.round(liters), saving: Math.round(cum) }
    })
  }, [period, dailyL, dailySaving, daysSinceActivation])

  const totalLiters = data.reduce((a, d) => a + d.liters, 0)
  const totalSaving = data[data.length - 1]?.saving ?? 0
  const bottles = Math.round(totalLiters / 1.5)
  const co2 = Math.round((bottles * 83) / 1000)

  return (
    <div className="flex flex-col px-6 pb-6 pt-6">
      <h1 className="font-display text-2xl font-semibold">İstatistikler</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tahmini tüketim ve tasarruf geçmişiniz.
      </p>

      {/* dönem seçici */}
      <div className="mt-5 flex gap-1 rounded-2xl border border-border bg-surface p-1">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
              period === p.id
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* tüketim çubuk grafiği */}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Toplam tüketim</span>
          <span className="font-display text-lg font-semibold tabular">
            {formatNum(totalLiters)} L
          </span>
        </div>
        <div className="mt-4 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8ba0a8', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: '#ffffff08' }}
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#8ba0a8' }}
                formatter={(v) => [`${formatNum(Number(v))} L`, 'Tüketim']}
              />
              <Bar dataKey="liters" fill="#2e7d8c" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* kümülatif tasarruf alan grafiği */}
      <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Kümülatif tasarruf</span>
          <span className="font-display text-lg font-semibold tabular text-accent">
            {formatTL(totalSaving)}
          </span>
        </div>
        <div className="mt-4 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="savingFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c8a15a" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#c8a15a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8ba0a8', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ stroke: '#c8a15a', strokeOpacity: 0.3 }}
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#8ba0a8' }}
                formatter={(v) => [formatTL(Number(v)), 'Tasarruf']}
              />
              <Area
                type="monotone"
                dataKey="saving"
                stroke="#c8a15a"
                strokeWidth={2}
                fill="url(#savingFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* çevresel etki kartları */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <Recycle className="size-5 text-water-light" />
          <p className="mt-4 font-display text-2xl font-semibold tabular">
            {formatNum(bottles)}
          </p>
          <p className="text-xs text-muted-foreground">engellenen şişe</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <Leaf className="size-5 text-water-light" />
          <p className="mt-4 font-display text-2xl font-semibold tabular">{co2} kg</p>
          <p className="text-xs text-muted-foreground">CO₂ eşdeğeri</p>
        </div>
      </div>

      {/* şeffaflık: nasıl hesaplanıyor */}
      <button
        onClick={() => setShowHow((v) => !v)}
        className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-surface px-5 py-4 text-left"
      >
        <span className="text-sm font-medium">Tahminler nasıl hesaplanıyor?</span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${showHow ? 'rotate-180' : ''}`}
        />
      </button>
      {showHow && (
        <div className="mt-2 animate-fade-up rounded-2xl border border-border bg-surface/60 p-5 text-sm leading-relaxed text-muted-foreground">
          <p>
            Cihazınızda sensör yoktur; değerler onboarding&apos;de verdiğiniz
            bilgilerden türetilir:
          </p>
          <ul className="mt-3 space-y-2">
            <li>
              <span className="text-foreground">Günlük tüketim</span> = kişi sayısı ×
              kullanım katsayısı × evde bulunma çarpanı. Sizde ~{formatNum(dailyL)}{' '}
              L/gün.
            </li>
            <li>
              <span className="text-foreground">Tasarruf</span> = tüketim × (eski su
              maliyeti − arıtılmış su maliyeti).
            </li>
            <li>
              Fiyat parametreleri düzenli güncellenir; kendi damacana fiyatınızı
              Profil&apos;den girebilirsiniz.
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

const tooltipStyle = {
  background: '#14232a',
  border: '1px solid #24363f',
  borderRadius: 12,
  fontSize: 12,
  color: '#f2f4f5',
}
