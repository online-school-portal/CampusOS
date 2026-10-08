import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const isWeb = Platform.OS === 'web';

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
      if (isWeb) {
            try {
                    return globalThis?.localStorage?.getItem(key) ?? null;
                          } catch {
                                  return null;
                                        }
                                            }
                                                return SecureStore.getItemAsync(key);
                                                  },
                                                    setItem: async (key: string, value: string) => {
                                                        if (isWeb) {
                                                              try {
                                                                      globalThis?.localStorage?.setItem(key, value);
                                                                            } catch {}
                                                                                  return;
                                                                                      }
                                                                                          return SecureStore.setItemAsync(key, value);
                                                                                            },
                                                                                              removeItem: async (key: string) => {
                                                                                                  if (isWeb) {
                                                                                                        try {
                                                                                                                globalThis?.localStorage?.removeItem(key);
                                                                                                                      } catch {}
                                                                                                                            return;
                                                                                                                                }
                                                                                                                                    return SecureStore.deleteItemAsync(key);
                                                                                                                                      },
                                                                                                                                      };

                                                                                                                                      export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
                                                                                                                                        auth: {
                                                                                                                                            storage: ExpoSecureStoreAdapter,
                                                                                                                                                autoRefreshToken: true,
                                                                                                                                                    persistSession: true,
                                                                                                                                                        detectSessionInUrl: false,
                                                                                                                                                          },
                                                                                                                                                          });