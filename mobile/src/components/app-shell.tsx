import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApp } from '../lib/store'
import { Dashboard } from '../screens/dashboard'
import { Device } from '../screens/device'
import { Profile } from '../screens/profile'
import { Statistics } from '../screens/statistics'
import { colors } from '../theme'
import { BottomNav, type Tab } from './bottom-nav'
import { Onboarding } from './onboarding'

export function AppShell() {
  const { activated } = useApp()
  const [tab, setTab] = useState<Tab>('home')
  const insets = useSafeAreaInsets()

  if (!activated) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Onboarding />
      </View>
    )
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.main}>
        {tab === 'home' && <Dashboard onOpenDevice={() => setTab('device')} />}
        {tab === 'stats' && <Statistics />}
        {tab === 'device' && <Device />}
        {tab === 'profile' && <Profile />}
      </View>
      <BottomNav active={tab} onChange={setTab} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  main: { flex: 1 },
})
