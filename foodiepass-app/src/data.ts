import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Districts and restaurants live in Supabase; the website's admin panel adds them.
export type District = { id: string; name: string; lat: number; lng: number; live: boolean };
export type Restaurant = {
  id: string; name: string; district: string; cuisine: string; desc: string; offer: string;
  dineIn: boolean; pickup: boolean; isNew: boolean; founding: boolean; price: number; lat: number; lng: number;
  address: string | null; hours: string | null; phone: string | null; website: string | null;
};
export type Directory = { districts: District[]; restaurants: Restaurant[]; loading: boolean; error: boolean };

const NEW_DAYS = 30;
let cache: Promise<{ districts: District[]; restaurants: Restaurant[] }> | null = null;
let districtNames: Record<string, string> = {};

async function fetchDirectory() {
  const [d, r] = await Promise.all([
    supabase.from('districts').select('id, name, lat, lng, live').order('sort_order'),
    supabase.from('restaurants')
      .select('id, name, description, cuisine, district_id, address, hours, phone, website_url, lat, lng, price_level, dine_in, pickup, offer_text, founding_until, listed_at')
      .eq('status', 'active').order('name'),
  ]);
  if (d.error) throw d.error;
  if (r.error) throw r.error;
  const districts = d.data as District[];
  districtNames = Object.fromEntries(districts.map((x) => [x.id, x.name]));
  const restaurants: Restaurant[] = (r.data ?? []).map((x) => ({
    id: x.id, name: x.name, district: x.district_id, cuisine: x.cuisine, desc: x.description, offer: x.offer_text,
    dineIn: x.dine_in, pickup: x.pickup,
    isNew: !!x.listed_at && Date.now() - Date.parse(x.listed_at) < NEW_DAYS * 86400000,
    founding: !!x.founding_until && Date.parse(x.founding_until) > Date.now(),
    price: x.price_level, lat: x.lat, lng: x.lng,
    address: x.address, hours: x.hours, phone: x.phone, website: x.website_url,
  }));
  return { districts, restaurants };
}

export const districtName = (id: string) => districtNames[id] ?? '';

/** Loads once per app launch; a failed load is retried the next time a screen asks. */
export function useDirectory(): Directory {
  const [state, setState] = useState<Directory>({ districts: [], restaurants: [], loading: true, error: false });
  useEffect(() => {
    let alive = true;
    if (!cache) cache = fetchDirectory();
    cache.then(
      (v) => { if (alive) setState({ ...v, loading: false, error: false }); },
      () => { cache = null; if (alive) setState((s) => ({ ...s, loading: false, error: true })); },
    );
    return () => { alive = false; };
  }, []);
  return state;
}
