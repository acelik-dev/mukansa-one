import { useMemo, useState } from 'react'
import { ChevronDown, Leaf, Recycle } from 'lucide-react-native'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { formatNum, formatTL } from '../lib/calc'
import { useApp } from '../lib/store'
import { colors } from '../theme'

type Period = 'week' | 'month' | 'year' | 'all'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: 'Hafta' },
  { id: 'month', label: 'Ay' },
  { id: 'year', label: 'Yıl' },
  { id: 'all', label: 'Tümü' },
]

function variance(i: number) {
  return 0.82 + ((((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) / 2) * 0.36
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
        cum += liters * (dailySaving / dailyL || 0)
        return { label, liters: Math.round(liters), saving: Math.round(cum) }
      })
    }
    if (period === 'month') {
      let cum = 0
      return Array.from({ length: 4 }, (_, i) => {
        const liters = dailyL * 7 * variance(i + 3)
        cum += liters * (dailySaving / dailyL || 0)
        return { label: `${i + 1}. hf`, liters: Math.round(liters), saving: Math.round(cum) }
      })
    }
    if (period === 'year') {
      const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
      let cum = 0
      return months.map((label, i) => {
        const liters = dailyL * 30 * variance(i + 1)
        cum += liters * (dailySaving / dailyL || 0)
        return { label, liters: Math.round(liters), saving: Math.round(cum) }
      })
    }
    const monthsCount = Math.max(1, Math.ceil(daysSinceActivation / 30))
    let cum = 0
    return Array.from({ length: monthsCount }, (_, i) => {
      const liters = dailyL * 30 * variance(i + 2)
      cum += liters * (dailySaving / dailyL || 0)
      return { label: `${i + 1}. ay`, liters: Math.round(liters), saving: Math.round(cum) }
    })
  }, [period, dailyL, dailySaving, daysSinceActivation])

  const totalLiters = data.reduce((a, d) => a + d.liters, 0)
  const totalSaving = data[data.length - 1]?.saving ?? 0
  const bottles = Math.round(totalLiters / 1.5)
  const co2 = Math.round((bottles * 83) / 1000)
  const maxLiters = Math.max(...data.map((d) => d.liters), 1)

  return (
    <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
      <Text style={styles.h1}>İstatistikler</Text>
      <Text style={styles.sub}>Tahmini tüketim ve tasarruf geçmişiniz.</Text>

      <View style={styles.periods}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setPeriod(p.id)}
            style={[styles.periodBtn, period === p.id && styles.periodOn]}
          >
            <Text style={[styles.periodText, period === p.id && styles.periodTextOn]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.muted}>Toplam tüketim</Text>
          <Text style={styles.cardValue}>{formatNum(totalLiters)} L</Text>
        </View>
        <View style={styles.bars}>
          {data.slice(0, 12).map((d) => (
            <View key={d.label} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: `${Math.max(8, (d.liters / maxLiters) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.barLabel} numberOfLines={1}>
                {d.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.muted}>Kümülatif tasarruf</Text>
          <Text style={[styles.cardValue, { color: colors.accent }]}>
            {formatTL(totalSaving)}
          </Text>
        </View>
        <AreaSpark data={data.map((d) => d.saving)} />
      </View>

      <View style={styles.grid}>
        <View style={styles.half}>
          <Recycle size={20} color={colors.waterLight} />
          <Text style={styles.statNum}>{formatNum(bottles)}</Text>
          <Text style={styles.muted}>engellenen şişe</Text>
        </View>
        <View style={styles.half}>
          <Leaf size={20} color={colors.waterLight} />
          <Text style={styles.statNum}>{co2} kg</Text>
          <Text style={styles.muted}>CO₂ eşdeğeri</Text>
        </View>
      </View>

      <Pressable onPress={() => setShowHow((v) => !v)} style={styles.howBtn}>
        <Text style={styles.howTitle}>Tahminler nasıl hesaplanıyor?</Text>
        <ChevronDown
          size={16}
          color={colors.muted}
          style={{ transform: [{ rotate: showHow ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {showHow && (
        <View style={styles.howBody}>
          <Text style={styles.howText}>
            Cihazınızda sensör yoktur; değerler onboarding'de verdiğiniz bilgilerden türetilir:
          </Text>
          <Text style={styles.howBullet}>
            Günlük tüketim = kişi × kullanım × bulunma. Sizde ~{formatNum(dailyL)} L/gün.
          </Text>
          <Text style={styles.howBullet}>
            Tasarruf = tüketim × (eski su maliyeti − arıtılmış su maliyeti).
          </Text>
          <Text style={styles.howBullet}>
            Fiyat parametrelerini Profil'den güncelleyebilirsiniz.
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

function AreaSpark({ data }: { data: number[] }) {
  const w = 300
  const h = 120
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => {
    const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w
    const y = h - (v / max) * (h - 8) - 4
    return `${x},${y}`
  })
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p}`).join(' ')
  const area = `${line} L ${w},${h} L 0,${h} Z`

  return (
    <View style={{ marginTop: 16, height: h }}>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <LinearGradient id="savingFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#c8a15a" stopOpacity={0.5} />
            <Stop offset="100%" stopColor="#c8a15a" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#savingFill)" />
        <Path d={line} stroke="#c8a15a" strokeWidth={2} fill="none" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  h1: { fontSize: 24, fontWeight: '600', color: colors.foreground },
  sub: { marginTop: 4, fontSize: 14, color: colors.muted },
  periods: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 4,
  },
  periodBtn: { flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  periodOn: { backgroundColor: colors.accent },
  periodText: { fontSize: 14, fontWeight: '500', color: colors.muted },
  periodTextOn: { color: colors.accentForeground },
  card: {
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  muted: { fontSize: 12, color: colors.muted },
  bars: { marginTop: 16, height: 140, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    maxWidth: 28,
  },
  bar: {
    width: '100%',
    backgroundColor: colors.water,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 8,
  },
  barLabel: { marginTop: 6, fontSize: 10, color: colors.muted },
  grid: { marginTop: 16, flexDirection: 'row', gap: 12 },
  half: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
  },
  statNum: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '600',
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  howBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  howTitle: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  howBody: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(20,35,42,0.6)',
    padding: 20,
    gap: 10,
  },
  howText: { fontSize: 14, lineHeight: 20, color: colors.muted },
  howBullet: { fontSize: 14, lineHeight: 20, color: colors.muted },
})
