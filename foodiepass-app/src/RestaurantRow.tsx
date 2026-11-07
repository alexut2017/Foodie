import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Restaurant } from './data';
import { districtName } from './data';
import { Logo } from './Logo';
import { C } from './theme';

// Status badges, same as the website: New, Founding partner, plus Popular for featured partners.
export function Badges({ r }: { r: Restaurant }) {
  const list: { t: string; bg: string; fg: string }[] = [];
  if (r.isNew) list.push({ t: '★ New', bg: C.errBg, fg: C.err });
  if (r.founding) list.push({ t: '★ Founding partner', bg: '#FBEBC4', fg: '#5E4205' });
  if (r.featured) list.push({ t: '♥ Popular', bg: C.okBg, fg: '#1F4D35' });
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

/** Card used on Explore; mirrors the website's restaurant finder card. */
export function RestaurantCard({ r, onPress, distance }: { r: Restaurant; onPress: () => void; distance?: string }) {
  const where = r.place || districtName(r.district);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${r.name}, ${r.offer}`} style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]}>
      {r.photo ? <Image source={{ uri: r.photo }} style={s.photo} accessibilityIgnoresInvertColors /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text style={s.name}>{r.name}</Text>
        <Badges r={r} />
      </View>
      <Text style={s.meta}>{[r.cuisine, where, distance].filter(Boolean).join('  ·  ')}</Text>
      {r.desc ? <Text style={s.desc} numberOfLines={2}>{r.desc}</Text> : null}
      <Text style={s.offer}>{r.offer}</Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {r.dineIn ? <Text style={s.svc}>Dine-in</Text> : null}
        {r.pickup ? <Text style={s.svc}>Pickup</Text> : null}
      </View>
      <View style={s.view}><Text style={{ color: C.linen, fontWeight: '700', fontSize: 15 }}>View restaurant</Text></View>
    </Pressable>
  );
}

/** Compact row (kept for lists that only need a quick pick). */
export function RestaurantRow({ r, onPress }: { r: Restaurant; onPress: () => void }) {
  const meta = [r.cuisine, r.place || districtName(r.district)].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${r.name}, ${r.offer}`} style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}>
      <Thumb r={r} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.name}>{r.name}</Text>
        <Text style={s.meta}>{meta}</Text>
        <Text style={s.offerPlain}>{r.offer}</Text>
        <Badges r={r} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderWidth: 1.5, borderColor: '#E9B9A5', borderRadius: 20, padding: 18, gap: 10 },
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: C.sand },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14 },
  name: { fontSize: 22, fontWeight: '800', color: C.bayou, letterSpacing: -0.4 },
  meta: { fontSize: 14, color: C.muted },
  desc: { fontSize: 16, lineHeight: 22, color: C.ink2 },
  offer: { alignSelf: 'flex-start', fontSize: 15, fontWeight: '700', color: C.bayou, backgroundColor: C.sand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, overflow: 'hidden' },
  offerPlain: { fontSize: 15, fontWeight: '700', color: C.bayou },
  svc: { fontSize: 13, fontWeight: '600', color: C.ink2, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  view: { alignSelf: 'flex-start', backgroundColor: C.bayou, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
});
