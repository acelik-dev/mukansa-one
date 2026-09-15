import { AppShell } from '@/components/app-shell'
import { AppProvider } from '@/lib/store'

export default function Page() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
