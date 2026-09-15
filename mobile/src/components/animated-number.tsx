import { useEffect, useRef, useState } from 'react'
import { Text, type StyleProp, type TextStyle } from 'react-native'

export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toString(),
  duration = 1200,
  style,
  live = false,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
  style?: StyleProp<TextStyle>
  live?: boolean
}) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    fromRef.current = display
    startRef.current = null
    const d = live ? 800 : duration

    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t
      const elapsed = t - startRef.current
      const p = Math.min(1, elapsed / d)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(fromRef.current + (value - fromRef.current) * eased)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return <Text style={[{ fontVariant: ['tabular-nums'] }, style]}>{format(display)}</Text>
}
