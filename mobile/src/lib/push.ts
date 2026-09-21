import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

// expo-notifications tembel yüklenir: Expo Go (Android) gibi push'un desteklenmediği ortamlarda
// uygulama açılışını bozmasın. Buradaki hiçbir fonksiyon hata fırlatmaz.
type NotificationsModule = typeof import('expo-notifications')
let cached: NotificationsModule | null | undefined

async function notifications(): Promise<NotificationsModule | null> {
  if (cached !== undefined) return cached
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return (cached = null)
    // Android Expo Go SDK 53'ten beri uzaktan bildirimi desteklemiyor (development build gerekir)
    if (Platform.OS === 'android' && Constants.appOwnership === 'expo') return (cached = null)
    const mod = await import('expo-notifications')
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    })
    if (Platform.OS === 'android') {
      await mod.setNotificationChannelAsync('default', {
        name: 'Genel',
        importance: mod.AndroidImportance.DEFAULT,
      })
    }
    cached = mod
  } catch {
    cached = null
  }
  return cached
}

export interface PushRegistration {
  expoToken: string
  platform: 'ios' | 'android'
}

/**
 * İzin durumuna göre Expo push token'ı döndürür.
 * @param prompt true ise izin henüz verilmemişse sistem izin penceresini açar.
 */
export async function getPushRegistration(prompt: boolean): Promise<PushRegistration | null> {
  try {
    const N = await notifications()
    if (!N) return null
    let perm = await N.getPermissionsAsync()
    if (!perm.granted && prompt && perm.canAskAgain) perm = await N.requestPermissionsAsync()
    if (!perm.granted) return null

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    if (!projectId) {
      if (__DEV__) console.log('[push] EAS projectId yok (app.json extra.eas.projectId) — token alınamadı')
      return null
    }
    const { data } = await N.getExpoPushTokenAsync({ projectId })
    return { expoToken: data, platform: Platform.OS === 'ios' ? 'ios' : 'android' }
  } catch (err) {
    if (__DEV__) console.log('[push] token alınamadı', err)
    return null
  }
}

/** Bildirime dokunulunca data.screen ile çağrılır. Dönen fonksiyon aboneliği kaldırır. */
export function subscribeToTaps(onScreen: (screen: string) => void): () => void {
  let sub: { remove: () => void } | undefined
  let cancelled = false
  void notifications().then((N) => {
    if (!N || cancelled) return
    sub = N.addNotificationResponseReceivedListener((event) => {
      const screen = event.notification.request.content.data?.screen
      if (typeof screen === 'string') onScreen(screen)
    })
  })
  return () => {
    cancelled = true
    sub?.remove()
  }
}
