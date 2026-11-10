import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../src/supabase';
import { CONFIG, siteLink } from '../../src/config';
import { Body, Button, H1, Note, Small } from '../../src/ui';
import { C } from '../../src/theme';
import { formatUS } from '../../src/format';

type Method = 'phone' | 'email';

// Step 1: phone number (default, like inKind) or email. We send a 6-digit code. No password, no card.
export default function SignIn() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const signin = mode === 'signin';
  const [method, setMethod] = useState<Method>('phone');
  const [digits, setDigits] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; offerEmail?: boolean } | null>(null);
  const valid = method === 'phone' ? digits.length === 10 && /^[2-9]/.test(digits) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function send() {
    if (!valid || busy) return;
    setBusy(true); setErr(null);
    const options = {
      shouldCreateUser: !signin,
      data: signin ? undefined : { terms_version: CONFIG.termsVersion, terms_accepted_at: new Date().toISOString() },
    };
    const target = method === 'phone' ? '+1' + digits : email.trim().toLowerCase();
    const { error } = method === 'phone'
      ? await supabase.auth.signInWithOtp({ phone: target, options: { ...options, channel: 'sms' } })
      : await supabase.auth.signInWithOtp({ email: target, options });
    setBusy(false);
    const t = `${error?.message ?? ''} ${error?.code ?? ''}`.toLowerCase();
    // Signing in: don't reveal whether an account exists for this number or address.
    if (error && !(signin && /otp_disabled|signups? not allowed|user not found/.test(t))) {
      if (error.status === 429 || /rate|too many|security purposes/.test(t)) setErr({ text: 'Too many code requests. Wait a minute, then try again.' });
      else if (/verified tester|21608/.test(t)) setErr({ text: 'LocalScout texting is in test mode, so this number can’t get codes yet. Use email for now.', offerEmail: true });
      else if (/phone_provider_disabled|unsupported phone provider/.test(t)) setErr({ text: 'Text sign-in isn’t switched on yet. Use email for now.', offerEmail: true });
      else setErr({ text: method === 'phone' ? 'We couldn’t text a code to that number. Check it, or use email.' : 'We couldn’t email a code. Check the address and your connection.', offerEmail: method === 'phone' });
      return;
    }
    router.push({ pathname: '/verify', params: method === 'phone' ? { phone: target, mode: mode ?? '' } : { email: target, mode: mode ?? '' } });
  }

  async function apple() {
    try {
      const cred = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] });
      if (!cred.identityToken) throw new Error('no token');
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
      if (error) throw error;
      // Apple shares the name only on the very first sign-in, so keep it.
      const full = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ');
      if (full) await supabase.auth.updateUser({ data: { full_name: full, first_name: cred.fullName?.givenName ?? '', last_name: cred.fullName?.familyName ?? '' } });
      router.replace('/');
    } catch (e) {
      if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED') setErr({ text: 'Apple sign-in didn’t finish. Try again or use your phone number.' });
    }
  }

  const switchTo = (m: Method) => { setMethod(m); setErr(null); };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 14 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}><Text style={s.back}>{'←'}</Text></Pressable>
            <H1>{signin ? 'Welcome back' : 'Create your account'}</H1>
            <Body>{method === 'phone'
              ? `We’ll text you a 6-digit code to ${signin ? 'sign in' : 'create your account'}. Message and data rates may apply.`
              : `We’ll email you a 6-digit code to ${signin ? 'sign in' : 'create your account'}.`}</Body>
            <View style={s.seg} accessibilityRole="tablist">
              {(['phone', 'email'] as const).map((m) => (
                <Pressable key={m} onPress={() => switchTo(m)} style={[s.segBtn, method === m && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: method === m }}>
                  <Text style={[s.segText, method === m && { color: C.linen }]}>{m === 'phone' ? 'Phone' : 'Email'}</Text>
                </Pressable>
              ))}
            </View>
            {method === 'phone' ? (
              <View style={s.row}>
                <View style={s.cc}><Text style={s.ccText}>+1</Text></View>
                <TextInput
                  style={s.input}
                  value={formatUS(digits)}
                  onChangeText={(t) => { setDigits(t.replace(/\D/g, '').replace(/^1(?=\d{10})/, '').slice(0, 10)); setErr(null); }}
                  placeholder="(713) 555-0123"
                  placeholderTextColor="#9AA3A2"
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  autoFocus
                  accessibilityLabel="Mobile phone number"
                  returnKeyType="send"
                  onSubmitEditing={send}
                />
              </View>
            ) : (
              <TextInput
                style={[s.input, { flex: 0, fontSize: 18 }]}
                value={email}
                onChangeText={(t) => { setEmail(t); setErr(null); }}
                placeholder="you@example.com"
                placeholderTextColor="#9AA3A2"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
                autoFocus
                accessibilityLabel="Email address"
                returnKeyType="send"
                onSubmitEditing={send}
              />
            )}
            {err ? <Note tone="err">{err.text}</Note> : null}
            {err?.offerEmail ? <Button title="Use email instead" kind="ghost" onPress={() => switchTo('email')} /> : null}
          </View>
          <View style={{ gap: 12 }}>
            <Button title={method === 'phone' ? 'Text me a code' : 'Email me a code'} onPress={send} disabled={!valid} busy={busy} />
            {CONFIG.appleSignIn && Platform.OS === 'ios' ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={26}
                style={{ height: 52 }}
                onPress={apple}
              />
            ) : null}
            <Small style={{ textAlign: 'center' }}>
              By continuing you agree to the LocalScout{' '}
              <Text style={s.link} onPress={() => Linking.openURL(siteLink('terms'))}>Terms</Text> and{' '}
              <Text style={s.link} onPress={() => Linking.openURL(siteLink('privacy'))}>Privacy Policy</Text>.
            </Small>
            <Button title={signin ? 'New here? Create an account' : 'I already have an account'} kind="ghost" style={{ borderColor: 'transparent' }} onPress={() => router.setParams({ mode: signin ? '' : 'signin' })} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, padding: 24, justifyContent: 'space-between', gap: 24 },
  back: { fontSize: 28, color: C.bayou },
  seg: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: C.sand, borderRadius: 999, padding: 4, gap: 4 },
  segBtn: { paddingHorizontal: 22, paddingVertical: 9, borderRadius: 999 },
  segOn: { backgroundColor: C.bayou },
  segText: { fontWeight: '700', color: C.ink2, fontSize: 15 },
  row: { flexDirection: 'row', gap: 10 },
  cc: { borderWidth: 1.5, borderColor: '#CFC7B8', borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: C.card },
  ccText: { fontSize: 18, fontWeight: '600', color: C.bayou },
  input: { flex: 1, minHeight: 56, borderWidth: 1.5, borderColor: '#CFC7B8', borderRadius: 14, paddingHorizontal: 16, fontSize: 22, letterSpacing: 0.5, backgroundColor: C.card, color: C.bayou },
  link: { color: C.brick, fontWeight: '600', textDecorationLine: 'underline' },
});
