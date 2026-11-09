import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Districts and restaurants live in Supabase (same queries as the website); the website's admin panel adds them.
export type District = { id: string; name: string; lat: number; lng: number; live: boolean };
export type Restaurant = {
  id: string; name: string; district: string; place: string; cuisine: string; desc: string; offer: string;
  dineIn: boolean; pickup: boolean; isNew: boolean; founding: boolean; featured: boolean; price: number;
  lat: number | null; lng: number | null; photo: string | null;
  address: string | null; hours: string | null; phone: string | null; website: string | null;
};
export type Directory = { districts: District[]; restaurants: Restaurant[]; loading: boolean; error: boolean; reload: () => void };

const NEW_DAYS = 30;
let cache: Promise<{ districts: District[]; restaurants: Restaurant[] }> | null = null;
let districtNames: Record<string, string> = {};
let byId: Record<string, Restaurant> = {};

const httpUrl = (u: unknown) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

async function fetchDirectory() {
  const [d, r] = await Promise.all([
    supabase.from('districts').select('id, name, lat, lng, live').order('sort_order'),
    supabase.from('restaurants')
      .select('id, name, description, cuisine, district_id, city, state, address, hours, phone, website_url, lat, lng, price_level, dine_in, pickup, offer_text, founding_until, listed_at, featured, photo_url')
      .eq('status', 'active').order('name'),
  ]);
  if (d.error) throw d.error;
  if (r.error) throw r.error;
  const districts = (d.data ?? []) as District[];
  districtNames = Object.fromEntries(districts.map((x) => [x.id, x.name]));
  const now = Date.now();
  const restaurants: Restaurant[] = (r.data ?? []).map((x) => ({
    id: String(x.id), name: x.name ?? 'Restaurant', district: x.district_id ?? '', place: [x.city, x.state].filter(Boolean).join(', '), cuisine: x.cuisine ?? '', desc: x.description ?? '',
    offer: x.offer_text || 'Member offer coming soon',
    dineIn: x.dine_in !== false, pickup: !!x.pickup, featured: !!x.featured,
    isNew: !!x.listed_at && now - Date.parse(x.listed_at) < NEW_DAYS * 86400000,
    founding: !!x.founding_until && Date.parse(x.founding_until) > now,
    price: Math.max(1, Math.min(4, Number(x.price_level) || 2)), lat: x.lat ?? null, lng: x.lng ?? null,
    photo: httpUrl(x.photo_url), address: x.address ?? null, hours: x.hours ?? null, phone: x.phone ?? null, website: httpUrl(x.website_url),
  }));
  restaurants.sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
  byId = Object.fromEntries(restaurants.map((x) => [x.id, x]));
  return { districts, restaurants };
}

export const districtName = (id: string) => districtNames[id] ?? '';
export const findRestaurant = (id: string): Restaurant | null => byId[id] ?? null;

/** Loads once per app launch; a failed load is retried the next time a screen asks, or on reload(). */
export function useDirectory(): Directory {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<Omit<Directory, 'reload'>>({ districts: [], restaurants: [], loading: true, error: false });
  useEffect(() => {
    let alive = true;
    if (!cache) cache = fetchDirectory();
    setState((s) => ({ ...s, loading: true }));
    cache.then(
      (v) => { if (alive) setState({ ...v, loading: false, error: false }); },
      () => { cache = null; if (alive) setState((s) => ({ ...s, loading: false, error: true })); },
    );
    return () => { alive = false; };
  }, [nonce]);
  return { ...state, reload: () => { cache = null; setNonce((n) => n + 1); } };
}
