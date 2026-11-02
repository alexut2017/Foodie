import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getConfig, getStatus, type BillingStatus } from './billing';

type Ctx = {
  ready: boolean;
  session: Session | null;
  name: string;
  email: string;
  phone: string;
  profileDone: boolean;          // name + email collected (step 3 of sign-up)
  onboarded: boolean;            // location step seen
  paid: boolean;                 // membership active (server-verified)
  paymentsOpen: boolean | null;  // server functions + Stripe prices configured
  status: BillingStatus | null;
  refresh: () => Promise<void>;
  markOnboarded: () => Promise<void>;
  signOut: (everywhere?: boolean) => Promise<void>;
};

const SessionCtx = createContext<Ctx | null>(null);
const ONBOARD_KEY = 'fp-onboarded';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [paymentsOpen, setPaymentsOpen] = useState<boolean | null>(null);

  const loadStatus = useCallback(async (s: Session | null) => {
    if (!s) { setStatus(null); return; }
    try { setStatus(await getStatus()); } catch { setStatus(null); }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data }, ob] = await Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(ONBOARD_KEY)]);
      if (!alive) return;
      setSession(data.session);
      setOnboarded(ob === '1');
      setReady(true);
      loadStatus(data.session);
      getConfig().then((c) => setPaymentsOpen(!!c.checkout_enabled && c.offerings.length > 0)).catch(() => setPaymentsOpen(false));
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => { setSession(s); loadStatus(s); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadStatus]);

  const value = useMemo<Ctx>(() => {
    const u = session?.user;
    const md = (u?.user_metadata ?? {}) as Record<string, string>;
    const name = md.full_name || [md.first_name, md.last_name].filter(Boolean).join(' ');
    const email = u?.email || u?.new_email || md.contact_email || '';
    return {
      ready, session, name, email, phone: u?.phone ?? '',
      profileDone: !!name && !!email,
      onboarded,
      paid: !!status?.membership.active,
      paymentsOpen,
      status,
      refresh: () => loadStatus(session),
      markOnboarded: async () => { await AsyncStorage.setItem(ONBOARD_KEY, '1'); setOnboarded(true); },
      signOut: async (everywhere) => {
        await supabase.auth.signOut(everywhere ? { scope: 'global' } : undefined).catch(() => undefined);
        setStatus(null);
      },
    };
  }, [ready, session, onboarded, status, paymentsOpen, loadStatus]);

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  const c = useContext(SessionCtx);
  if (!c) throw new Error('useSession must be inside SessionProvider');
  return c;
}
