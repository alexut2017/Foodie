import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/supabase';
import { CONFIG } from '../../src/config';
import { Body, Button, H1, Note } from '../../src/ui';
import { C } from '../../src/theme';
import { formatUS } from '../../src/format';

// Step 2: 6-digit code from a text (the OS offers to autofill it) or from an email.
export default function Verify() {
  const { phone = '', email = '', mode } = useLocalSearchParams<{ phone?: string; email?: string; mode?: string }>();
  const byEmail = !phone && !!email;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ err?: boolean; text: string } | null>(null);
  const [wait, setWait] = useState(CONFIG.resendSeconds);
  const input = useRef<TextInput>(null);

  useEffect(() => { const t = setInterval(() => setWait((w) => (w > 0 ? w - 1 : 0)), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (code.length === 6) verify(code); }, [code]); // submit as soon as 6 digits are in

  async function verify(token: string) {
    if (busy || token.length !== 6) return;
    setBusy(true); setMsg(null);
    const { data, error } = byEmail
      ? await supabase.auth.verifyOtp({ email, token, type: 'email' })
      : await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    setBusy(false);
    if (error || !data.session) {
      const limited = error?.status === 429 || /rate|too many/i.test(error?.message ?? '');
      setMsg({ err: true, text: limited ? 'Too many tries. Wait a minute, then try again.' : `That code is wrong or has expired. Check the latest ${byEmail ? 'email' : 'text'}, or send a new code.` });
      setCode(''); input.current?.focus();
      return;
    }
    router.replace('/'); // the gate sends new members to the profile step, returning members into the app
  }

  async function resend() {
    if (wait > 0) return;
    const shouldCreateUser = mode !== 'signin';
    const { error } = byEmail
      ? await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser } })
      : await supabase.auth.signInWithOtp({ phone, options: { channel: 'sms', shouldCreateUser } });
    setWait(CONFIG.resendSeconds);
    setMsg(error ? { err: true, text: 'We couldn’t send a new code. Try again in a minute.' } : { text: 'New code sent.' });
  }

  const shown = byEmail ? email : formatUS(phone.replace(/^\+1/, ''));
  return (
    <SafeAreaView style={s.wrap}>
      <View style={{ gap: 14 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}><Text style={s.back}>{'←'}</Text></Pressable>
        <H1>Enter the code</H1>
        <Body>{mode === 'signin' ? `If there’s an account for ${shown}, a code is on its way.` : `Sent to ${shown}.`} It expires in 10 minutes.{byEmail ? ' Check spam if you don’t see it.' : ''}</Body>
        {/* One hidden input drives six boxes, so paste and SMS autofill both work. */}
        <Pressable onPress={() => input.current?.focus()} style={s.boxes} accessibilityLabel={`Verification code, ${code.length} of 6 digits entered`}>
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={[s.box, i === code.length && s.boxOn]}><Text style={s.digit}>{code[i] ?? ''}</Text></View>
          ))}
        </Pressable>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={byEmail ? 'one-time-code' : 'sms-otp'}
          autoFocus
          maxLength={6}
          style={s.hidden}
        />
        {msg ? <Note tone={msg.err ? 'err' : 'ok'}>{msg.text}</Note> : null}
      </View>
      <View style={{ gap: 12 }}>
        <Button title={busy ? 'Checking…' : 'Verify'} onPress={() => verify(code)} disabled={code.length !== 6} busy={busy} />
        <Button title={wait > 0 ? `Resend code in ${wait}s` : 'Resend code'} kind="ghost" onPress={resend} disabled={wait > 0} />
        <Button title={byEmail ? 'Use a different email' : 'Use a different number'} kind="ghost" style={{ borderColor: 'transparent' }} onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'space-between' },
  back: { fontSize: 28, color: C.bayou },
  boxes: { flexDirection: 'row', gap: 10, marginTop: 8 },
  box: { flex: 1, aspectRatio: 0.85, borderWidth: 1.5, borderColor: '#CFC7B8', borderRadius: 14, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  boxOn: { borderColor: C.chili, borderWidth: 2.5 },
  digit: { fontSize: 28, fontWeight: '800', color: C.bayou },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
