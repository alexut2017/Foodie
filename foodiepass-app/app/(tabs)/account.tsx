import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/session';
import { supabase } from '../../src/supabase';
import { manageBilling } from '../../src/checkout';
import { deleteAccount, errText } from '../../src/billing';
import { CONFIG, siteLink } from '../../src/config';
import { PartnerForm } from '../../src/PartnerForm';
import { Body, Button, Card, Eyebrow, H1, Note, Small } from '../../src/ui';
import { formatUS, fmtDate } from '../../src/format';
import { C } from '../../src/theme';

export default function Account() {
  const { name, email, phone, session, status, paid, isAdmin, signOut } = useSession();
  const [msg, setMsg] = useState<{ err?: boolean; text: string } | null>(null);
  const pendingEmail = session?.user.new_email;
  const m = status?.membership;
  const ref = session ? 'GS-' + session.user.id.replace(/-/g, '').slice(0, 6).toUpperCase() : '';

  const leave = async (everywhere?: boolean) => { await signOut(everywhere); router.replace('/'); };

  // Invite friends straight from Messages or Mail, prefilled with the member's referral link.
  const inviteLink = CONFIG.siteUrl.replace(/#.*$/, '') + '?ref=' + encodeURIComponent(ref);
  const inviteBody = `I use GrubScout: one $30 pass that saves on the check at great local Houston restaurants. Join with my link: ${inviteLink}`;
  const openOr = (url: string) => Linking.openURL(url).catch(() => setMsg({ err: true, text: 'This phone couldn’t open that app. Use “Share another way” instead.' }));
  const textFriend = () => openOr(`sms:${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(inviteBody)}`);
  const emailFriend = () => openOr(`mailto:?subject=${encodeURIComponent('Join me on GrubScout')}&body=${encodeURIComponent(inviteBody)}`);
  const invite = () => { Share.share({ message: inviteBody }).catch(() => undefined); };

  // Referrals: this member's numbers, plus a code box for new members who joined without the link.
  const [refs, setRefs] = useState<{ joined: number; months_this_year: number; referred_by: string | null } | null>(null);
  const [refCode, setRefCode] = useState('');
  const [refMsg, setRefMsg] = useState<{ err?: boolean; text: string } | null>(null);
  const loadRefs = () => { supabase.rpc('my_referrals').then(({ data, error }) => { if (!error && data) setRefs(data); }, () => undefined); };
  useEffect(loadRefs, [session?.user.id]);
  const isNew = !!session?.user.created_at && Date.now() - Date.parse(session.user.created_at) < 14 * 86400000;
  async function applyRef() {
    const code = refCode.trim().toUpperCase();
    if (!/^GS-[0-9A-F]{6}$/.test(code)) return setRefMsg({ err: true, text: 'Referral codes look like GS-1A2B3C.' });
    const { data, error } = await supabase.rpc('claim_referral', { p_code: code });
    const out = error ? 'error' : String(data);
    const text: Record<string, string> = { ok: 'Thanks! Your friend gets a free month once your membership starts.', invalid_code: 'We couldn’t find that code. Check it with your friend.', own_code: 'That’s your own code. Share it with friends instead.', already_referred: 'Your account already has a referral.', too_late: 'Referral codes can be added within 14 days of joining.' };
    setRefMsg({ err: out !== 'ok', text: text[out] ?? 'We couldn’t save the code. Check your connection and try again.' });
    if (out === 'ok') loadRefs();
  }

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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <Eyebrow>Account</Eyebrow>
          <H1>{name || 'Your account'}</H1>
          <Card>
            <Row k="Mobile" v={phone ? formatUS(phone.replace(/^\+?1(?=\d{10}$)/, '')) : '—'} />
            <Row k="Email" v={email || '—'} />
            {session?.user.created_at ? <Row k="Member since" v={fmtDate(session.user.created_at)} /> : null}
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
          <Card>
            <Text style={s.h}>Invite friends</Text>
            <Small>Your referral code</Small>
            <Text style={s.code} selectable>{ref}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Text a friend" onPress={textFriend} style={{ flex: 1, paddingHorizontal: 10 }} />
              <Button title="Email a friend" kind="ghost" onPress={emailFriend} style={{ flex: 1, paddingHorizontal: 10 }} />
            </View>
            <Button title="Share another way" kind="ghost" style={{ borderColor: 'transparent' }} onPress={invite} />
            <Small>You get 1 free month for each friend who joins with your code and starts a membership (up to 12 a year).</Small>
            {refs ? (
              <>
                <Row k="Friends who joined" v={String(refs.joined)} />
                <Row k="Free months earned this year" v={`${refs.months_this_year} of 12`} />
                {refs.referred_by ? <Small>You joined with code {refs.referred_by}.</Small> : null}
              </>
            ) : null}
            {refs && !refs.referred_by && isNew ? (
              <View style={{ gap: 6, marginTop: 4 }}>
                <Small>Invited by a friend? Enter their code</Small>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput style={s.refIn} value={refCode} onChangeText={(t) => { setRefCode(t); setRefMsg(null); }} placeholder="GS-1A2B3C" placeholderTextColor="#9AA3A2" autoCapitalize="characters" autoCorrect={false} maxLength={9} accessibilityLabel="Referral code" />
                  <Button title="Apply" onPress={applyRef} style={{ paddingHorizontal: 18 }} />
                </View>
              </View>
            ) : null}
            {refMsg ? <Note tone={refMsg.err ? 'err' : 'ok'}>{refMsg.text}</Note> : null}
          </Card>
          <PartnerForm />
          {isAdmin ? <Button title="Open admin dashboard" kind="dark" onPress={() => Linking.openURL(siteLink('admin'))} /> : null}
          {msg ? <Note tone={msg.err ? 'err' : 'ok'}>{msg.text}</Note> : null}
          <View style={{ gap: 10 }}>
            <Button title="Sign out" kind="ghost" onPress={() => leave()} />
            <Button title="Sign out on all devices" kind="ghost" onPress={() => leave(true)} />
            <Button title="Delete account" kind="ghost" onPress={confirmDelete} style={{ borderColor: C.brick }} />
          </View>
          <Card style={{ gap: 2, paddingVertical: 8 }}>
            {([['How it works', 'how'], ['FAQ', 'faq'], ['Member code of conduct', 'conduct'], ['Terms', 'terms'], ['Privacy', 'privacy']] as const).map(([label, hash]) => (
              <Text key={hash} accessibilityRole="link" onPress={() => Linking.openURL(siteLink(hash))} style={s.link}>{label}</Text>
            ))}
          </Card>
          <Small style={{ textAlign: 'center' }}>GrubScout app v{CONFIG.version}</Small>
        </ScrollView>
      </KeyboardAvoidingView>
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
  code: { fontSize: 24, fontWeight: '800', color: C.bayou, letterSpacing: 1 },
  link: { fontSize: 16, fontWeight: '600', color: C.brick, paddingVertical: 10, textAlign: 'center' },
  refIn: { flex: 1, minHeight: 52, borderWidth: 1.5, borderColor: '#CFC7B8', borderRadius: 14, paddingHorizontal: 14, fontSize: 17, backgroundColor: C.card, color: C.bayou },
});
