'use client'

import { useEffect, useRef, useState } from 'react'
import { formatTL } from '@/lib/calc'

/**
 * Kümülatif tasarruf sayacı: açılışta 0'dan tabana yumuşak sayar, ardından
 * tahmini tüketimle orantılı olarak canlı akmaya devam eder (§4.2, §5.4).
 */
export function LiveSavings({
  base,
  dailyRate,
  className,
}: {
  base: number
  dailyRate: number
  className?: string
}) {
  const [value, setValue] = useState(0)
  const mountRef = useRef<number | null>(null)
  const perSecond = dailyRate / 86400

  useEffect(() => {
    let raf = 0
    const introMs = 1600
    const tick = (t: number) => {
      if (mountRef.current === null) mountRef.current = t
      const elapsed = t - mountRef.current
      const introP = Math.min(1, elapsed / introMs)
      const eased = 1 - Math.pow(1 - introP, 3)
      const liveExtra = perSecond * (elapsed / 1000)
      setValue(base * eased + (introP >= 1 ? liveExtra : 0))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, dailyRate])

  return <span className={`tabular ${className ?? ''}`}>{formatTL(value)}</span>
}
