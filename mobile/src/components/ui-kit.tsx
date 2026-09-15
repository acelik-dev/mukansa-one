import type { ReactNode } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { colors } from '../theme'

export function PrimaryButton({
  children,
  style,
  disabled,
  ...props
}: PressableProps & { children: ReactNode }) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style as StyleProp<ViewStyle>,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={styles.primaryText}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

export function GhostButton({
  children,
  style,
  ...props
}: PressableProps & { children: ReactNode }) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.ghost,
        pressed && styles.pressed,
        style as StyleProp<ViewStyle>,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={styles.ghostText}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

export function SelectCard({
  selected,
  onPress,
  children,
  style,
}: {
  selected: boolean
  onPress: () => void
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.select,
        selected ? styles.selectOn : styles.selectOff,
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  )
}

export function Card({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>
}

const styles = StyleSheet.create({
  primary: {
    height: 56,
    width: '100%',
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accentForeground,
  },
  ghost: {
    height: 48,
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
  },
  ghostText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  selectOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(200,161,90,0.1)',
  },
  selectOff: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 20,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
})
