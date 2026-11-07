import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { districtName, useDirectory } from '../../src/data';
import { useSession } from '../../src/session';
import { openVisit } from '../../src/visit';
import { Badges } from '../../src/RestaurantRow';
import { Body, Button, Card, Eyebrow, H1, Small } from '../../src/ui';
import { C } from '../../src/theme';

export default function RestaurantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { paid } = useSession();
  const { restaurants, loading } = useDirectory();
  const r = restaurants.find((x) => x.id === id);
  if (!r) return <SafeAreaView style={s.wrap}><H1>{loading ? 'Loading…' : 'Not found'}</H1><Button title="Back" kind="ghost" onPress={() => router.back()} /></SafeAreaView>;

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(r.address || r.name + ' Houston TX')}`;
  const open = (u: string) => Linking.openURL(u).catch(() => undefined);
  const iAmHere = async () => { router.back(); await openVisit(r); };
  const activate = () => { router.back(); router.push('/pass'); };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.wrap}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={s.close}><Text style={{ fontSize: 22, color: C.bayou }}>{'×'}</Text></Pressable>
        {r.photo ? <Image source={{ uri: r.photo }} style={s.hero} accessibilityLabel={r.name} /> : null}
        <Eyebrow>{[r.cuisine, '$'.repeat(r.price)].filter(Boolean).join(' · ')}</Eyebrow>
        <H1>{r.name}</H1>
        <Badges r={r} />
        {districtName(r.district) ? <Small>{districtName(r.district)}</Small> : null}
        {r.desc ? <Body>{r.desc}</Body> : null}
        <Card>
          <Eyebrow>Member offer</Eyebrow>
          <Text style={s.offer}>{r.offer}</Text>
          <Small>Show your live pass before you pay. Alcohol, tax and tip excluded. Not combined with other offers.</Small>
        </Card>
        {paid
          ? <Button title="I’m here: show my pass" onPress={iAmHere} />
          : <Button title="Activate my pass" onPress={activate} />}
        {r.address || r.hours || r.phone || r.website ? (
          <Card>
            {r.address ? <Info k="Address" v={r.address} onPress={() => open(mapsUrl)} /> : null}
            {r.hours ? <Info k="Hours" v={r.hours} /> : null}
            {r.phone ? <Info k="Phone" v={r.phone} onPress={() => open('tel:' + r.phone!.replace(/[^\d+]/g, ''))} /> : null}
            {r.website ? <Info k="Website" v={r.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} onPress={() => open(r.website!)} /> : null}
          </Card>
        ) : null}
        <Button title="Directions" kind="ghost" onPress={() => open(mapsUrl)} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ k, v, onPress }: { k: string; v: string; onPress?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Small>{k}</Small>
      <Text onPress={onPress} accessibilityRole={onPress ? 'link' : undefined} style={{ flexShrink: 1, textAlign: 'right', fontSize: 16, fontWeight: '600', color: onPress ? C.brick : C.bayou }}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 22, gap: 14, paddingBottom: 40 },
  close: { alignSelf: 'flex-end', width: 44, height: 44, borderRadius: 22, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center' },
  hero: { width: '100%', aspectRatio: 16 / 10, borderRadius: 20, backgroundColor: C.sand },
  offer: { fontSize: 26, fontWeight: '800', color: C.bayou, letterSpacing: -0.4 },
});
