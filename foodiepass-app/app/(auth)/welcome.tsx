import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Small } from '../../src/ui';
import { C } from '../../src/theme';

// Step 0: brand welcome. Like inKind, one button starts phone sign-up for new and returning members alike.
export default function Welcome() {
  return (
    <SafeAreaView style={s.wrap}>
      <View style={s.top}>
        <View style={s.mark}><Text style={s.markFork}>{'\u{1F374}'}</Text></View>
        <Text style={s.brand}>Foodie<Text style={{ color: C.mustard }}>Pass</Text></Text>
        <Text style={s.h1}>One $30 pass.{'\n'}<Text style={{ color: C.mustard }}>Every great local table in Houston.</Text></Text>
        <Text style={s.lede}>Show your pass, save on the check. Pays for itself in about five dinners.</Text>
      </View>
      <View style={{ gap: 12 }}>
        <Button title="Get started" onPress={() => router.push('/phone')} />
        <Button title="I already have an account" kind="ghostLight" onPress={() => router.push({ pathname: '/phone', params: { mode: 'signin' } })} />
        <Small style={{ color: C.mint, textAlign: 'center' }}>Restaurants join free. Members pay $30 a year.</Small>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bayou, padding: 24, justifyContent: 'space-between' },
  top: { gap: 18, marginTop: 40 },
  mark: { width: 64, height: 64, borderRadius: 18, backgroundColor: C.chili, alignItems: 'center', justifyContent: 'center' },
  markFork: { fontSize: 30 },
  brand: { color: C.linen, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h1: { color: C.linen, fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1 },
  lede: { color: C.mint, fontSize: 19, lineHeight: 26 },
});
