import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { findRestaurant, districtName } from '../src/data';
import { useSession } from '../src/session';
import { confirmVisit, isExpired, loadVisit, msLeft, saveVisit, openVisit, type Visit } from '../src/visit';
import { Button, Eyebrow, H1, Small } from '../src/ui';
import { fmtDate } from '../src/format';
import { C } from '../src/theme';

const KNOB = 56;

// The member pass for one restaurant: live clock + countdown, closed by a staff swipe.
export default function VisitScreen() {
  const { name, paid, status } = useSession();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { loadVisit().then(setVisit); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Only paid members can see a pass.
  if (!paid) {
    return (
      <SafeAreaView style={s.wrap}>
        <H1>Your pass unlocks with membership</H1>
        <Button title="Go to My pass" onPress={() => router.replace('/pass')} />
      </SafeAreaView>
    );
  }
  if (!visit) return <SafeAreaView style={s.wrap} />;
  const r = findRestaurant(visit.rid);
  if (!r) return null;

  const done = !!visit.confirmedAt;
  const expired = isExpired(visit);
  const left = Math.max(0, Math.ceil(msLeft(visit) / 1000));
  const close = async () => { await saveVisit(null); router.replace('/pass'); };

  return (
    <SafeAreaView style={s.wrap}>
      <View style={{ gap: 6 }}>
        <Eyebrow>Member pass {'·'} {districtName(r.district)}</Eyebrow>
        <H1>{r.name}</H1>
      </View>

      {done ? (
        <View style={[s.pass, { backgroundColor: C.okBg }]} accessibilityLiveRegion="polite">
          <View style={s.top}><Text style={[s.eyebrowSm, { color: '#1F4D35' }]}>CONFIRMED BY STAFF</Text><Text style={{ color: C.ok, fontWeight: '700' }}>{'✓'} Used</Text></View>
          <Text style={s.name}>{name}</Text>
          <Text style={s.offer}>Apply: {r.offer}</Text>
          <View style={s.row}>
            <View><Small>Confirmed at</Small><Text style={s.v}>{new Date(visit.confirmedAt!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text></View>
            <View style={{ alignItems: 'flex-end' }}><Small>Visit code</Small><Text style={s.v}>{visit.code}</Text></View>
          </View>
          <Small>This pass has been used for this visit. Enjoy your meal.</Small>
        </View>
      ) : expired ? (
        <View style={[s.pass, { gap: 12 }]}>
          <Text style={s.name}>This pass timed out</Text>
          <Small>A pass stays open for 15 minutes. Open it again when you{'’'}re ready to pay.</Small>
          <Button title="Open pass again" onPress={() => openVisit(r.id)} />
        </View>
      ) : (
        <View style={s.pass}>
          <View style={s.top}><Text style={s.eyebrowSm}>MEMBER PASS</Text><Text style={{ color: C.ok, fontWeight: '700' }}>{'●'} Live</Text></View>
          <Text style={s.name}>{name}</Text>
          <Text style={s.offer}>{r.offer}</Text>
          <Text style={s.clock} accessibilityLabel="Live clock">{new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</Text>
          <View style={s.row}>
            <View><Small>Member through</Small><Text style={s.v}>{fmtDate(status?.membership.access_until) || '—'}</Text></View>
            <View style={{ alignItems: 'flex-end' }}><Small>Pass closes in</Small><Text style={s.v}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</Text></View>
          </View>
          <Swipe onConfirm={async () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setVisit(await confirmVisit(visit)); }} />
          <Small>For restaurant staff. Swiping confirms the member showed this pass, and closes it.</Small>
        </View>
      )}

      <Button title={done ? 'Done' : 'Choose a different restaurant'} kind="ghost" onPress={close} />
    </SafeAreaView>
  );
}

function Swipe({ onConfirm }: { onConfirm: () => void }) {
  const x = useRef(new Animated.Value(0)).current;
  const max = useRef(0);
  const fired = useRef(false);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_e, g) => x.setValue(Math.max(0, Math.min(max.current, g.dx))),
    onPanResponderRelease: (_e, g) => {
      if (!fired.current && g.dx >= max.current * 0.85) {
        fired.current = true;
        Animated.timing(x, { toValue: max.current, duration: 120, useNativeDriver: true }).start(onConfirm);
      } else Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;
  const onLayout = (e: LayoutChangeEvent) => { max.current = e.nativeEvent.layout.width - KNOB - 12; };

  return (
    <View
      style={s.track}
      onLayout={onLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Staff: swipe to confirm this pass"
      accessibilityActions={[{ name: 'activate', label: 'Confirm pass' }]}
      onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'activate' && !fired.current) { fired.current = true; AccessibilityInfo.announceForAccessibility('Pass confirmed'); onConfirm(); } }}
    >
      <Text style={s.trackText}>Staff: swipe to confirm {'→'}</Text>
      <Animated.View {...pan.panHandlers} style={[s.knob, { transform: [{ translateX: x }] }]}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: C.bayou }}>{'→'}</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 18, backgroundColor: C.linen },
  pass: { backgroundColor: C.linen, borderRadius: 28, padding: 22, gap: 14, borderWidth: 1, borderColor: C.line, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrowSm: { fontSize: 13, fontWeight: '700', letterSpacing: 1.6, color: C.brick },
  name: { fontSize: 32, fontWeight: '800', color: C.bayou, letterSpacing: -0.5 },
  offer: { fontSize: 21, fontWeight: '700', color: C.bayou },
  clock: { fontSize: 42, fontWeight: '800', textAlign: 'center', color: C.bayou, backgroundColor: C.sand, borderRadius: 16, paddingVertical: 10, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderStyle: 'dashed', borderTopColor: '#D9D2C4', paddingTop: 14 },
  v: { fontSize: 19, fontWeight: '700', color: C.bayou, fontVariant: ['tabular-nums'] },
  track: { height: 68, borderRadius: 999, backgroundColor: C.bayou, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  trackText: { color: C.linen, fontWeight: '700', fontSize: 16, paddingLeft: 40 },
  knob: { position: 'absolute', left: 6, top: 6, width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: C.mustard, alignItems: 'center', justifyContent: 'center' },
});
