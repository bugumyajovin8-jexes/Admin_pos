/**
 * Shapes the raw tables into the per-church view an operator actually works
 * with, and owns every licence calculation.
 *
 * Kept out of the components so the arithmetic can be reasoned about — and
 * changed — without touching layout, and so "how many days left" has exactly
 * one definition in this app.
 */

export type LicenceStatus = 'active' | 'expired' | 'suspended' | 'none';

export interface Tenant {
  churchId: string;
  name: string;
  location: string | null;
  pastorId: string | null;
  pastorName: string | null;
  pastorEmail: string | null;

  status: LicenceStatus;
  /** Server-computed. Null when the church has no licence row at all. */
  isActive: boolean | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  updatedAt: string | null;

  members: number;
  contributions: number;
  totalGiving: number;
  treasurers: number;

  /** True when the licence is fine but close enough to need chasing. */
  expiringSoon: boolean;
}

export interface Totals {
  churches: number;
  active: number;
  expiringSoon: number;
  expired: number;
  suspended: number;
  unlicensed: number;
  members: number;
  totalGiving: number;
}

/** Inside this many days, a live licence counts as needing attention. */
export const EXPIRING_SOON_DAYS = 14;

export interface RawData {
  churches: any[];
  licences: any[];
  profiles: any[];
  congregants: any[];
  contributions: any[];
  userChurches: any[];
}

export function buildTenants(raw: RawData): Tenant[] {
  const licenceByChurch = new Map<string, any>();
  (raw.licences || []).forEach((l) => l?.church_id && licenceByChurch.set(l.church_id, l));

  const profileById = new Map<string, any>();
  (raw.profiles || []).forEach((p) => p?.id && profileById.set(p.id, p));

  const memberCount = new Map<string, number>();
  (raw.congregants || []).forEach((c) => {
    if (!c?.church_id) return;
    memberCount.set(c.church_id, (memberCount.get(c.church_id) || 0) + 1);
  });

  const givingCount = new Map<string, number>();
  const givingTotal = new Map<string, number>();
  (raw.contributions || []).forEach((c) => {
    if (!c?.church_id) return;
    givingCount.set(c.church_id, (givingCount.get(c.church_id) || 0) + 1);
    givingTotal.set(c.church_id, (givingTotal.get(c.church_id) || 0) + (parseFloat(c.amount) || 0));
  });

  const treasurerCount = new Map<string, number>();
  (raw.userChurches || []).forEach((uc) => {
    if (uc?.role_in_church !== 'mhazini' || !uc.church_id) return;
    treasurerCount.set(uc.church_id, (treasurerCount.get(uc.church_id) || 0) + 1);
  });

  return (raw.churches || []).map((ch) => {
    const lic = licenceByChurch.get(ch.id);
    const pastor = ch.pastor_id ? profileById.get(ch.pastor_id) : null;

    // No licence row is its own state, not "expired". church_licence_active()
    // treats it as inactive and blocks writes, so it needs to be visible and
    // fixable rather than blending in with lapsed customers.
    let status: LicenceStatus = 'none';
    if (lic) {
      if (lic.status === 'suspended') status = 'suspended';
      else if (lic.is_active) status = 'active';
      else status = 'expired';
    }

    const daysRemaining = lic && typeof lic.days_remaining === 'number' ? lic.days_remaining : null;

    return {
      churchId: ch.id,
      name: ch.name || '(unnamed)',
      location: ch.location ?? null,
      pastorId: ch.pastor_id ?? null,
      pastorName: pastor?.full_name ?? null,
      pastorEmail: pastor?.email ?? null,

      status,
      isActive: lic ? Boolean(lic.is_active) : null,
      expiresAt: lic?.expires_at ?? null,
      daysRemaining,
      updatedAt: lic?.updated_at ?? null,

      members: memberCount.get(ch.id) || 0,
      contributions: givingCount.get(ch.id) || 0,
      totalGiving: givingTotal.get(ch.id) || 0,
      treasurers: treasurerCount.get(ch.id) || 0,

      expiringSoon: status === 'active' && daysRemaining !== null && daysRemaining <= EXPIRING_SOON_DAYS,
    };
  });
}

export function summarise(tenants: Tenant[]): Totals {
  return {
    churches: tenants.length,
    active: tenants.filter((t) => t.status === 'active').length,
    expiringSoon: tenants.filter((t) => t.expiringSoon).length,
    expired: tenants.filter((t) => t.status === 'expired').length,
    suspended: tenants.filter((t) => t.status === 'suspended').length,
    unlicensed: tenants.filter((t) => t.status === 'none').length,
    members: tenants.reduce((s, t) => s + t.members, 0),
    totalGiving: tenants.reduce((s, t) => s + t.totalGiving, 0),
  };
}

/**
 * The new expiry when extending a licence by whole months.
 *
 * Counts from the LATER of now and the current expiry. Renewing early would
 * otherwise throw away the time already paid for, and renewing something that
 * lapsed months ago would land the new date in the past — both are ways to
 * quietly cheat a customer, in opposite directions.
 */
export function extendedExpiry(currentExpiry: string | null, months: number, now: Date = new Date()): Date {
  const current = currentExpiry ? new Date(currentExpiry) : null;
  const base = current && current.getTime() > now.getTime() ? current : now;
  const next = new Date(base.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

/**
 * The new expiry when extending by a number of DAYS.
 *
 * Same rule as the monthly version: count from the later of now and the current
 * expiry, so renewing early keeps the time already paid for and renewing
 * something long lapsed does not land the new date in the past.
 */
export function extendedExpiryDays(currentExpiry: string | null, days: number, now: Date = new Date()): Date {
  const current = currentExpiry ? new Date(currentExpiry) : null;
  const base = current && current.getTime() > now.getTime() ? current : now;
  return new Date(base.getTime() + days * 86400000);
}

/** yyyy-mm-dd in LOCAL time, for <input type="date">. Using toISOString() here
 *  would shift the date by a day for anyone east or west of UTC. */
export function toDateInputValue(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(value || 0));
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
