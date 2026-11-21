import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useAppStore } from '../src/store/useAppStore';
import { Colors } from '../src/constants/theme';

// Keep the native splash screen visible while loading resources
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { initialize } = useAppStore();
  const [appReady, setAppReady] = useState(false);

  const [fontsLoaded] = useFonts({
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
    'PlusJakartaSans-ExtraBold': PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    async function prepare() {
      try {
        await initialize();
      } catch (e) {
        console.warn('App initialization error:', e);
      } finally {
        setAppReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (fontsLoaded && appReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, appReady]);

  if (!fontsLoaded && !appReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="splash" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="farm/register" options={{ presentation: 'card' }} />
        <Stack.Screen name="farm/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="season/create" options={{ presentation: 'card' }} />
        <Stack.Screen name="activity/record" options={{ presentation: 'card' }} />
        <Stack.Screen name="harvest/register" options={{ presentation: 'card' }} />
        <Stack.Screen name="harvest/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="inputs-expenses" options={{ presentation: 'card' }} />
        <Stack.Screen name="sync-center" options={{ presentation: 'card' }} />
        <Stack.Screen name="qr-scanner" options={{ presentation: 'card' }} />
        <Stack.Screen name="traceability/[token]" options={{ presentation: 'card' }} />
        <Stack.Screen name="inspector/index" options={{ presentation: 'card' }} />
        <Stack.Screen name="inspector/inspect/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="extension/index" options={{ presentation: 'card' }} />
        <Stack.Screen name="extension/visit" options={{ presentation: 'card' }} />
        <Stack.Screen name="reports/index" options={{ presentation: 'card' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
