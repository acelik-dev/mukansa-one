'use client'

import {
  Bell,
  ChevronRight,
  Globe,
  LifeBuoy,
  LogOut,
  Minus,
  Plus,
  UserPlus,
  Users,
} from 'lucide-react'
import type { Presence, SourceType } from '@/lib/calc'
import { useApp } from '@/lib/store'

const PRESENCE_LABEL: Record<Presence, string> = {
  home: 'Çoğunlukla evde',
  mixed: 'Karışık',
  away: 'Gündüz dışarıda',
}
const SOURCE_LABEL: Record<SourceType, string> = {
  damacana: 'Damacana',
  pet: 'Pet şişe',
  tap: 'Musluk suyu',
  mixed: 'Karışık',
}

export function Profile() {
  const { household, notif, updateHousehold, updateNotif, reset } = useApp()

  return (
    <div className="flex flex-col px-6 pb-6 pt-6">
      <h1 className="font-display text-2xl font-semibold">Profil</h1>

      {/* profil başlık kartı */}
      <div className="mt-5 flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent/15 font-display text-lg font-semibold text-accent">
          MP
        </span>
        <div>
          <p className="font-semibold">Mukansa Pure üyesi</p>
          <p className="text-xs text-muted-foreground">{household.region}</p>
        </div>
      </div>

      {/* hane bilgileri */}
      <SectionTitle>Hane bilgileri</SectionTitle>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-sm">Kişi sayısı</span>
          </div>
          <div className="flex items-center gap-3">
            <Stepper
              value={household.people}
              onChange={(n) => updateHousehold({ people: Math.max(1, n) })}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Evde bulunma</span>
          <div className="flex gap-1">
            {(Object.keys(PRESENCE_LABEL) as Presence[]).map((p) => (
              <button
                key={p}
                onClick={() => updateHousehold({ presence: p })}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  household.presence === p
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-surface-2 text-muted-foreground'
                }`}
              >
                {PRESENCE_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Değişiklikler ileriye dönük hesaplara yansır.
        </p>
      </div>

      {/* fiyat parametreleri */}
      <SectionTitle>Fiyat parametreleri</SectionTitle>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Mevcut kaynağım</span>
          <div className="flex flex-wrap justify-end gap-1">
            {(Object.keys(SOURCE_LABEL) as SourceType[]).map((s) => (
              <button
                key={s}
                onClick={() => updateHousehold({ source: s })}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  household.source === s
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-surface-2 text-muted-foreground'
                }`}
              >
                {SOURCE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        {household.source === 'damacana' && (
          <label className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Damacana fiyatım (19 L)</span>
            <span className="flex items-center gap-1">
              <input
                type="number"
                value={household.damacanaPriceTL ?? ''}
                placeholder="170"
                onChange={(e) =>
                  updateHousehold({
                    damacanaPriceTL: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-right text-sm tabular outline-none focus:border-accent"
              />
              <span className="text-muted-foreground">TL</span>
            </span>
          </label>
        )}
      </div>

      {/* bildirim tercihleri */}
      <SectionTitle>Bildirimler</SectionTitle>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        <Toggle
          label="Haftalık tasarruf özeti"
          on={notif.weeklySummary}
          onToggle={() => updateNotif({ weeklySummary: !notif.weeklySummary })}
        />
        <Toggle
          label="Filtre değişim hatırlatmaları"
          on={notif.filterAlerts}
          onToggle={() => updateNotif({ filterAlerts: !notif.filterAlerts })}
        />
        <Toggle
          label="Tasarruf kilometre taşları"
          on={notif.milestones}
          onToggle={() => updateNotif({ milestones: !notif.milestones })}
        />
        <Toggle
          label="Kampanya ve fırsatlar"
          on={notif.marketing}
          onToggle={() => updateNotif({ marketing: !notif.marketing })}
        />
      </div>

      {/* diğer */}
      <SectionTitle>Diğer</SectionTitle>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        <LinkRow icon={UserPlus} label="Aile üyesi davet et" />
        <LinkRow icon={Globe} label="Dil" trailing="Türkçe" />
        <LinkRow icon={Bell} label="Concierge & destek" />
        <LinkRow icon={LifeBuoy} label="Yardım merkezi" />
      </div>

      <button
        onClick={reset}
        className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-border py-3.5 text-sm font-medium text-muted-foreground active:scale-[0.98]"
      >
        <LogOut className="size-4" />
        Cihaz bağlantısını kaldır
      </button>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Mukansa Pure · Sürüm 1.0
      </p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-7 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  )
}

function Stepper({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(value - 1)}
        aria-label="Azalt"
        className="flex size-8 items-center justify-center rounded-lg border border-border active:scale-95"
      >
        <Minus className="size-4" />
      </button>
      <span className="w-6 text-center font-display text-lg font-semibold tabular">
        {value}
      </span>
      <button
        onClick={() => onChange(value + 1)}
        aria-label="Artır"
        className="flex size-8 items-center justify-center rounded-lg border border-border active:scale-95"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

function Toggle({
  label,
  on,
  onToggle,
}: {
  label: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between p-4 text-left"
      role="switch"
      aria-checked={on}
    >
      <span className="text-sm font-medium">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          on ? 'bg-accent' : 'bg-surface-2'
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-background transition-transform ${
            on ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

function LinkRow({
  icon: Icon,
  label,
  trailing,
}: {
  icon: typeof Bell
  label: string
  trailing?: string
}) {
  return (
    <button className="flex w-full items-center gap-3 p-4 text-left active:bg-surface-2">
      <Icon className="size-5 text-accent" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {trailing && <span className="text-xs text-muted-foreground">{trailing}</span>}
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  )
}
