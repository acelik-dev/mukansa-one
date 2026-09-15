'use client'

import type { ReactNode } from 'react'

/**
 * Simüle edilmiş telefon çerçevesi. Uygulama mobil-öncelikli tasarlandığı için
 * masaüstünde de sabit genişlikte bir cihaz içinde gösterilir.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[#080f12] p-0 sm:p-6">
      <div className="relative flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-background sm:h-[900px] sm:max-h-[92dvh] sm:rounded-[2.75rem] sm:border sm:border-[#24363f] sm:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)]">
        {children}
      </div>
    </div>
  )
}
