import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/session';
import { payForMembership } from '../../src/checkout';
import { errText } from '../../src/billing';
import { Body, Button, Card, Eyebrow, H1, Note, Small } from '../../src/ui';
import { fmtDate } from '../../src/format';
import { C } from '../../src/theme';

export default function Pass() {
  const { name, paid, paymentsOpen, status, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ err?: boolean; text: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  useFocusEffect(useCallback(() => { refresh(); }, []));
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

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
          <Body>1. At the restaurant, open My pass.</Body>
          <Body>2. Show the screen to your server before you pay.</Body>
          <Body>3. The moving clock shows it isn{'’'}t a screenshot, and your server applies the offer.</Body>
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

  // Paid: the pass itself. Staff only need to look at it.
  const date = new Date(now);
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={s.wrap}>
        <Eyebrow>My pass</Eyebrow>
        <H1>Show this before you pay</H1>
        {status?.membership.in_grace ? <Note tone="err">Your renewal payment didn{'’'}t go through. Update your card in Account to keep your pass.</Note> : null}
        <View style={s.pass}>
          <View style={s.top}><Text style={s.eyebrowSm}>MEMBER PASS</Text><Text style={{ color: C.ok, fontWeight: '700' }}>{'●'} Active</Text></View>
          <Text style={s.name}>{name}</Text>
          <Text style={s.clock} accessibilityLabel="Live clock">{date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</Text>
          <Small>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {'·'} This clock keeps moving, so a screenshot won{'’'}t pass.</Small>
          <View style={s.row}>
            <View><Small>Annual dues</Small><Text style={s.v}>Paid</Text></View>
            <View style={{ alignItems: 'flex-end' }}><Small>Member through</Small><Text style={s.v}>{fmtDate(status?.membership.access_until) || '—'}</Text></View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, padding: 20, gap: 14 },
  cardH: { fontSize: 20, fontWeight: '800', color: C.bayou },
  pass: { backgroundColor: C.linen, borderRadius: 28, padding: 22, gap: 14, borderWidth: 1, borderColor: C.line, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrowSm: { fontSize: 13, fontWeight: '700', letterSpacing: 1.6, color: C.brick },
  name: { fontSize: 32, fontWeight: '800', color: C.bayou, letterSpacing: -0.5 },
  clock: { fontSize: 42, fontWeight: '800', textAlign: 'center', color: C.bayou, backgroundColor: C.sand, borderRadius: 16, paddingVertical: 10, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderStyle: 'dashed', borderTopColor: '#D9D2C4', paddingTop: 14 },
  v: { fontSize: 19, fontWeight: '700', color: C.bayou, fontVariant: ['tabular-nums'] },
});
