import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';
import {AppState} from 'react-native';

// Baked in at bundle time; restart Expo with `npx expo start -c` after editing .env.
// Falls back to placeholders so importing this file never throws (Jest imports
// services without a .env). Real calls fail with a network error if unset.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'missing-anon-key';

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh tokens while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});