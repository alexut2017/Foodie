import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../src/supabase';
import { CONFIG } from '../../src/config';
import { Body, Button, H1, Note, Small } from '../../src/ui';
import { C } from '../../src/theme';

import { formatUS } from '../../src/format';

// Step 1: phone number (US). Like inKind: one field, we text a 6-digit code. No password, no card.
export default function Phone() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const valid = digits.length === 10 && /^[2-9]/.test(digits);

  async function send() {
    if (!valid || busy) return;
    setBusy(true); setErr(null);
    const phone = '+1' + digits;
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { channel: 'sms', shouldCreateUser: true, data: { terms_version: CONFIG.termsVersion, terms_accepted_at: new Date().toISOString() } },
    });
    setBusy(false);
    if (error) {
      const limited = error.status === 429 || /rate|too many|security purposes/i.test(error.message);
      setErr(limited ? 'Too many code requests. Wait a minute, then try again.' : 'We couldn’t text a code to that number. Check it and try again.');
      return;
    }
    router.push({ pathname: '/verify', params: { phone } });
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
      if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED') setErr('Apple sign-in didn’t finish. Try again or use your phone number.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.wrap}>
        <View style={{ gap: 14 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}><Text style={s.back}>{'←'}</Text></Pressable>
          <H1>{mode === 'signin' ? 'Welcome back' : 'What’s your number?'}</H1>
          <Body>{`We’ll text you a 6-digit code to ${mode === 'signin' ? 'sign in' : 'create your account'}. Message and data rates may apply.`}</Body>
          <View style={s.row}>
            <View style={s.cc}><Text style={s.ccText}>{'\u{1F1FA}\u{1F1F8}'} +1</Text></View>
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
          {err ? <Note tone="err">{err}</Note> : null}
        </View>
        <View style={{ gap: 12 }}>
          <Button title="Send code" onPress={send} disabled={!valid} busy={busy} />
          {CONFIG.appleSignIn && Platform.OS === 'ios' ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={26}
              style={{ height: 52 }}
              onPress={apple}
            />
          ) : null}
          <Small style={{ textAlign: 'center' }}>By continuing you agree to the FoodiePass Terms and Privacy Policy.</Small>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'space-between' },
  back: { fontSize: 28, color: C.bayou },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cc: { borderWidth: 1.5, borderColor: '#CFC7B8', borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: C.card },
  ccText: { fontSize: 18, fontWeight: '600', color: C.bayou },
  input: { flex: 1, minHeight: 56, borderWidth: 1.5, borderColor: '#CFC7B8', borderRadius: 14, paddingHorizontal: 16, fontSize: 22, letterSpacing: 0.5, backgroundColor: C.card, color: C.bayou },
});
