import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/session';
import { useDirectory, districtName, type Restaurant } from '../../src/data';
import { loadVisit, openVisit } from '../../src/visit';
import { payForMembership } from '../../src/checkout';
import { errText } from '../../src/billing';
import { CONFIG } from '../../src/config';
import { Body, Button, Card, Eyebrow, H1, Note, Small } from '../../src/ui';
import { fmtDate } from '../../src/format';
import { C } from '../../src/theme';

export default function Pass() {
  const { name, paid, paymentsOpen, status, refresh } = useSession();
  const { restaurants, loading } = useDirectory();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ err?: boolean; text: string } | null>(null);
  const [q, setQ] = useState('');
  const [now, setNow] = useState(Date.now());

  // Re-check membership each time the tab opens; jump back into a pass that is still open.
  useFocusEffect(useCallback(() => {
    refresh();
    loadVisit().then((v) => { if (v && paid) router.push('/visit'); });
  }, [paid]));
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    return restaurants
      .filter((r) => !t || `${r.name} ${r.cuisine} ${districtName(r.district)}`.toLowerCase().includes(t))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [restaurants, q]);

  async function join() {
    setBusy(true); setMsg(null);
    try {
      const s = await payForMembership();
      await refresh();
      setMsg(s ? { text: 'Your membership is active. Enjoy!' } : { text: 'We’re still confirming your payment. Check back in a minute; you won’t be charged twice.' });
    } catch (e) {
      setMsg({ err: true, text: errText(e) });
    } finally { setBusy(false); }
  }

  // Not paid: no pass. Explain how it works and offer the membership.
  if (!paid) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.wrap}>
          <Eyebrow>My pass</Eyebrow>
          <H1>Your account is verified</H1>
          <Body>Your member pass appears here once your $30 membership is active.</Body>
          <Card>
            <Text style={s.cardH}>How the pass works</Text>
            <Body>1. At the restaurant, open My pass and tap where you{'’'}re eating.</Body>
            <Body>2. Show the screen before you pay.</Body>
            <Body>3. Staff swipe to confirm and apply the offer. The pass closes for that visit.</Body>
          </Card>
          {paymentsOpen ? (
            <Button title="Activate membership · $30/yr" onPress={join} busy={busy} />
          ) : (
            <>
              <Button title="Activate membership · $30/yr" disabled />
              <Note>{paymentsOpen === null ? 'Checking membership options…' : 'Online payment opens at launch. We’ll let you know as soon as you can activate your pass.'}</Note>
            </>
          )}
          {msg ? <Note tone={msg.err ? 'err' : 'ok'}>{msg.text}</Note> : null}
        </View>
      </SafeAreaView>
    );
  }

  // Paid: member card, then pick the restaurant to open the 15-minute pass staff will swipe.
  const date = new Date(now);
  const header = (
    <View style={{ gap: 14 }}>
      <Eyebrow>My pass</Eyebrow>
      {status?.membership.in_grace ? <Note tone="err">Your renewal payment didn{'’'}t go through. Update your card in Account to keep your pass.</Note> : null}
      <View style={s.pass}>
        <View style={s.top}><Text style={s.eyebrowSm}>MEMBER</Text><Text style={{ color: C.ok, fontWeight: '700' }}>{'●'} Active</Text></View>
        <Text style={s.name}>{name}</Text>
        <Text style={s.clock} accessibilityLabel="Live clock">{date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</Text>
        <Small style={{ textAlign: 'center' }}>{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Small>
        <View style={s.row}>
          <View><Small>Annual dues</Small><Text style={s.v}>Paid</Text></View>
          <View style={{ alignItems: 'flex-end' }}><Small>Member through</Small><Text style={s.v}>{fmtDate(status?.membership.access_until) || '—'}</Text></View>
        </View>
      </View>
      <H1 style={{ fontSize: 26, lineHeight: 30, marginTop: 6 }}>Where are you eating?</H1>
      <Body style={{ fontSize: 16 }}>Tap the restaurant when you{'’'}re ready to pay. Your pass opens for {CONFIG.passMinutes} minutes and closes once staff confirm it.</Body>
      <TextInput style={s.search} value={q} onChangeText={setQ} placeholder="Search by name, cuisine or neighborhood" placeholderTextColor="#9AA3A2" accessibilityLabel="Search restaurants" clearButtonMode="while-editing" />
    </View>
  );
  const footer = (
    <View style={{ gap: 10, marginTop: 6 }}>
      <Button title="See restaurants and offers" kind="ghost" onPress={() => router.push('/explore')} />
      {msg ? <Note tone={msg.err ? 'err' : 'ok'}>{msg.text}</Note> : null}
      <Button title="Report a problem" kind="ghost" style={{ borderColor: 'transparent' }} onPress={() => setMsg({ text: 'Thanks. A short report form opens at launch, and we follow up with the restaurant.' })} />
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[s.wrap, { paddingBottom: 40 }]}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        renderItem={({ item }) => <PickRow r={item} />}
        ListEmptyComponent={<Small style={{ textAlign: 'center' }}>{loading ? 'Loading restaurants…' : 'No matches.'}</Small>}
      />
    </SafeAreaView>
  );
}

function PickRow({ r }: { r: Restaurant }) {
  return (
    <View style={s.pick}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: C.bayou }}>{r.name}</Text>
        <Small>{r.offer}</Small>
      </View>
      <Pressable onPress={() => openVisit(r)} accessibilityRole="button" accessibilityLabel={`I’m at ${r.name}`} style={({ pressed }) => [s.pill, pressed && { opacity: 0.85 }]}>
        <Text style={{ fontWeight: '800', color: C.bayou }}>I{'’'}m here</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, padding: 20, gap: 14 },
  cardH: { fontSize: 20, fontWeight: '800', color: C.bayou },
  pass: { backgroundColor: C.linen, borderRadius: 28, padding: 22, gap: 12, borderWidth: 1, borderColor: C.line },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrowSm: { fontSize: 13, fontWeight: '700', letterSpacing: 1.6, color: C.brick },
  name: { fontSize: 30, fontWeight: '800', color: C.bayou, letterSpacing: -0.5 },
  clock: { fontSize: 40, fontWeight: '800', textAlign: 'center', color: C.bayou, backgroundColor: C.sand, borderRadius: 16, paddingVertical: 8, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderStyle: 'dashed', borderTopColor: '#D9D2C4', paddingTop: 14 },
  v: { fontSize: 18, fontWeight: '700', color: C.bayou, fontVariant: ['tabular-nums'] },
  search: { minHeight: 50, borderWidth: 2, borderColor: C.bayou, borderRadius: 999, paddingHorizontal: 18, fontSize: 16, backgroundColor: C.card, color: C.bayou },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14 },
  pill: { minHeight: 44, borderRadius: 999, backgroundColor: C.chili, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
});
