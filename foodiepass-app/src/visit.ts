import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from './supabase';
import { CONFIG } from './config';
import type { Restaurant } from './data';

// A visit = the member pass opened for one restaurant. It closes after CONFIG.passMinutes or when staff confirm it.
// Name and offer are copied in so the pass still shows if the directory hasn't loaded yet.
export type Visit = { rid: string; name: string; offer: string; district: string; openedAt: number; confirmedAt: number | null; code: string | null };
const KEY = 'fp-visit';

export async function loadVisit(): Promise<Visit | null> {
  try { const v = await AsyncStorage.getItem(KEY); return v ? (JSON.parse(v) as Visit) : null; } catch { return null; }
}
export async function saveVisit(v: Visit | null) {
  if (v) await AsyncStorage.setItem(KEY, JSON.stringify(v)); else await AsyncStorage.removeItem(KEY);
}
/** Open the pass for one restaurant (paid members only; callers check membership first). */
export async function openVisit(r: Pick<Restaurant, 'id' | 'name' | 'offer' | 'district'>) {
  await saveVisit({ rid: r.id, name: r.name, offer: r.offer, district: r.district, openedAt: Date.now(), confirmedAt: null, code: null });
  router.push('/visit');
}
export const msLeft = (v: Visit) => CONFIG.passMinutes * 60000 - (Date.now() - v.openedAt);
export const isExpired = (v: Visit) => !v.confirmedAt && msLeft(v) <= 0;

export type ConfirmResult = { ok: true; visit: Visit } | { ok: false; message: string };

/** Staff typed the restaurant's 4-digit PIN. The server checks it, records the visit and returns the visit code. */
export async function confirmVisit(v: Visit, pin: string): Promise<ConfirmResult> {
  if (!/^\d{4}$/.test(pin)) return { ok: false, message: 'Enter the 4-digit staff PIN.' };
  const { data, error } = await supabase.rpc('confirm_visit', { p_restaurant: v.rid, p_pin: pin, p_opened_at: new Date(v.openedAt).toISOString() });
  const out = (error ? { status: 'error' } : data) as { status: string; code?: string; confirmed_at?: string; tries_left?: number };
  if (out.status === 'ok' && out.code) {
    const done: Visit = { ...v, confirmedAt: Date.parse(out.confirmed_at ?? '') || Date.now(), code: out.code };
    await saveVisit(done);
    return { ok: true, visit: done };
  }
  const messages: Record<string, string> = {
    wrong_pin: 'That PIN isn’t right.' + (out.tries_left ? ` ${out.tries_left} tries left.` : ''),
    locked: 'Too many wrong PINs. This pass is locked for 15 minutes.',
    no_pin: 'This restaurant hasn’t set a staff PIN yet. Ask the manager to set one on their owner page.',
    not_member: 'Your membership isn’t active right now.',
    not_found: 'This restaurant isn’t taking LocalScout right now.',
  };
  return { ok: false, message: messages[out.status] ?? 'We couldn’t confirm the visit. Check your connection and try again.' };
}
