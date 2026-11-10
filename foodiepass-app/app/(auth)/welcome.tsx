import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Small } from '../../src/ui';
import { C } from '../../src/theme';
import { Logo } from '../../src/Logo';

// Step 0: brand welcome. Like inKind, one button starts sign-up; returning members sign in the same way.
export default function Welcome() {
  return (
    <SafeAreaView style={s.wrap}>
      <View style={s.top}>
        <Logo size={72} />
        <Text style={s.brand}>Local<Text style={{ color: C.chili }}>Scout</Text></Text>
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
  brand: { color: C.linen, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h1: { color: C.linen, fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1 },
  lede: { color: C.mint, fontSize: 19, lineHeight: 26 },
});
