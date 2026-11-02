import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { districtName, findRestaurant } from '../../src/data';
import { useSession } from '../../src/session';
import { openVisit } from '../../src/visit';
import { Body, Button, Card, Eyebrow, H1, Small } from '../../src/ui';
import { C } from '../../src/theme';

export default function RestaurantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { paid } = useSession();
  const r = findRestaurant(id ?? '');
  if (!r) return <SafeAreaView style={s.wrap}><H1>Not found</H1><Button title="Back" kind="ghost" onPress={() => router.back()} /></SafeAreaView>;

  const directions = () => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(r.name + ' Houston TX')}`);
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.wrap}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={s.close}><Text style={{ fontSize: 22 }}>{'×'}</Text></Pressable>
        <Eyebrow>{r.cuisine} {'·'} {'$'.repeat(r.price)}</Eyebrow>
        <H1>{r.name}</H1>
        <Small>{districtName(r.district)}</Small>
        <Body>{r.desc}</Body>
        <Card>
          <Eyebrow>Member offer</Eyebrow>
          <Text style={s.offer}>{r.offer}</Text>
          <Small>Show your live pass before you pay. Alcohol excluded. Not combined with other offers.</Small>
        </Card>
        <View style={{ gap: 10 }}>
          {paid
            ? <Button title={'I’m here: open my pass'} onPress={() => { router.back(); openVisit(r.id); }} />
            : <Button title="Join to use this offer" onPress={() => { router.back(); router.push('/pass'); }} />}
          <Button title="Directions" kind="ghost" onPress={directions} />
        </View>
        <Small>Sample listing. Real partners, addresses and hours will be announced before launch.</Small>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 22, gap: 14 },
  close: { alignSelf: 'flex-end', width: 44, height: 44, borderRadius: 22, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center' },
  offer: { fontSize: 26, fontWeight: '800', color: C.bayou, letterSpacing: -0.4 },
});
