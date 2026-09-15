import * as Haptics from 'expo-haptics'
import { BarChart3, Home, User, Waves } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../theme'

export type Tab = 'home' | 'stats' | 'device' | 'profile'

const TABS: { id: Tab; label: string; Icon: typeof Home }[] = [
  { id: 'home', label: 'Ana Ekran', Icon: Home },
  { id: 'stats', label: 'İstatistik', Icon: BarChart3 },
  { id: 'device', label: 'Cihazım', Icon: Waves },
  { id: 'profile', label: 'Profil', Icon: User },
]

export function BottomNav({
  active,
  onChange,
}: {
  active: Tab
  onChange: (t: Tab) => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.nav, { paddingBottom: Math.max(8, insets.bottom) }]}>
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id
        const color = isActive ? colors.accent : colors.muted
        return (
          <Pressable
            key={id}
            onPress={() => {
              Haptics.selectionAsync()
              onChange(id)
            }}
            style={styles.tab}
            accessibilityState={{ selected: isActive }}
          >
            <Icon size={24} color={color} strokeWidth={isActive ? 2.4 : 1.8} />
            <Text style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(20,35,42,0.92)',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
  },
})
