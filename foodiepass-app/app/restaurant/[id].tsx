import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { districtName, useDirectory } from '../../src/data';
import { useSession } from '../../src/session';
import { Body, Button, Card, Eyebrow, H1, Small } from '../../src/ui';
import { C } from '../../src/theme';

export default function RestaurantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { paid } = useSession();
  const { restaurants, loading } = useDirectory();
  const r = restaurants.find((x) => x.id === id);
  if (!r) return <SafeAreaView style={s.wrap}><H1>{loading ? 'Loading…' : 'Not found'}</H1><Button title="Back" kind="ghost" onPress={() => router.back()} /></SafeAreaView>;

  const directions = () => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(r.address || r.name + ' Houston TX')}`);
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.wrap}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={s.close}><Text style={{ fontSize: 22 }}>{'×'}</Text></Pressable>
        <Eyebrow>{r.cuisine} {'·'} {'$'.repeat(r.price)}</Eyebrow>
        <H1>{r.name}</H1>
        <Small>{r.address || districtName(r.district)}</Small>
        <Body>{r.desc}</Body>
        {r.hours ? <Small>{r.hours}</Small> : null}
        <Card>
          <Eyebrow>Member offer</Eyebrow>
          <Text style={s.offer}>{r.offer}</Text>
          <Small>Show your live pass before you pay. Alcohol excluded. Not combined with other offers.</Small>
        </Card>
        <View style={{ gap: 10 }}>
          <Button title={paid ? 'Show my pass' : 'Join to use this offer'} onPress={() => { router.back(); router.push('/pass'); }} />
          <Button title="Directions" kind="ghost" onPress={directions} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 22, gap: 14 },
  close: { alignSelf: 'flex-end', width: 44, height: 44, borderRadius: 22, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center' },
  offer: { fontSize: 26, fontWeight: '800', color: C.bayou, letterSpacing: -0.4 },
});
