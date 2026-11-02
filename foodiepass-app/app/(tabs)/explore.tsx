import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { districtName, useDirectory } from '../../src/data';
import { useSession } from '../../src/session';
import { RestaurantRow } from '../../src/RestaurantRow';
import { Eyebrow, H1 } from '../../src/ui';
import { C } from '../../src/theme';

export default function Explore() {
  const { name } = useSession();
  const { districts, restaurants, loading, error } = useDirectory();
  const [q, setQ] = useState('');
  const [district, setDistrict] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);

  // Sort by distance only if the member already allowed location (we never re-prompt here).
  useEffect(() => {
    (async () => {
      const p = await Location.getForegroundPermissionsAsync();
      if (!p.granted) return;
      const pos = await Location.getLastKnownPositionAsync().catch(() => null);
      if (pos) setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    })();
  }, []);

  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = restaurants.filter((r) => (!district || r.district === district) && (!t || `${r.name} ${r.cuisine} ${districtName(r.district)}`.toLowerCase().includes(t)));
    if (here) {
      const d = (r: { lat: number; lng: number }) => (r.lat - here.lat) ** 2 + ((r.lng - here.lng) * Math.cos((r.lat * Math.PI) / 180)) ** 2;
      list = [...list].sort((a, b) => d(a) - d(b));
    } else list = [...list].sort((a, b) => Number(b.isNew) - Number(a.isNew) || Number(b.founding) - Number(a.founding));
    return list;
  }, [restaurants, q, district, here]);

  const first = name.split(' ')[0];
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={s.head}>
        <Eyebrow>{first ? `Hi, ${first}` : 'Houston'}</Eyebrow>
        <H1 style={{ fontSize: 30 }}>Where are we eating?</H1>
        <TextInput style={s.search} value={q} onChangeText={setQ} placeholder="Search restaurants or cuisines" placeholderTextColor="#9AA3A2" accessibilityLabel="Search restaurants" clearButtonMode="while-editing" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="All" on={!district} onPress={() => setDistrict(null)} />
          {districts.filter((d) => d.live).map((d) => <Chip key={d.id} label={d.name} on={district === d.id} onPress={() => setDistrict(district === d.id ? null : d.id)} />)}
        </ScrollView>
        <View style={s.seg}>
          {(['list', 'map'] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[s.segBtn, mode === m && s.segOn]} accessibilityRole="button" accessibilityState={{ selected: mode === m }}>
              <Text style={[s.segText, mode === m && { color: C.linen }]}>{m === 'list' ? 'List' : 'Map'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {mode === 'list' ? (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          renderItem={({ item }) => <RestaurantRow r={item} onPress={() => router.push(`/restaurant/${item.id}`)} />}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: C.muted, marginTop: 30 }}>{loading ? 'Loading restaurants…' : error ? 'We couldn’t load the restaurants. Check your connection and try again.' : restaurants.length ? 'No matches. Try another neighborhood or cuisine.' : 'Partners are being added now. Check back soon.'}</Text>}
        />
      ) : (
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: 29.745, longitude: -95.43, latitudeDelta: 0.22, longitudeDelta: 0.22 }}
          showsUserLocation={!!here}
        >
          {items.map((r) => (
            <Marker key={r.id} coordinate={{ latitude: r.lat, longitude: r.lng }} title={r.name} description={r.offer} pinColor={r.founding ? C.mustard : C.chili} onCalloutPress={() => router.push(`/restaurant/${r.id}`)} />
          ))}
        </MapView>
      )}
    </SafeAreaView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[s.chipText, on && { color: C.linen }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  search: { minHeight: 50, borderWidth: 2, borderColor: C.bayou, borderRadius: 999, paddingHorizontal: 18, fontSize: 17, backgroundColor: C.card, color: C.bayou },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card },
  chipOn: { backgroundColor: C.bayou, borderColor: C.bayou },
  chipText: { fontWeight: '600', color: C.bayou },
  seg: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: C.sand, borderRadius: 999, padding: 4, gap: 4 },
  segBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  segOn: { backgroundColor: C.bayou },
  segText: { fontWeight: '700', color: C.ink2 },
});
