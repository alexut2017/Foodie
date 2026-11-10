import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/supabase';
import { CONFIG, siteLink } from '../../src/config';
import { Body, Button, H1, Note, Small } from '../../src/ui';
import { C } from '../../src/theme';

// Step 1: same registration as the website. Join collects name, email, phone and address; sign-in is email only.
// Either way we email a 6-digit code (next screen). No password.
type Field = 'first' | 'last' | 'email' | 'phone' | 'address1' | 'address2' | 'city' | 'state' | 'zip' | 'ref';
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const fmtPhone = (d: string) => (d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d);

export default function Register() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const join = mode !== 'signin';
  const [f, setF] = useState<Record<Field, string>>({ first: '', last: '', email: '', phone: '', address1: '', address2: '', city: 'Houston', state: 'TX', zip: '', ref: '' });
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: Field) => (v: string) => { setF((x) => ({ ...x, [k]: v })); setErr(null); };
  const t = (k: Field) => f[k].trim();

  // Same checks, in the same order, as the website's join form.
  function problem(): string {
    if (!join) return emailOk(f.email) ? '' : 'Enter a valid email address, like name@example.com.';
    if (!t('first') || !t('last')) return 'Enter your first and last name.';
    if (!emailOk(f.email)) return 'Enter a valid email address, like name@example.com.';
    const digits = f.phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (!digits) return 'Enter your phone number.';
    if (digits.length !== 10) return 'Enter a 10-digit phone number, like 555-555-5555.';
    if (!t('address1') || !t('city') || !t('state')) return 'Enter your full address.';
    if (!/^[A-Za-z]{2}$/.test(t('state'))) return 'Use the 2-letter state code, like TX.';
    if (!/^\d{5}(-\d{4})?$/.test(t('zip'))) return 'Enter a 5-digit zip code.';
    if (t('ref') && !/^GS-[0-9A-F]{6}$/i.test(t('ref'))) return 'Referral codes look like GS-1A2B3C. Check it, or leave it blank.';
    return '';
  }

  async function send() {
    if (busy) return;
    const p = problem();
    if (p) return setErr(p);
    setBusy(true); setErr(null);
    const email = f.email.trim().toLowerCase();
    const digits = f.phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: join
        ? {
            shouldCreateUser: true,
            data: {
              full_name: `${t('first')} ${t('last')}`, first_name: t('first'), last_name: t('last'), phone: fmtPhone(digits),
              address_line1: t('address1'), address_line2: t('address2') || undefined, city: t('city'), state: t('state').toUpperCase(), zip: t('zip'),
              terms_version: CONFIG.termsVersion, terms_accepted_at: new Date().toISOString(), marketing_opt_in: marketing,
              referred_by: t('ref') ? t('ref').toUpperCase() : undefined,
            },
          }
        : { shouldCreateUser: false },
    });
    setBusy(false);
    const msg = `${error?.message ?? ''} ${error?.code ?? ''}`.toLowerCase();
    // Signing in: answer the same way whether or not an account exists.
    if (error && !(!join && /otp_disabled|signups? not allowed|user not found/.test(msg))) {
      setErr(error.status === 429 || /rate|too many|security purposes/.test(msg) ? 'Too many code requests. Wait a minute, then try again.' : 'We couldn’t send the code just now. Check the address and try again in a minute.');
      return;
    }
    router.push({ pathname: '/verify', params: { email, mode: join ? 'join' : 'signin' } });
  }

  const In = (k: Field, label: string, p: TextInputProps = {}, grow = false) => (
    <View style={[{ gap: 6 }, grow && { flex: 1 }]}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} value={f[k]} onChangeText={set(k)} placeholderTextColor="#9AA3A2" accessibilityLabel={label} {...p} />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}><Text style={s.back}>{'←'}</Text></Pressable>
          <H1>{join ? 'Join LocalScout' : 'Sign in'}</H1>
          <Body>{join ? 'Your name goes on your member pass. We’ll email you a 6-digit code to confirm your account.' : 'Enter the email on your LocalScout account and we’ll send you a 6-digit code.'}</Body>
          {join ? <View style={s.row}>{In('first', 'First name', { textContentType: 'givenName', autoComplete: 'name-given', maxLength: 59 }, true)}{In('last', 'Last name', { textContentType: 'familyName', autoComplete: 'name-family', maxLength: 60 }, true)}</View> : null}
          {In('email', 'Email', { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false, textContentType: 'emailAddress', autoComplete: 'email', maxLength: 254, autoFocus: !join })}
          {join ? (
            <>
              {In('phone', 'Phone', { keyboardType: 'phone-pad', textContentType: 'telephoneNumber', autoComplete: 'tel', placeholder: '555-555-5555', maxLength: 20 })}
              {In('address1', 'Address line 1', { textContentType: 'streetAddressLine1', autoComplete: 'street-address', maxLength: 120 })}
              {In('address2', 'Address line 2', { textContentType: 'streetAddressLine2', maxLength: 80 })}
              {In('city', 'City', { textContentType: 'addressCity', maxLength: 80 })}
              <View style={s.row}>{In('state', 'State', { autoCapitalize: 'characters', maxLength: 2, textContentType: 'addressState' }, true)}{In('zip', 'Zip', { keyboardType: 'number-pad', maxLength: 10, textContentType: 'postalCode', autoComplete: 'postal-code' }, true)}</View>
              {In('ref', 'Referral code (optional)', { autoCapitalize: 'characters', autoCorrect: false, placeholder: 'GS-1A2B3C', maxLength: 9 })}
              <Pressable style={s.opt} onPress={() => setMarketing((m) => !m)} accessibilityRole="switch" accessibilityState={{ checked: marketing }}>
                <Text style={s.optText}>Send me new restaurants and member offers (optional)</Text>
                <Switch value={marketing} onValueChange={setMarketing} trackColor={{ true: C.chili, false: C.line }} />
              </Pressable>
            </>
          ) : null}
          {err ? <Note tone="err">{err}</Note> : null}
          <Button title="Continue with email" onPress={send} busy={busy} />
          <Small>
            We{'’'}ll email you a one-time code. No password needed. {join ? 'Next, you’ll activate your $30 membership. ' : 'Sign-in is for existing members. '}By continuing you agree to the{' '}
            <Text style={s.link} onPress={() => Linking.openURL(siteLink('terms'))}>Terms of Use</Text> and{' '}
            <Text style={s.link} onPress={() => Linking.openURL(siteLink('privacy'))}>Privacy Policy</Text>.
          </Small>
          <Button title={join ? 'I already have an account' : 'New here? Join LocalScout'} kind="ghost" style={{ borderColor: 'transparent' }} onPress={() => router.setParams({ mode: join ? 'signin' : 'join' })} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, padding: 24, gap: 14, paddingBottom: 40 },
  back: { fontSize: 28, color: C.bayou },
  row: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 15, fontWeight: '600', color: C.bayou },
  input: { minHeight: 52, borderWidth: 1.5, borderColor: '#CFC7B8', borderRadius: 14, paddingHorizontal: 14, fontSize: 17, backgroundColor: C.card, color: C.bayou },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  optText: { flex: 1, fontSize: 16, color: C.ink2 },
  link: { color: C.brick, fontWeight: '600', textDecorationLine: 'underline' },
});
