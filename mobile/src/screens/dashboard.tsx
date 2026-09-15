import * as Haptics from 'expo-haptics'
import {
  Droplets,
  Leaf,
  MapPin,
  Recycle,
  TrendingUp,
  Truck,
} from 'lucide-react-native'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { bottlesPrevented, formatNum, formatTL } from '../lib/calc'
import { useApp } from '../lib/store'
import { FilterRing } from '../components/filter-ring'
import { LiveSavings } from '../components/live-savings'
import { colors } from '../theme'

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

  const deviceCost = 8900
  const amortized = cumulativeSaving >= deviceCost
  const monthlyBottles = bottlesPrevented(monthlyL, household.source)

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>İyi günler,</Text>
          <Text style={styles.title}>Eviniz temiz suda.</Text>
        </View>
        <View style={styles.regionChip}>
          <MapPin size={14} color={colors.accent} />
          <Text style={styles.regionText}>
            {household.region?.split(' / ')[1] ?? 'Bölge'}
          </Text>
        </View>
      </View>

      <View style={styles.ringWrap}>
        <FilterRing
          percent={filter.percent}
          tone={tone}
          remainingDays={filter.remainingDays}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onOpenDevice()
          }}
        />
      </View>

      <View style={styles.savingsBlock}>
        <Text style={styles.savingsLabel}>Aktivasyondan beri tasarruf</Text>
        <LiveSavings
          base={cumulativeSaving}
          dailyRate={dailySaving}
          style={styles.savingsValue}
        />
        <View style={styles.dailyRow}>
          <TrendingUp size={16} color={colors.waterLight} />
          <Text style={styles.dailyText}>
            Günde ~{formatTL(dailySaving)} birikiyor
          </Text>
        </View>
      </View>

      {filter.percent <= 25 && (
        <Pressable
          onPress={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          style={({ pressed }) => [styles.orderBtn, pressed && styles.pressed]}
        >
          <View style={styles.orderIcon}>
            <Truck size={20} color={colors.accentForeground} />
          </View>
          <View style={styles.orderTextWrap}>
            <Text style={styles.orderTitle}>Filtre sipariş et</Text>
            <Text style={styles.orderSub}>
              Değişim zamanına {filter.remainingDays} gün — tam gününde kapınızda
              olsun
            </Text>
          </View>
        </Pressable>
      )}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Bugün</Text>
        <Text style={styles.sectionHint}>Kaydırın</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.insightRow}
      >
        <InsightCard
          Icon={Droplets}
          value={`~${formatNum(dailyL)} L`}
          label="bugün temiz su"
        />
        <InsightCard
          Icon={Recycle}
          value={formatNum(monthlyBottles)}
          label="bu ay engellenen şişe"
        />
        <InsightCard
          Icon={Leaf}
          value={`${formatNum(co2Kg)} kg`}
          label={`CO₂ · ~${trees} ağaç`}
        />
        <InsightCard
          Icon={TrendingUp}
          value={amortized ? 'Tamam' : `${paybackMonths.toFixed(1)} ay`}
          label={amortized ? 'cihaz kendini amorti etti' : 'amortismana kalan'}
          gold
        />
      </ScrollView>

      <View style={styles.plasticCard}>
        <View style={styles.plasticTop}>
          <View>
            <Text style={styles.plasticLabel}>Toplam engellenen plastik</Text>
            <Text style={styles.plasticValue}>
              {formatNum(bottles)}{' '}
              <Text style={styles.plasticUnit}>şişe</Text>
            </Text>
          </View>
          <View style={styles.plasticIcon}>
            <Recycle size={24} color={colors.waterLight} />
          </View>
        </View>
        <Text style={styles.plasticFoot}>
          Seri no {serialNo} · yaklaşık {formatNum(metrics.totalLiters)} L arıtılmış
          su ürettiniz.
        </Text>
      </View>
    </ScrollView>
  )
}

function InsightCard({
  Icon,
  value,
  label,
  gold,
}: {
  Icon: typeof Droplets
  value: string
  label: string
  gold?: boolean
}) {
  const color = gold ? colors.accent : colors.waterLight
  return (
    <View style={styles.insightCard}>
      <Icon size={20} color={color} />
      <View style={styles.insightBottom}>
        <Text style={styles.insightValue}>{value}</Text>
        <Text style={styles.insightLabel}>{label}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  greeting: { fontSize: 14, color: colors.muted },
  title: { fontSize: 20, fontWeight: '600', color: colors.foreground },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  regionText: { fontSize: 12, color: colors.muted },
  ringWrap: { alignItems: 'center', paddingTop: 24 },
  savingsBlock: { marginTop: 24, alignItems: 'center' },
  savingsLabel: {
    fontSize: 12,
    letterSpacing: 3.2,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  savingsValue: {
    marginTop: 4,
    fontSize: 48,
    fontWeight: '600',
    color: colors.accent,
  },
  dailyRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dailyText: {
    fontSize: 14,
    color: colors.waterLight,
    fontVariant: ['tabular-nums'],
  },
  orderBtn: {
    marginTop: 24,
    marginHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(200, 161, 90, 0.4)',
    backgroundColor: 'rgba(200, 161, 90, 0.1)',
    padding: 16,
  },
  orderIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderTextWrap: { flex: 1 },
  orderTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  orderSub: { marginTop: 2, fontSize: 12, color: colors.muted },
  pressed: { transform: [{ scale: 0.98 }] },
  sectionHead: {
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  sectionHint: { fontSize: 12, color: colors.muted },
  insightRow: { paddingHorizontal: 24, gap: 12, paddingBottom: 4 },
  insightCard: {
    minWidth: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    justifyContent: 'space-between',
  },
  insightBottom: { marginTop: 24 },
  insightValue: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  insightLabel: { marginTop: 2, fontSize: 12, color: colors.muted, lineHeight: 16 },
  plasticCard: {
    marginTop: 24,
    marginHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
  },
  plasticTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plasticLabel: {
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  plasticValue: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: '600',
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  plasticUnit: { fontSize: 16, fontWeight: '400', color: colors.muted },
  plasticIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(46, 125, 140, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plasticFoot: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
})
