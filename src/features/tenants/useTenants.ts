import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { buildTenants, summarise, extendedExpiry } from '../../lib/tenants';
import type { Tenant, Totals } from '../../lib/tenants';

/**
 * Loads the whole estate in one pass and reshapes it per church.
 *
 * The counts are aggregated in the browser rather than by the database. For a
 * few hundred churches that is one round trip and a few thousand rows — far
 * cheaper than a query per church. If this ever gets slow the fix is a
 * superadmin-only view doing the GROUP BY server-side; the components read
 * `Tenant`, so nothing above this file would change.
 */
export function useTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [chRes, licRes, prRes, cgRes, coRes, ucRes] = await Promise.all([
        supabase.from('churches').select('id, name, location, pastor_id'),
        // The view, never the raw table: is_active and days_remaining are
        // computed against the SERVER clock, so this console cannot be fooled
        // by the operator's own machine having the wrong date.
        supabase.from('licence_status').select('*'),
        supabase.from('profiles').select('id, email, full_name, role'),
        supabase.from('congregants').select('id, church_id'),
        supabase.from('contributions').select('church_id, amount'),
        supabase.from('user_churches').select('user_id, church_id, role_in_church'),
      ]);

      const failed = [chRes, licRes, prRes, cgRes, coRes, ucRes].find((r) => r.error);
      if (failed?.error) throw failed.error;

      const built = buildTenants({
        churches: chRes.data || [],
        licences: licRes.data || [],
        profiles: prRes.data || [],
        congregants: cgRes.data || [],
        contributions: coRes.data || [],
        userChurches: ucRes.data || [],
      });

      setTenants(built);
      setTotals(summarise(built));
      setServerTime((licRes.data || [])[0]?.server_time ?? null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { tenants, totals, serverTime, loading, error, reload: load };
}

// ---------------------------------------------------------------------------
// Licence actions
// ---------------------------------------------------------------------------
// Each returns an error string, or null on success. All are authorised by the
// licenses_* policies, which require is_superadmin() — the app is not what
// makes them safe.

/** Extends by whole months, counting from the later of now and current expiry. */
export async function extendLicence(churchId: string, currentExpiry: string | null, months: number): Promise<string | null> {
  const next = extendedExpiry(currentExpiry, months);
  const { error } = await supabase
    .from('licenses')
    .update({ status: 'active', expires_at: next.toISOString(), updated_at: new Date().toISOString() })
    .eq('church_id', churchId);
  return error?.message ?? null;
}

/** Sets an exact expiry date, for negotiated terms that are not whole months. */
export async function setExpiry(churchId: string, isoDate: string): Promise<string | null> {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return 'That date is not valid.';
  const { error } = await supabase
    .from('licenses')
    .update({ status: 'active', expires_at: d.toISOString(), updated_at: new Date().toISOString() })
    .eq('church_id', churchId);
  return error?.message ?? null;
}

/**
 * Blocks a church. The Pastor app treats 'suspended' as a full stop rather
 * than the read-only state a lapsed licence gets, and RLS refuses its writes
 * either way. The expiry is left untouched so unblocking restores whatever
 * time was left.
 */
export async function suspendChurch(churchId: string): Promise<string | null> {
  const { error } = await supabase
    .from('licenses')
    .update({ status: 'suspended', updated_at: new Date().toISOString() })
    .eq('church_id', churchId);
  return error?.message ?? null;
}

/** Lifts a block. Does NOT extend: if the licence had already lapsed it stays
 *  lapsed, which is the honest outcome — the caller is told to extend too. */
export async function reactivateChurch(churchId: string): Promise<string | null> {
  const { error } = await supabase
    .from('licenses')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('church_id', churchId);
  return error?.message ?? null;
}

/**
 * Sets an exact expiry, creating the licence row if the church has none.
 *
 * Backs the licences table, where one button has to work on every row. An
 * UPDATE against a church with no licence row matches nothing and returns no
 * error — the console would report success and change nothing, which is the
 * worst of both. So the caller passes whether a row exists and this picks.
 */
export async function applyExpiry(
  churchId: string,
  churchName: string,
  hasLicence: boolean,
  next: Date,
): Promise<string | null> {
  if (Number.isNaN(next.getTime())) return 'That date is not valid.';

  const fields = {
    status: 'active',
    expires_at: next.toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (hasLicence) {
    const { error } = await supabase.from('licenses').update(fields).eq('church_id', churchId);
    return error?.message ?? null;
  }

  const { error } = await supabase
    .from('licenses')
    .insert({ church_id: churchId, church_name: churchName, ...fields });
  return error?.message ?? null;
}

/** Issues a licence for a church that somehow has none. */
export async function issueLicence(churchId: string, churchName: string, months: number): Promise<string | null> {
  const next = extendedExpiry(null, months);
  const { error } = await supabase.from('licenses').insert({
    church_id: churchId,
    church_name: churchName,
    status: 'active',
    expires_at: next.toISOString(),
    updated_at: new Date().toISOString(),
  });
  return error?.message ?? null;
}
