import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Restaurant } from './data';
import { districtName } from './data';
import { C } from './theme';

export function RestaurantRow({ r, onPress }: { r: Restaurant; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${r.name}, ${r.offer}`} style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={s.name}>{r.name}</Text>
          {r.isNew ? <Text style={[s.badge, { backgroundColor: C.errBg, color: C.err }]}>New</Text> : null}
          {r.founding ? <Text style={[s.badge, { backgroundColor: '#FBEBC4', color: '#5E4205' }]}>Founding</Text> : null}
        </View>
        <Text style={s.meta}>{r.cuisine} {'·'} {districtName(r.district)} {'·'} {'$'.repeat(r.price)}</Text>
        <Text style={s.offer}>{r.offer}</Text>
      </View>
      <Text style={s.chev}>{'›'}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16 },
  name: { fontSize: 19, fontWeight: '800', color: C.bayou, letterSpacing: -0.3 },
  badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  meta: { fontSize: 14, color: C.muted },
  offer: { fontSize: 15, fontWeight: '700', color: C.bayou },
  chev: { fontSize: 28, color: C.muted },
});
