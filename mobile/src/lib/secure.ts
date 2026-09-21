import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const TOKEN_KEY = 'mukansa.token'

// SecureStore web'de yok (expo start --web); orada AsyncStorage'a düşülür.
const useSecure = Platform.OS !== 'web'

export async function getToken(): Promise<string | null> {
  try {
    return useSecure ? await SecureStore.getItemAsync(TOKEN_KEY) : await AsyncStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export async function setToken(token: string): Promise<void> {
  if (useSecure) await SecureStore.setItemAsync(TOKEN_KEY, token)
  else await AsyncStorage.setItem(TOKEN_KEY, token)
}

export async function clearToken(): Promise<void> {
  try {
    if (useSecure) await SecureStore.deleteItemAsync(TOKEN_KEY)
    else await AsyncStorage.removeItem(TOKEN_KEY)
  } catch {
    // silinemediyse bir sonraki açılışta 401 ile temizlenir
  }
}
