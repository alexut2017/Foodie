import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RESTAURANTS, districtName, findRestaurant } from '../../src/data';
import { useSession } from '../../src/session';
import { loadVisit, isExpired, openVisit, type Visit } from '../../src/visit';
import { payForMembership } from '../../src/checkout';
import { errText } from '../../src/billing';
import { RestaurantRow } from '../../src/RestaurantRow';
import { Body, Button, Card, Eyebrow, H1, Note, Small } from '../../src/ui';
import { fmtDate } from '../../src/format';
import { C } from '../../src/theme';

export default function Pass() {
  const { paid, paymentsOpen, status, refresh } = useSession();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Visit | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ err?: boolean; text: string } | null>(null);

  useFocusEffect(useCallback(() => {
    refresh();
    loadVisit().then((v) => setOpen(v && !v.confirmedAt && !isExpired(v) ? v : null));
  }, []));

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return RESTAURANTS.filter((r) => !t || `${r.name} ${r.cuisine} ${districtName(r.district)}`.toLowerCase().includes(t)).sort((a, b) => a.name.localeCompare(b.name));
  }, [q]);

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
      <SafeAreaView style={s.wrap} edges={['top']}>
        <Eyebrow>My pass</Eyebrow>
        <H1>Your pass unlocks with membership</H1>
        <Body>Your member pass appears here once your $30 yearly membership is active.</Body>
        <Card>
          <Text style={s.cardH}>How the pass works</Text>
          <Body>1. At the restaurant, open My pass and tap where you{'’'}re eating.</Body>
          <Body>2. Show the screen before you pay.</Body>
          <Body>3. Staff swipe to confirm and apply the offer. The pass closes for that visit.</Body>
        </Card>
        {paymentsOpen ? (
          <Button title="Join for $30 a year" onPress={join} busy={busy} />
        ) : (
          <Note>{paymentsOpen === null ? 'Checking membership options…' : 'Online payment opens at launch. We’ll let you know as soon as you can activate your pass.'}</Note>
        )}
        {msg ? <Note tone={msg.err ? 'err' : 'ok'}>{msg.text}</Note> : null}
      </SafeAreaView>
    );
  }

  const openR = open ? findRestaurant(open.rid) : undefined;
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Eyebrow>My pass</Eyebrow>
            <H1>Where are you eating?</H1>
            <Body>Tap the restaurant when you{'’'}re ready to pay. Your pass opens for 15 minutes and closes once staff confirm it.</Body>
            {status?.membership.in_grace ? <Note tone="err">Your renewal payment didn{'’'}t go through. Update your card in Account to keep your pass.</Note> : null}
            {status?.membership.access_until ? <Small>Member through {fmtDate(status.membership.access_until)}</Small> : null}
            {openR ? <Button title={`Back to my open pass: ${openR.name}`} kind="dark" onPress={() => router.push('/visit')} /> : null}
            <TextInput style={s.search} value={q} onChangeText={setQ} placeholder="Search by name, cuisine or neighborhood" placeholderTextColor="#9AA3A2" accessibilityLabel="Search restaurants" />
          </View>
        }
        renderItem={({ item }) => <RestaurantRow r={item} cta={'I’m here'} onPress={() => openVisit(item.id)} />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 14 },
  cardH: { fontSize: 20, fontWeight: '800', color: C.bayou },
  search: { minHeight: 50, borderWidth: 2, borderColor: C.bayou, borderRadius: 999, paddingHorizontal: 18, fontSize: 17, backgroundColor: C.card, color: C.bayou },
});
