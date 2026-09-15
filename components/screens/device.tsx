'use client'

import { useEffect, useState } from 'react'
import {
  BadgeCheck,
  Calendar,
  Check,
  ChevronRight,
  Download,
  FileText,
  PlayCircle,
  RefreshCw,
  ScanLine,
  Wrench,
} from 'lucide-react'
import { formatNum } from '@/lib/calc'
import { useApp } from '@/lib/store'

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function Device() {
  const { metrics, serialNo, activationMs, filterInstallMs, replaceFilter } = useApp()
  const { model, filter, tone } = metrics
  const [flow, setFlow] = useState<'idle' | 'scan' | 'done'>('idle')

  const toneColor =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-water-light'
  const barColor =
    tone === 'danger' ? '#e05a4a' : tone === 'warning' ? '#e0a34a' : '#7fd4e4'

  return (
    <div className="flex flex-col px-6 pb-6 pt-6">
      <h1 className="font-display text-2xl font-semibold">Cihazım</h1>

      {/* cihaz kartı */}
      <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface to-surface-2">
        <div className="flex items-center justify-center bg-gradient-to-b from-water/10 to-transparent py-6">
          <img
            src="/device.png"
            alt={`${model.name} arıtma cihazı`}
            className="h-44 w-auto object-contain"
          />
        </div>
        <div className="space-y-3 p-5">
          <InfoRow icon={BadgeCheck} label="Model" value={model.name} />
          <InfoRow icon={FileText} label="Seri numarası" value={serialNo} />
          <InfoRow
            icon={Calendar}
            label="Aktivasyon"
            value={formatDate(activationMs)}
          />
        </div>
      </div>

      {/* dijital garanti kartı */}
      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-accent/40 bg-accent/10 p-5">
        <span className="flex size-11 items-center justify-center rounded-xl bg-accent">
          <BadgeCheck className="size-5 text-accent-foreground" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold">Dijital garanti · 3 yıl</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(activationMs)} tarihinde başladı
          </p>
        </div>
        <button
          aria-label="Garanti belgesini indir"
          className="flex size-10 items-center justify-center rounded-xl border border-border active:scale-95"
        >
          <Download className="size-4 text-accent" />
        </button>
      </div>

      {/* filtre bölümü */}
      <h2 className="mt-7 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Filtre
      </h2>
      <div className="mt-3 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-4">
          <img
            src="/cartridge.png"
            alt="Filtre kartuşu"
            className="h-16 w-auto object-contain"
          />
          <div className="flex-1">
            <p className="text-sm font-semibold">{model.filterModel}</p>
            <p className="text-xs text-muted-foreground">
              Takılma: {formatDate(filterInstallMs)}
            </p>
          </div>
          <span className={`font-display text-2xl font-semibold tabular ${toneColor}`}>
            %{Math.round(filter.percent)}
          </span>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${filter.percent}%`, background: barColor }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {filter.remainingDays} gün · ~{formatNum(filter.remainingL)} L kaldı
          {filter.capacityBound ? ' (kapasite)' : ' (6 ay hijyen sınırı)'}
        </p>

        <button
          onClick={() => setFlow('scan')}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium active:scale-[0.98]"
        >
          <RefreshCw className="size-4 text-accent" />
          Filtre değiştirdim
        </button>
      </div>

      {/* servis bölümü */}
      <h2 className="mt-7 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Servis
      </h2>
      <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        <ServiceRow icon={Wrench} label="Teknisyen randevusu al" />
        <ServiceRow icon={PlayCircle} label="Kurulum videoları" />
        <ServiceRow icon={FileText} label="Sıkça sorulan sorular" />
      </div>

      {flow !== 'idle' && (
        <ReplaceFilterFlow
          stage={flow}
          onScanned={() => {
            replaceFilter()
            setFlow('done')
          }}
          onClose={() => setFlow('idle')}
        />
      )}
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BadgeCheck
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="ml-auto text-sm font-medium">{value}</span>
    </div>
  )
}

function ServiceRow({ icon: Icon, label }: { icon: typeof Wrench; label: string }) {
  return (
    <button className="flex w-full items-center gap-3 p-4 text-left active:bg-surface-2">
      <Icon className="size-5 text-accent" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  )
}

/* filtre değişim akışı: tara → sıfırla → kutlama */
function ReplaceFilterFlow({
  stage,
  onScanned,
  onClose,
}: {
  stage: 'scan' | 'done'
  onScanned: () => void
  onClose: () => void
}) {
  useEffect(() => {
    if (stage === 'scan') {
      const t = setTimeout(onScanned, 1900)
      return () => clearTimeout(t)
    }
    if (stage === 'done') {
      if ('vibrate' in navigator) navigator.vibrate?.([10, 40, 10])
      const t = setTimeout(onClose, 2200)
      return () => clearTimeout(t)
    }
  }, [stage, onScanned, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="mx-6 w-full max-w-[360px] rounded-3xl border border-border bg-surface p-8 text-center">
        {stage === 'scan' ? (
          <>
            <div className="relative mx-auto flex size-40 items-center justify-center overflow-hidden rounded-3xl border border-border bg-background">
              <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_12px_#c8a15a] [animation:scanline2_1.3s_ease-in-out_infinite]" />
              <ScanLine className="size-14 text-muted-foreground" />
            </div>
            <h3 className="mt-6 font-display text-lg font-semibold">
              Yeni kartuşu tarayın
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Orijinallik doğrulanıyor…
            </p>
            <style>{`@keyframes scanline2{0%{top:6%}50%{top:90%}100%{top:6%}}`}</style>
          </>
        ) : (
          <>
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-accent animate-fade-up">
              <Check className="size-10 text-accent-foreground" />
            </div>
            <h3 className="mt-6 font-display text-lg font-semibold">
              Filtreniz yenilendi
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Sayaç sıfırlandı. Temiz suyun tadını çıkarın.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
