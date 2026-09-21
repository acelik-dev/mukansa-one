import Constants from 'expo-constants'

const PROD_API_URL = 'https://mukansa-one-api.onixmedya.com.tr'
const DEV_API_PORT = 3035

/**
 * Öncelik: EXPO_PUBLIC_API_URL → dev'de Metro'nun çalıştığı makine (fiziksel telefon LAN'dan bağlanır) → prod.
 */
export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  if (__DEV__) {
    const host = Constants.expoConfig?.hostUri?.split(':')[0]
    return `http://${host ?? 'localhost'}:${DEV_API_PORT}`
  }
  return PROD_API_URL
}
