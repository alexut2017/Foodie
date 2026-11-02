import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/session';
import { manageBilling } from '../../src/checkout';
import { deleteAccount, errText } from '../../src/billing';
import { Body, Button, Card, Eyebrow, H1, Note, Small } from '../../src/ui';
import { formatUS, fmtDate } from '../../src/format';
import { C } from '../../src/theme';

export default function Account() {
  const { name, email, phone, session, status, paid, signOut } = useSession();
  const [msg, setMsg] = useState<{ err?: boolean; text: string } | null>(null);
  const pendingEmail = session?.user.new_email;
  const m = status?.membership;

  const leave = async (everywhere?: boolean) => { await signOut(everywhere); router.replace('/'); };

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      'This can’t be undone. Any renewing membership is cancelled right away with no further charges, and your account and pass are removed.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try { await deleteAccount(); await leave(); }
            catch (e) {
              const reauth = (e as { code?: string }).code === 'reauth_required';
              setMsg({ err: true, text: reauth ? 'For your security, sign out and sign back in, then delete your account within 10 minutes.' : errText(e) });
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={s.wrap}>
        <Eyebrow>Account</Eyebrow>
        <H1>{name || 'Your account'}</H1>
        <Card>
          <Row k="Phone" v={phone ? formatUS(phone.replace(/^1/, '').replace(/^\+1/, '')) : '—'} />
          <Row k="Email" v={email || '—'} />
          {pendingEmail ? <Small>Check {pendingEmail} for a link to confirm your email.</Small> : null}
          <Button title="Edit name or email" kind="ghost" onPress={() => router.push('/profile')} />
        </Card>
        <Card>
          <Text style={s.h}>Membership</Text>
          {paid && m ? (
            m.in_grace
              ? <Note tone="err">Your renewal payment didn{'’'}t go through. Your pass stays active until {fmtDate(m.grace_until)}. Update your card to keep it.</Note>
              : <Note tone="ok">Active through {fmtDate(m.access_until)}.{status?.subscription?.cancel_at_period_end ? ' It will not renew.' : status?.subscription?.renews ? ' Renews automatically; we remind you 30 days before.' : ''}</Note>
          ) : <Body>No active membership yet. Activate it from My pass.</Body>}
          {status?.can_manage_billing ? <Button title="Manage billing" kind="dark" onPress={() => manageBilling().catch((e) => setMsg({ err: true, text: errText(e) }))} /> : null}
        </Card>
        {msg ? <Note tone={msg.err ? 'err' : 'ok'}>{msg.text}</Note> : null}
        <View style={{ gap: 10 }}>
          <Button title="Sign out" kind="ghost" onPress={() => leave()} />
          <Button title="Sign out on all devices" kind="ghost" onPress={() => leave(true)} />
          <Button title="Delete account" kind="ghost" onPress={confirmDelete} style={{ borderColor: C.brick }} />
        </View>
        <Small style={{ textAlign: 'center' }}>FoodiePass app v0.1.0</Small>
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
    <Small>{k}</Small><Text style={{ fontSize: 16, fontWeight: '600', color: C.bayou, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
  </View>
);

const s = StyleSheet.create({
  wrap: { padding: 20, gap: 14, paddingBottom: 40 },
  h: { fontSize: 20, fontWeight: '800', color: C.bayou },
});
