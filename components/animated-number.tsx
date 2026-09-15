'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
  /** Değerin kaynağı canlı akan bir sayaçsa true — her tick'te yeni değere yumuşak takip eder */
  live?: boolean
}

/**
 * Sayısal değerler asla anında değişmez; daima sayarak akar (§5.4).
 * Tabular rakamlarla titremesiz.
 */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toString(),
  duration = 1200,
  className,
  live = false,
}: Props) {
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
      // ease-out cubic
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

  return <span className={`tabular ${className ?? ''}`}>{format(display)}</span>
}
