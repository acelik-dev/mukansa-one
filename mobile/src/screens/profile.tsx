import type { ReactNode } from 'react'
import {
  Bell,
  ChevronRight,
  Globe,
  LifeBuoy,
  LogOut,
  Minus,
  Plus,
  Users,
} from 'lucide-react-native'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { Presence, SourceType } from '../lib/calc'
import { useApp } from '../lib/store'
import { colors } from '../theme'

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
    <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
      <Text style={styles.h1}>Profil</Text>

      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>MP</Text>
        </View>
        <View>
          <Text style={styles.heroTitle}>Mukansa Pure üyesi</Text>
          <Text style={styles.muted}>{household.region}</Text>
        </View>
      </View>

      <Text style={styles.section}>Hane bilgileri</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Users size={16} color={colors.muted} />
            <Text style={styles.rowLabel}>Kişi sayısı</Text>
          </View>
          <Stepper
            value={household.people}
            onChange={(n) => updateHousehold({ people: Math.max(1, n) })}
          />
        </View>
        <View style={[styles.rowBetween, { marginTop: 16 }]}>
          <Text style={styles.muted}>Evde bulunma</Text>
          <View style={styles.chips}>
            {(Object.keys(PRESENCE_LABEL) as Presence[]).map((p) => (
              <Pressable
                key={p}
                onPress={() => updateHousehold({ presence: p })}
                style={[styles.chip, household.presence === p && styles.chipOn]}
              >
                <Text
                  style={[
                    styles.chipText,
                    household.presence === p && styles.chipTextOn,
                  ]}
                >
                  {PRESENCE_LABEL[p]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={[styles.muted, { marginTop: 12 }]}>
          Değişiklikler ileriye dönük hesaplara yansır.
        </Text>
      </View>

      <Text style={styles.section}>Fiyat parametreleri</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.muted}>Mevcut kaynağım</Text>
          <View style={styles.chips}>
            {(Object.keys(SOURCE_LABEL) as SourceType[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => updateHousehold({ source: s })}
                style={[styles.chip, household.source === s && styles.chipOn]}
              >
                <Text
                  style={[styles.chipText, household.source === s && styles.chipTextOn]}
                >
                  {SOURCE_LABEL[s]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {household.source === 'damacana' && (
          <View style={[styles.rowBetween, { marginTop: 16 }]}>
            <Text style={styles.muted}>Damacana fiyatım (19 L)</Text>
            <View style={styles.row}>
              <TextInput
                value={household.damacanaPriceTL?.toString() ?? ''}
                placeholder="170"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                onChangeText={(t) =>
                  updateHousehold({
                    damacanaPriceTL: t ? Number(t) : undefined,
                  })
                }
                style={styles.input}
              />
              <Text style={styles.muted}>TL</Text>
            </View>
          </View>
        )}
      </View>

      <Text style={styles.section}>Bildirimler</Text>
      <View style={styles.list}>
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
          last
        />
      </View>

      <Text style={styles.section}>Diğer</Text>
      <View style={styles.list}>
        <LinkRow icon={<Globe size={20} color={colors.accent} />} label="Dil" trailing="Türkçe" />
        <LinkRow icon={<Bell size={20} color={colors.accent} />} label="Concierge & destek" />
        <LinkRow icon={<LifeBuoy size={20} color={colors.accent} />} label="Yardım merkezi" last />
      </View>

      <Pressable onPress={reset} style={styles.logout}>
        <LogOut size={16} color={colors.muted} />
        <Text style={styles.logoutText}>Cihaz bağlantısını kaldır</Text>
      </Pressable>
      <Text style={styles.version}>Mukansa Pure · Sürüm 1.0</Text>
    </ScrollView>
  )
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.row}>
      <Pressable onPress={() => onChange(value - 1)} style={styles.stepBtn}>
        <Minus size={16} color={colors.foreground} />
      </Pressable>
      <Text style={styles.stepVal}>{value}</Text>
      <Pressable onPress={() => onChange(value + 1)} style={styles.stepBtn}>
        <Plus size={16} color={colors.foreground} />
      </Pressable>
    </View>
  )
}

function Toggle({
  label,
  on,
  onToggle,
  last,
}: {
  label: string
  on: boolean
  onToggle: () => void
  last?: boolean
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.toggleRow, !last && styles.borderBottom]}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={[styles.switch, on && styles.switchOn]}>
        <View style={[styles.knob, on && styles.knobOn]} />
      </View>
    </Pressable>
  )
}

function LinkRow({
  icon,
  label,
  trailing,
  last,
}: {
  icon: ReactNode
  label: string
  trailing?: string
  last?: boolean
}) {
  return (
    <Pressable style={[styles.linkRow, !last && styles.borderBottom]}>
      {icon}
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      {trailing ? <Text style={styles.muted}>{trailing}</Text> : null}
      <ChevronRight size={16} color={colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  h1: { fontSize: 24, fontWeight: '600', color: colors.foreground },
  hero: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: 'rgba(200,161,90,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '600', color: colors.accent },
  heroTitle: { fontWeight: '600', color: colors.foreground },
  muted: { fontSize: 12, color: colors.muted },
  section: {
    marginTop: 28,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowLabel: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4, flex: 1 },
  chip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.surface2,
  },
  chipOn: { backgroundColor: colors.accent },
  chipText: { fontSize: 12, fontWeight: '500', color: colors.muted },
  chipTextOn: { color: colors.accentForeground },
  input: {
    width: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    textAlign: 'right',
    color: colors.foreground,
    fontSize: 14,
  },
  list: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: colors.border },
  switch: {
    width: 44,
    height: 24,
    borderRadius: 999,
    backgroundColor: colors.surface2,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchOn: { backgroundColor: colors.accent },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  knobOn: { alignSelf: 'flex-end' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: {
    width: 24,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  logout: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
  },
  logoutText: { fontSize: 14, fontWeight: '500', color: colors.muted },
  version: { marginTop: 16, textAlign: 'center', fontSize: 12, color: colors.muted },
})
