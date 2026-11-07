import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { supabase } from './supabase';
import { Body, Button, Card, Note, Small } from './ui';
import { C } from './theme';

// Same partner application as the website: RPC submit_partner_application (rate-limited, with a honeypot field).
type Field = 'name' | 'first' | 'last' | 'phone' | 'email' | 'address1' | 'address2' | 'city' | 'state' | 'zip' | 'cuisine' | 'desc' | 'offer';
const REQUIRED: Field[] = ['name', 'first', 'last', 'phone', 'email', 'address1', 'city', 'state', 'zip', 'cuisine', 'desc'];

export function PartnerForm() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<Record<Field, string>>({ name: '', first: '', last: '', phone: '', email: '', address1: '', address2: '', city: 'Houston', state: 'TX', zip: '', cuisine: '', desc: '', offer: '' });
  const set = (k: Field) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const t = (k: Field) => f[k].trim();

  if (done) return <Card><Text style={s.h}>Thanks! Application received</Text><Body style={{ fontSize: 16 }}>We{'’'}ll reach out within a few business days.</Body></Card>;
  if (!open) {
    return (
      <Card>
        <Text style={s.h}>Own or manage a restaurant?</Text>
        <Body style={{ fontSize: 16 }}>Restaurants join free. Bring in new regulars with one simple member offer.</Body>
        <Button title="Apply to be a partner" kind="ghost" onPress={() => setOpen(true)} />
      </Card>
    );
  }

  async function submit() {
    if (REQUIRED.some((k) => !t(k))) return setErr('Please fill in every field marked *.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t('email'))) return setErr('Check the email address.');
    if (t('phone').replace(/\D/g, '').length < 10) return setErr('Check the phone number.');
    setErr(null); setBusy(true);
    const address = [t('address1'), t('address2'), `${t('city')}, ${t('state').toUpperCase()} ${t('zip')}`].filter(Boolean).join(', ');
    const { error } = await supabase.rpc('submit_partner_application', {
      p_restaurant_name: t('name'), p_contact_name: `${t('first')} ${t('last')}`, p_contact_reach: `Phone: ${t('phone')} | Email: ${t('email')}`,
      p_description: t('desc'), p_address: address, p_district: t('city'), p_cuisine: t('cuisine'), p_proposed_offer: t('offer') || null, p_hp: '',
    });
    setBusy(false);
    if (error) return setErr(/rate_limited/i.test(error.message) ? 'We’ve received several applications from you recently. Please try again later.' : 'We couldn’t send your application. Check your connection and try again.');
    setDone(true);
  }

  // `grow` only for fields placed side by side in a row.
  const In = (k: Field, label: string, p: TextInputProps = {}, grow = false) => (
    <View style={[{ gap: 6 }, grow && { flex: 1 }]}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} value={f[k]} onChangeText={set(k)} placeholderTextColor="#9AA3A2" accessibilityLabel={label.replace(' *', '')} {...p} />
    </View>
  );

  return (
    <Card>
      <Text style={s.h}>Partner application</Text>
      <Small>Restaurants join free. Fields marked * are required.</Small>
      {In('name', 'Restaurant name *', { textContentType: 'organizationName' })}
      <View style={s.row}>{In('first', 'First name *', { textContentType: 'givenName' }, true)}{In('last', 'Last name *', { textContentType: 'familyName' }, true)}</View>
      {In('phone', 'Phone *', { keyboardType: 'phone-pad', textContentType: 'telephoneNumber' })}
      {In('email', 'Email *', { keyboardType: 'email-address', autoCapitalize: 'none', textContentType: 'emailAddress' })}
      {In('address1', 'Street address *', { textContentType: 'streetAddressLine1' })}
      {In('address2', 'Suite / unit', { textContentType: 'streetAddressLine2' })}
      <View style={s.row}>{In('city', 'City *', {}, true)}{In('state', 'State *', { maxLength: 2, autoCapitalize: 'characters' }, true)}{In('zip', 'ZIP *', { keyboardType: 'number-pad', maxLength: 10 }, true)}</View>
      {In('cuisine', 'Cuisine *')}
      {In('desc', 'Tell us about your restaurant *', { multiline: true, style: [s.input, { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' }] })}
      {In('offer', 'Proposed member offer', { placeholder: 'e.g. 15% off food, Mon–Thu' })}
      {err ? <Note tone="err">{err}</Note> : null}
      <Button title="Submit application" onPress={submit} busy={busy} />
      <Button title="Cancel" kind="ghost" style={{ borderColor: 'transparent' }} onPress={() => { setOpen(false); setErr(null); }} />
    </Card>
  );
}

const s = StyleSheet.create({
  h: { fontSize: 20, fontWeight: '800', color: C.bayou },
  label: { fontSize: 15, fontWeight: '600', color: C.bayou },
  row: { flexDirection: 'row', gap: 10 },
  input: { minHeight: 50, borderWidth: 1.5, borderColor: '#CFC7B8', borderRadius: 14, paddingHorizontal: 14, fontSize: 16, backgroundColor: C.card, color: C.bayou },
});
