import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Restaurant } from './data';
import { districtName } from './data';
import { Logo } from './Logo';
import { C } from './theme';

export function Badges({ r }: { r: Restaurant }) {
  const list: { t: string; bg: string; fg: string }[] = [];
  if (r.featured) list.push({ t: 'Featured', bg: C.chili, fg: C.bayou });
  if (r.isNew) list.push({ t: 'New', bg: C.mustard, fg: C.bayou });
  if (r.founding) list.push({ t: 'Founding partner', bg: C.bayou, fg: C.linen });
  if (r.dineIn) list.push({ t: 'Dine-in', bg: C.sand, fg: C.ink2 });
  if (r.pickup) list.push({ t: 'Pickup', bg: C.sand, fg: C.ink2 });
  if (!list.length) return null;
  return (
    <View style={s.badges}>
      {list.map((b) => <Text key={b.t} style={[s.badge, { backgroundColor: b.bg, color: b.fg }]}>{b.t}</Text>)}
    </View>
  );
}

export function Thumb({ r, size = 64 }: { r: Restaurant; size?: number }) {
  if (r.photo) return <Image source={{ uri: r.photo }} style={{ width: size, height: size, borderRadius: 14, backgroundColor: C.sand }} accessibilityIgnoresInvertColors />;
  return <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center' }}><Logo size={size * 0.56} /></View>;
}

export function RestaurantRow({ r, onPress }: { r: Restaurant; onPress: () => void }) {
  const meta = [r.cuisine, districtName(r.district), '$'.repeat(r.price)].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${r.name}, ${r.offer}`} style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}>
      <Thumb r={r} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.name}>{r.name}</Text>
        <Text style={s.meta}>{meta}</Text>
        <Text style={s.offer}>{r.offer}</Text>
        <Badges r={r} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14 },
  name: { fontSize: 19, fontWeight: '800', color: C.bayou, letterSpacing: -0.3 },
  meta: { fontSize: 14, color: C.muted },
  offer: { fontSize: 15, fontWeight: '700', color: C.bayou },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
});
