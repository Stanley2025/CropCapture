import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppStore } from '../src/store/useAppStore';
import { Colors } from '../src/constants/theme';

export default function RootLayout() {
  const { initialize, isInitialized } = useAppStore();

  useEffect(() => {
    initialize();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={Colors.primaryDark} />
      <Stack
        initialRouteName="splash"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="splash" options={{ headerShown: false }} />
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
