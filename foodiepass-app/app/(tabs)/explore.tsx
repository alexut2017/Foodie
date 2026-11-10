import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useDirectory, type Restaurant } from '../../src/data';
import { RestaurantCard } from '../../src/RestaurantRow';
import { Logo } from '../../src/Logo';
import { Button, Eyebrow, H1, Small } from '../../src/ui';
import { C } from '../../src/theme';

// Same finder as the website's Restaurants page: search, location, filters, a map, then the results.
type Show = 'all' | 'new' | 'popular';
type Sort = 'new' | 'az' | 'near';
type Here = { lat: number; lng: number };

const HOUSTON = { latitude: 29.745, longitude: -95.43, latitudeDelta: 0.22, longitudeDelta: 0.22 };
const miles = (a: Here, r: Restaurant) => {
  if (r.lat == null || r.lng == null) return Infinity;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(r.lat - a.lat), dLng = toRad(r.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(r.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
};

export default function Explore() {
  const { restaurants, loading, error, reload } = useDirectory();
  const [q, setQ] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('new');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [here, setHere] = useState<Here | null>(null);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const map = useRef<MapView>(null);

  // Use location quietly if the member already allowed it during sign-up (never re-prompt here).
  useEffect(() => {
    (async () => {
      const p = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!p?.granted) return;
      const pos = await Location.getLastKnownPositionAsync().catch(() => null);
      if (pos) setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    })();
  }, []);

  async function locateMe() {
    setLocMsg(null);
    const p = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (!p?.granted) { setLocMsg('Location is off for LocalScout. Turn it on in Settings to sort by distance.'); return; }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
    if (!pos) { setLocMsg('We couldn’t find your location. Try again in a moment.'); return; }
    setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    setSort('near');
  }

  const cuisines = useMemo(() => [...new Set(restaurants.map((r) => r.cuisine).filter(Boolean))].sort(), [restaurants]);

  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = restaurants.filter((r) =>
      (show === 'all' || (show === 'new' ? r.isNew : r.featured)) &&
      (!cuisine || r.cuisine === cuisine) &&
      (!t || `${r.name} ${r.cuisine} ${r.desc} ${r.offer} ${r.place}`.toLowerCase().includes(t)));
    const listed = (r: Restaurant) => (r.isNew ? 1 : 0);
    if (sort === 'near' && here) return [...list].sort((a, b) => miles(here, a) - miles(here, b));
    if (sort === 'az') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return [...list].sort((a, b) => listed(b) - listed(a) || Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
  }, [restaurants, q, show, cuisine, sort, here]);

  // Keep every shown restaurant (and you, if known) in view.
  useEffect(() => {
    const pts = items.filter((r) => r.lat != null && r.lng != null).map((r) => ({ latitude: r.lat!, longitude: r.lng! }));
    if (here) pts.push({ latitude: here.lat, longitude: here.lng });
    if (!pts.length) return;
    const t = setTimeout(() => {
      if (pts.length === 1) map.current?.animateToRegion({ ...pts[0], latitudeDelta: 0.05, longitudeDelta: 0.05 }, 300);
      else map.current?.fitToCoordinates(pts, { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
    }, 250);
    return () => clearTimeout(t);
  }, [items, here]);

  const filtered = show !== 'all' || !!cuisine || !!q.trim() || sort !== 'new';
  const clear = () => { setShow('all'); setCuisine(null); setSort('new'); setQ(''); };
  const open = (id: string) => router.push(`/restaurant/${id}`);

  const header = (
    <View style={{ gap: 14 }}>
      <View style={s.hero}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Logo size={28} /><Eyebrow style={{ color: C.mustard }}>Partner restaurants</Eyebrow></View>
        <H1 style={{ fontSize: 28, lineHeight: 32, color: C.linen }}>Find a LocalScout restaurant</H1>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput style={s.search} value={q} onChangeText={setQ} placeholder="Search by name or cuisine" placeholderTextColor="#7E8B89" accessibilityLabel="Search restaurants" returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} clearButtonMode="while-editing" />
          <Pressable style={s.searchBtn} onPress={() => Keyboard.dismiss()} accessibilityRole="button"><Text style={{ fontWeight: '800', color: C.bayou }}>Search</Text></Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={s.ghost} onPress={locateMe} accessibilityRole="button"><Text style={s.ghostText}>{here ? '◉ Near me' : '◎ Use my location'}</Text></Pressable>
          <Pressable style={[s.ghost, filtersOpen && { backgroundColor: C.linen }]} onPress={() => setFiltersOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }}>
            <Text style={[s.ghostText, filtersOpen && { color: C.bayou }]}>Filters{filtered ? ' •' : ''}</Text>
          </Pressable>
        </View>
        {locMsg ? <Small style={{ color: C.mint }}>{locMsg}</Small> : null}
        {filtersOpen ? (
          <View style={s.panel}>
            <Text style={s.label}>SHOW</Text>
            <Seg options={[['all', 'All'], ['new', 'New'], ['popular', 'Popular']]} value={show} onChange={(v) => setShow(v as Show)} />
            <Text style={s.label}>CUISINE</Text>
            <View style={s.chips}>
              <Chip label="All cuisines" on={!cuisine} onPress={() => setCuisine(null)} />
              {cuisines.map((c) => <Chip key={c} label={c} on={cuisine === c} onPress={() => setCuisine(cuisine === c ? null : c)} />)}
            </View>
            <Text style={s.label}>SORT BY</Text>
            <Seg options={[['new', 'New first'], ['az', 'A–Z'], ['near', here ? 'Nearest' : 'Nearest ◎']]} value={sort} onChange={(v) => { if (v === 'near' && !here) locateMe(); else setSort(v as Sort); }} />
            <Button title="Clear filters" kind="ghost" onPress={clear} style={{ minHeight: 44 }} />
          </View>
        ) : null}
      </View>

      <View style={s.mapWrap}>
        <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={HOUSTON} showsUserLocation={!!here} toolbarEnabled={false}>
          {items.filter((r) => r.lat != null && r.lng != null).map((r) => (
            <Marker key={r.id} coordinate={{ latitude: r.lat!, longitude: r.lng! }} title={r.name} description={r.offer} pinColor={C.chili} onCalloutPress={() => open(r.id)} />
          ))}
        </MapView>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: C.bayou }}><Text style={{ fontWeight: '800' }}>{items.length}</Text> restaurant{items.length === 1 ? '' : 's'} {sort === 'near' && here ? 'near you' : 'found'}</Text>
        {filtered ? <Pressable onPress={clear} hitSlop={8}><Text style={{ color: C.brick, fontWeight: '700' }}>Reset filters</Text></Pressable> : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.linen }} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <RestaurantCard r={item} onPress={() => open(item.id)} distance={here && sort === 'near' && miles(here, item) < Infinity ? `${miles(here, item).toFixed(1)} mi` : undefined} />
        )}
        ListEmptyComponent={
          <View style={{ gap: 12, marginTop: 8 }}>
            <Text style={{ textAlign: 'center', color: C.muted, fontSize: 16 }}>
              {loading ? 'Loading restaurants…' : error ? 'We couldn’t load the restaurants. Check your connection and try again.' : restaurants.length ? 'No restaurants match these filters.' : 'Partners are being added now. Check back soon.'}
            </Text>
            {error ? <Button title="Try again" kind="ghost" onPress={reload} /> : filtered && restaurants.length ? <Button title="Clear filters" kind="ghost" onPress={clear} /> : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

function Seg({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.seg}>
      {options.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={[s.segBtn, value === v && s.segOn]} accessibilityRole="button" accessibilityState={{ selected: value === v }}>
          <Text style={[s.segText, value === v && { color: C.linen }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
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
  hero: { backgroundColor: C.bayou, borderRadius: 22, padding: 18, gap: 12 },
  search: { flex: 1, minHeight: 50, borderRadius: 999, paddingHorizontal: 18, fontSize: 16, backgroundColor: C.card, color: C.bayou },
  searchBtn: { minHeight: 50, borderRadius: 999, paddingHorizontal: 18, backgroundColor: C.chili, alignItems: 'center', justifyContent: 'center' },
  ghost: { minHeight: 44, borderRadius: 999, paddingHorizontal: 16, borderWidth: 1.5, borderColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  ghostText: { color: C.linen, fontWeight: '700', fontSize: 15 },
  panel: { backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 10 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: C.brick },
  seg: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: C.sand, borderRadius: 999, padding: 4, gap: 4, flexWrap: 'wrap' },
  segBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  segOn: { backgroundColor: C.bayou },
  segText: { fontWeight: '700', color: C.ink2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card },
  chipOn: { backgroundColor: C.bayou, borderColor: C.bayou },
  chipText: { fontWeight: '600', color: C.bayou },
  mapWrap: { height: 260, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.line, backgroundColor: C.sand },
});
