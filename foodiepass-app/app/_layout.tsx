import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../src/session';
import { C } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.linen } }}>
          <Stack.Screen name="restaurant/[id]" options={{ presentation: 'modal' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
