import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
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

function code(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = Crypto.getRandomBytes(6);
  return Array.from(b, (x) => a[x % a.length]).join('');
}

/** Staff swiped: mark used, then record it. Members can only insert while their membership is active (RLS enforces it). */
export async function confirmVisit(v: Visit): Promise<Visit> {
  const done: Visit = { ...v, confirmedAt: Date.now(), code: code() };
  await saveVisit(done);
  const { error } = await supabase.from('redemptions').insert({
    restaurant_id: v.rid, restaurant_name: v.name || null, offer: v.offer || null, code: done.code,
    opened_at: new Date(v.openedAt).toISOString(), confirmed_at: new Date(done.confirmedAt!).toISOString(),
  });
  if (error) console.warn('LocalScout: visit not recorded', error.message);
  return done;
}
