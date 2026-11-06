import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/supabase';
import { CONFIG } from '../../src/config';
import { useSession } from '../../src/session';
import { Body, Button, H1, Note } from '../../src/ui';
import { C } from '../../src/theme';

// Step 3: name + email, like inKind. The name shows on the member pass; email gets receipts and renewal reminders.
export default function Profile() {
  const { session, onboarded } = useSession();
  const md = (session?.user.user_metadata ?? {}) as Record<string, string>;
  const [first, setFirst] = useState(md.first_name ?? '');
  const [last, setLast] = useState(md.last_name ?? '');
  const [email, setEmail] = useState(session?.user.email ?? md.contact_email ?? '');
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ok = first.trim().length > 0 && last.trim().length > 0 && emailOk;

  async function save() {
    if (!ok || busy || !session) return;
    setBusy(true); setErr(null);
    const clean = email.trim().toLowerCase();
    const data = { first_name: first.trim(), last_name: last.trim(), full_name: `${first.trim()} ${last.trim()}`, contact_email: clean, marketing_opt_in: marketing };
    // Attach the email to the account (Supabase sends a confirmation link) unless it is already the account email.
    const attrs = session.user.email === clean ? { data } : { data, email: clean };
    const { error } = await supabase.auth.updateUser(attrs);
    if (error) {
      setBusy(false);
      setErr(/already|registered|exists/i.test(error.message) ? 'That email is already on another GrubScout account. Sign in with that account, or use a different email.' : 'We couldn’t save your details. Check your connection and try again.');
      return;
    }
    // Marketing consent is recorded separately from the terms (spec section 2).
    await supabase.from('consents').insert({ user_id: session.user.id, kind: 'marketing', version: CONFIG.termsVersion, granted: marketing });
    await supabase.auth.refreshSession();
    setBusy(false);
    if (onboarded && router.canGoBack()) router.back(); // edited from Account
    else router.replace('/location');
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 14 }}>
            <H1>A little about you</H1>
            <Body>Your name goes on your member pass. We send receipts and renewal reminders to your email.</Body>
            <View style={s.row}>
              <TextInput style={[s.input, { flex: 1 }]} value={first} onChangeText={setFirst} placeholder="First name" placeholderTextColor="#9AA3A2" textContentType="givenName" autoComplete="name-given" accessibilityLabel="First name" autoFocus />
              <TextInput style={[s.input, { flex: 1 }]} value={last} onChangeText={setLast} placeholder="Last name" placeholderTextColor="#9AA3A2" textContentType="familyName" autoComplete="name-family" accessibilityLabel="Last name" />
            </View>
            <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#9AA3A2" keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" autoComplete="email" accessibilityLabel="Email" />
            <Pressable style={s.opt} onPress={() => setMarketing((m) => !m)} accessibilityRole="switch" accessibilityState={{ checked: marketing }}>
              <Text style={s.optText}>Send me new restaurants and member offers (optional)</Text>
              <Switch value={marketing} onValueChange={setMarketing} trackColor={{ true: C.chili, false: C.line }} />
            </Pressable>
            {err ? <Note tone="err">{err}</Note> : null}
          </View>
          <Button title="Continue" onPress={save} disabled={!ok} busy={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, padding: 24, justifyContent: 'space-between', gap: 24 },
  row: { flexDirection: 'row', gap: 10 },
  input: { minHeight: 54, borderWidth: 1.5, borderColor: '#CFC7B8', borderRadius: 14, paddingHorizontal: 16, fontSize: 18, backgroundColor: C.card, color: C.bayou },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  optText: { flex: 1, fontSize: 16, color: C.ink2 },
});
