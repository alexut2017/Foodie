import React from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { siteLink } from '../../src/config';
import { PartnerForm } from '../../src/PartnerForm';
import { Body, Button, Card, Eyebrow, Small } from '../../src/ui';
import { C } from '../../src/theme';

// For Restaurants: same content as the website's For Restaurants page (joinlocalscout.com/#partners).
export default function Partners() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <View style={s.hero}>
            <Eyebrow style={{ color: C.mustard }}>For restaurant owners</Eyebrow>
            <Text style={s.h1}>Join for free. <Text style={{ color: C.mustard }}>Grow your brand.</Text></Text>
            <Text style={s.lede}>No fees, no commissions, no new hardware. You choose the offer and the days it runs.</Text>
          </View>
          <Card>
            <Eyebrow>What we ask</Eyebrow>
            <Text style={s.h}>Two things. We do the rest.</Text>
            <Body style={{ fontSize: 16 }}>1. Honor your offer for any member with a live pass.</Body>
            <Body style={{ fontSize: 16 }}>2. Brief your staff on how LocalScout works. Our one-page staff guide covers it.</Body>
            <Small>No passwords to keep track of. We set up your listing; then your owner page shows member visits each week and lets you update your offer, hours, photo and staff PIN. You sign in with a code we email you.</Small>
            <Small><Text style={{ fontWeight: '700' }}>Founding partners</Text> get top placement on the map for 12 months.</Small>
          </Card>
          <Card>
            <Text style={s.h}>Already a partner?</Text>
            <Button title="Open my owner page" onPress={() => Linking.openURL(siteLink('owner'))} />
            <Button title="Staff guide: How to accept a pass" kind="ghost" onPress={() => Linking.openURL(siteLink('staff-guide'))} />
          </Card>
          <PartnerForm startOpen />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, gap: 14, paddingBottom: 40 },
  hero: { backgroundColor: C.bayou, borderRadius: 22, padding: 20, gap: 10 },
  h1: { color: C.linen, fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  lede: { color: C.mint, fontSize: 17, lineHeight: 24 },
  h: { fontSize: 20, fontWeight: '800', color: C.bayou },
});
