import { useEffect, useState, type ReactNode } from 'react'
import * as Haptics from 'expo-haptics'
import {
  BadgeCheck,
  Calendar,
  Check,
  ChevronRight,
  Download,
  FileText,
  RefreshCw,
  ScanLine,
  Wrench,
} from 'lucide-react-native'
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { formatNum } from '../lib/calc'
import { useApp } from '../lib/store'
import { colors } from '../theme'

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
    tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.waterLight
  const barColor =
    tone === 'danger' ? '#e05a4a' : tone === 'warning' ? '#e0a34a' : '#7fd4e4'

  return (
    <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
      <Text style={styles.h1}>Cihazım</Text>

      <View style={styles.deviceCard}>
        <View style={styles.deviceImgWrap}>
          <Image
            source={require('../../assets/device.png')}
            style={styles.deviceImg}
            resizeMode="contain"
          />
        </View>
        <View style={styles.infoBlock}>
          <InfoRow icon={<BadgeCheck size={16} color={colors.muted} />} label="Model" value={model.name} />
          <InfoRow icon={<FileText size={16} color={colors.muted} />} label="Seri numarası" value={serialNo} />
          <InfoRow
            icon={<Calendar size={16} color={colors.muted} />}
            label="Aktivasyon"
            value={formatDate(activationMs)}
          />
        </View>
      </View>

      <View style={styles.warranty}>
        <View style={styles.warrantyIcon}>
          <BadgeCheck size={20} color={colors.accentForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.warrantyTitle}>Dijital garanti · 3 yıl</Text>
          <Text style={styles.muted}>{formatDate(activationMs)} tarihinde başladı</Text>
        </View>
        <Pressable style={styles.downloadBtn} accessibilityLabel="Garanti belgesini indir">
          <Download size={16} color={colors.accent} />
        </Pressable>
      </View>

      <Text style={styles.section}>Filtre</Text>
      <View style={styles.filterCard}>
        <View style={styles.filterRow}>
          <Image
            source={require('../../assets/cartridge.png')}
            style={styles.cartridge}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.filterName}>{model.filterModel}</Text>
            <Text style={styles.muted}>Takılma: {formatDate(filterInstallMs)}</Text>
          </View>
          <Text style={[styles.pct, { color: toneColor }]}>%{Math.round(filter.percent)}</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${filter.percent}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={styles.muted}>
          {filter.remainingDays} gün · ~{formatNum(filter.remainingL)} L kaldı
          {filter.capacityBound ? ' (kapasite)' : ' (6 ay hijyen sınırı)'}
        </Text>
        <Pressable onPress={() => setFlow('scan')} style={styles.replaceBtn}>
          <RefreshCw size={16} color={colors.accent} />
          <Text style={styles.replaceText}>Filtre değiştirdim</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Servis</Text>
      <View style={styles.serviceList}>
        <ServiceRow icon={<Wrench size={20} color={colors.accent} />} label="Teknisyen randevusu al" last />
      </View>

      <Modal visible={flow !== 'idle'} transparent animationType="fade">
        <ReplaceFilterFlow
          stage={flow === 'idle' ? 'scan' : flow}
          onScanned={() => {
            replaceFilter()
            setFlow('done')
          }}
          onClose={() => setFlow('idle')}
        />
      </Modal>
    </ScrollView>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <View style={styles.infoRow}>
      {icon}
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function ServiceRow({
  icon,
  label,
  last,
}: {
  icon: ReactNode
  label: string
  last?: boolean
}) {
  return (
    <Pressable style={[styles.serviceRow, !last && styles.serviceBorder]}>
      {icon}
      <Text style={styles.serviceLabel}>{label}</Text>
      <ChevronRight size={16} color={colors.muted} />
    </Pressable>
  )
}

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      const t = setTimeout(onClose, 2200)
      return () => clearTimeout(t)
    }
  }, [stage, onScanned, onClose])

  return (
    <View style={styles.modalBg}>
      <View style={styles.modalCard}>
        {stage === 'scan' ? (
          <>
            <View style={styles.scanBox}>
              <ScanLine size={56} color={colors.muted} />
            </View>
            <Text style={styles.modalTitle}>Yeni kartuşu tarayın</Text>
            <Text style={styles.muted}>Orijinallik doğrulanıyor…</Text>
          </>
        ) : (
          <>
            <View style={styles.doneIcon}>
              <Check size={40} color={colors.accentForeground} />
            </View>
            <Text style={styles.modalTitle}>Filtreniz yenilendi</Text>
            <Text style={styles.muted}>Sayaç sıfırlandı. Temiz suyun tadını çıkarın.</Text>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  h1: { fontSize: 24, fontWeight: '600', color: colors.foreground },
  deviceCard: {
    marginTop: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  deviceImgWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: 'rgba(46,125,140,0.08)',
  },
  deviceImg: { height: 176, width: 160 },
  infoBlock: { padding: 20, gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoValue: { marginLeft: 'auto', fontSize: 14, fontWeight: '500', color: colors.foreground },
  warranty: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(200,161,90,0.4)',
    backgroundColor: 'rgba(200,161,90,0.1)',
    padding: 20,
  },
  warrantyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warrantyTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  downloadBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: 28,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  filterCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
  },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cartridge: { height: 64, width: 40 },
  filterName: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  pct: { fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  barTrack: {
    marginTop: 16,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999 },
  muted: { marginTop: 8, fontSize: 12, color: colors.muted },
  replaceBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
  },
  replaceText: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  serviceList: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  serviceBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  serviceLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.foreground },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(12,20,24,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 32,
    alignItems: 'center',
  },
  scanBox: {
    width: 160,
    height: 160,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneIcon: {
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    marginTop: 24,
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
  },
})
