'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { BottomNav, type Tab } from './bottom-nav'
import { Onboarding } from './onboarding'
import { PhoneFrame } from './phone-frame'
import { Dashboard } from './screens/dashboard'
import { Device } from './screens/device'
import { Profile } from './screens/profile'
import { Statistics } from './screens/statistics'

export function AppShell() {
  const { activated } = useApp()
  const [tab, setTab] = useState<Tab>('home')

  return (
    <PhoneFrame>
      {!activated ? (
        <Onboarding />
      ) : (
        <>
          <main key={tab} className="flex-1 overflow-y-auto no-scrollbar animate-fade-up">
            {tab === 'home' && <Dashboard onOpenDevice={() => setTab('device')} />}
            {tab === 'stats' && <Statistics />}
            {tab === 'device' && <Device />}
            {tab === 'profile' && <Profile />}
          </main>
          <BottomNav active={tab} onChange={setTab} />
        </>
      )}
    </PhoneFrame>
  )
}
