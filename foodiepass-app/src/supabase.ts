import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';

// Session storage: SecureStore (Keychain / Keystore) holds a small key; large values fall back to AsyncStorage.
// Supabase sessions can exceed SecureStore's ~2 KB limit, so we store the session in AsyncStorage and keep
// only short items in SecureStore.
const storage = {
  async getItem(key: string) {
    const v = await SecureStore.getItemAsync(key).catch(() => null);
    return v ?? AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (value.length < 1800) {
      await SecureStore.setItemAsync(key, value).catch(() => AsyncStorage.setItem(key, value));
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, value);
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
    }
  },
  async removeItem(key: string) {
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
  auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Refresh tokens only while the app is in the foreground (Supabase's recommended setup for React Native).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
