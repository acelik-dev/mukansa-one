'use client'

import { BarChart3, Home, User, Waves } from 'lucide-react'

export type Tab = 'home' | 'stats' | 'device' | 'profile'

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Ana Ekran', icon: Home },
  { id: 'stats', label: 'İstatistik', icon: BarChart3 },
  { id: 'device', label: 'Cihazım', icon: Waves },
  { id: 'profile', label: 'Profil', icon: User },
]

export function BottomNav({
  active,
  onChange,
}: {
  active: Tab
  onChange: (t: Tab) => void
}) {
  return (
    <nav className="border-t border-border bg-surface/80 backdrop-blur-lg">
      <div className="flex items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => {
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator)
                  navigator.vibrate?.(6)
                onChange(id)
              }}
              className="flex flex-1 flex-col items-center gap-1 py-1.5"
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={`size-6 transition-colors ${
                  isActive ? 'text-accent' : 'text-muted-foreground'
                }`}
                strokeWidth={isActive ? 2.4 : 1.8}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-accent' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
