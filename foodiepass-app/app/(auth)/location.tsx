import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useSession } from '../../src/session';
import { Body, Button, H1 } from '../../src/ui';
import { C } from '../../src/theme';

// Step 4: optional location, asked only now that it's useful (spec: request permissions when the feature needs them).
export default function LocationStep() {
  const { markOnboarded } = useSession();
  const [busy, setBusy] = useState(false);

  async function finish(ask: boolean) {
    setBusy(true);
    if (ask) { try { await Location.requestForegroundPermissionsAsync(); } catch { /* user can enable later in Settings */ } }
    await markOnboarded();
    router.replace('/explore');
  }

  return (
    <SafeAreaView style={s.wrap}>
      <View style={{ gap: 16, marginTop: 40 }}>
        <View style={s.pin}><Text style={{ fontSize: 38 }}>{'\u{1F4CD}'}</Text></View>
        <H1>Find great spots near you</H1>
        <Body>Allow location to sort partner restaurants by distance. We only use it while you have the app open.</Body>
      </View>
      <View style={{ gap: 12 }}>
        <Button title="Allow location" onPress={() => finish(true)} busy={busy} />
        <Button title="Not now" kind="ghost" onPress={() => finish(false)} disabled={busy} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'space-between' },
  pin: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center' },
});
