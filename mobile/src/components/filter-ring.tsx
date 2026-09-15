import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg'
import type { RingTone } from '../lib/calc'

const TONE_COLOR: Record<RingTone, { main: string; soft: string }> = {
  ok: { main: '#7fd4e4', soft: '#2e7d8c' },
  warning: { main: '#e0a34a', soft: '#a9702a' },
  danger: { main: '#e05a4a', soft: '#a33328' },
}

export function FilterRing({
  percent,
  tone,
  remainingDays,
  size = 260,
  onPress,
}: {
  percent: number
  tone: RingTone
  remainingDays: number
  size?: number
  onPress?: () => void
}) {
  const c = size / 2
  const arcR = c - 8
  const circ = 2 * Math.PI * arcR
  const offset = circ * (1 - percent / 100)
  const color = TONE_COLOR[tone]
  const waterR = c - 30
  const waterTop = c - waterR
  const level = c + waterR - (percent / 100) * (2 * waterR)
  const clampedLevel = Math.max(waterTop, Math.min(c + waterR, level))
  const translateY = clampedLevel - waterTop

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Filtre ömrü yüzde ${Math.round(percent)}, ${remainingDays} gün kaldı`}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color.main} stopOpacity="0.9" />
            <Stop offset="100%" stopColor={color.soft} stopOpacity="0.95" />
          </LinearGradient>
          <ClipPath id="waterClip">
            <Circle cx={c} cy={c} r={waterR} />
          </ClipPath>
        </Defs>
        <Circle cx={c} cy={c} r={waterR} fill="#0a1519" />
        <G clipPath="url(#waterClip)">
          <G transform={`translate(0, ${translateY})`}>
            <WaveBody cx={c} width={size} top={waterTop} bottom={size} />
          </G>
        </G>
        <Circle cx={c} cy={c} r={arcR} fill="none" stroke="#24363f" strokeWidth={6} />
        <Circle
          cx={c}
          cy={c}
          r={arcR}
          fill="none"
          stroke={color.main}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          rotation={-90}
          origin={`${c}, ${c}`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.days}>{remainingDays}</Text>
        <Text style={styles.daysLabel}>gün kaldı</Text>
        <View style={[styles.badge, { backgroundColor: `${color.main}1a` }]}>
          <Text style={[styles.badgeText, { color: color.main }]}>
            %{Math.round(percent)} ömür
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

function WaveBody({
  cx,
  width,
  top,
  bottom,
}: {
  cx: number
  width: number
  top: number
  bottom: number
}) {
  const amp = 6
  const w = width
  const d = `
    M ${-w} ${top}
    q ${w / 4} ${-amp} ${w / 2} 0
    t ${w / 2} 0
    t ${w / 2} 0
    t ${w / 2} 0
    t ${w / 2} 0
    t ${w / 2} 0
    L ${cx + w * 1.5} ${bottom}
    L ${-w} ${bottom}
    Z
  `
  return <Path d={d} fill="url(#waterGrad)" />
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  days: {
    fontSize: 48,
    fontWeight: '600',
    color: '#f2f4f5',
    fontVariant: ['tabular-nums'],
  },
  daysLabel: {
    marginTop: 4,
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#8ba0a8',
  },
  badge: {
    marginTop: 12,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
})
