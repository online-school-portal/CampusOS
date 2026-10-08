import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
      PlusJakartaSans_400Regular,
          PlusJakartaSans_600SemiBold,
              PlusJakartaSans_700Bold,
                  SpaceGrotesk_500Medium,
                      SpaceGrotesk_700Bold,
                        });

                          useEffect(() => {
                              if (fontsLoaded) {
                                    SplashScreen.hideAsync();
                                        }
                                          }, [fontsLoaded]);

                                            if (!fontsLoaded) return null;

                                              return (
                                                  <GestureHandlerRootView style={{ flex: 1 }}>
                                                        <Stack screenOptions={{ headerShown: false }}>
                                                                <Stack.Screen name="(auth)" />
                                                                        <Stack.Screen name="(app)" />
                                                                              </Stack>
                                                                                  </GestureHandlerRootView>
                                                                                    );
                                                                                    }