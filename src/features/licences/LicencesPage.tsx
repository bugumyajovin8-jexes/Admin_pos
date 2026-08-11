import { useMemo, useState } from 'react';
import { Search, CalendarDays, Ban, Loader2, AlertTriangle } from 'lucide-react';
import {
  formatDate, extendedExpiryDays, toDateInputValue,
} from '../../lib/tenants';
import type { Tenant } from '../../lib/tenants';
import { applyExpiry, suspendChurch, reactivateChurch } from '../tenants/useTenants';

/**
 * Every church on one row: name, expiry, and the three actions an operator
 * actually performs. Deliberately flat — no drilling in to renew a customer.
 */
export default function LicencesPage({ tenants, onChanged }: { tenants: Tenant[]; onChanged: () => void }) {
  const [query, setQuery] = useState('');
  /** churchId currently being written, so only that row shows a spinner. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Row whose calendar is open, and the date chosen in it. */
  const [calendarFor, setCalendarFor] = useState<Tenant | null>(null);
  const [dateInput, setDateInput] = useState('');
  /** Row awaiting block confirmation. Blocking cuts a customer off mid-service,
   *  so it asks; unblocking restores access and does not. */
  const [confirmBlock, setConfirmBlock] = useState<Tenant | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants
      .filter((t) => !q || t.name.toLowerCase().includes(q) || (t.pastorName || '').toLowerCase().includes(q))
      .sort((a, b) => (a.daysRemaining ?? Number.MAX_SAFE_INTEGER) - (b.daysRemaining ?? Number.MAX_SAFE_INTEGER));
  }, [tenants, query]);

  const run = async (churchId: string, fn: () => Promise<string | null>) => {
    setBusyId(churchId);
    setError(null);
    const err = await fn();
    setBusyId(null);
    setCalendarFor(null);
    setConfirmBlock(null);
    if (err) {
      setError(err);
      return;
    }
    // Re-read: the stored expiry is the one that counts, not one guessed here.
    onChanged();
  };

  const extend30 = (t: Tenant) =>
    run(t.churchId, () =>
      applyExpiry(t.churchId, t.name, t.status !== 'none', extendedExpiryDays(t.expiresAt, 30)));

  const openCalendar = (t: Tenant) => {
    setDateInput(toDateInputValue(t.expiresAt) || toDateInputValue(new Date().toISOString()));
    setCalendarFor(t);
  };

  const saveDate = (t: Tenant) =>
    run(t.churchId, () => applyExpiry(t.churchId, t.name, t.status !== 'none', new Date(dateInput)));

  const toggleBlock = (t: Tenant) => {
    if (t.status === 'suspended') return run(t.churchId, () => reactivateChurch(t.churchId));
    setConfirmBlock(t);
  };

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700,
    color: 'var(--color-text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.06em', whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, verticalAlign: 'middle' };

  const actionBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 11px', borderRadius: 8, fontSize: 12,
    fontFamily: 'var(--font-display)', fontWeight: 700,
    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', cursor: 'pointer', whiteSpace: 'nowrap',
  };

  return (
    <div className="p-5 max-w-[1100px] mx-auto">
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>
        Licences
      </h1>
      <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 16px' }}>
        Soonest to expire first.
      </p>

      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 14 }}>
        <Search size={15} style={{ position: 'absolute', left: 13, top: 12, color: 'var(--color-text-muted)' }} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search church or pastor…"
          aria-label="Search churches"
          style={{
            width: '100%', padding: '10px 12px 10px 38px', borderRadius: 10,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            color: 'var(--color-text)', fontSize: 13.5, outline: 'none',
          }}
        />
      </div>

      {error && (
        <p
          role="alert"
          style={{
            padding: '10px 12px', borderRadius: 9, fontSize: 12.5, marginBottom: 14,
            background: 'color-mix(in srgb, var(--color-rose) 12%, transparent)',
            color: 'var(--color-rose)',
          }}
        >
          {error}
        </p>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr style={{ background: 'var(--color-ink-800)' }}>
                <th style={th}>Church</th>
                <th style={th}>Expiry date</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const busy = busyId === t.churchId;
                const blocked = t.status === 'suspended';
                // Colour carries the state, so the row stays three columns:
                // rose = lapsed or blocked, gold = expiring, dim = fine.
                const expiryColour =
                  blocked || t.status === 'expired' || t.status === 'none'
                    ? 'var(--color-rose)'
                    : t.expiringSoon
                      ? 'var(--color-gold)'
                      : 'var(--color-text-dim)';

                return (
                  <tr key={t.churchId} style={{ borderTop: '1px solid var(--color-border)', opacity: busy ? 0.55 : 1 }}>
                    <td style={td}>
                      <span style={{ fontWeight: 600 }}>{t.name}</span>
                      {t.pastorName && (
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {t.pastorName}
                        </span>
                      )}
                    </td>

                    <td className="tnum" style={{ ...td, color: expiryColour, whiteSpace: 'nowrap' }}>
                      {t.status === 'none' ? 'No licence' : formatDate(t.expiresAt)}
                      {blocked && (
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--color-rose)', marginTop: 2 }}>
                          blocked
                        </span>
                      )}
                    </td>

                    <td style={{ ...td, textAlign: 'right' }}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          disabled={busy}
                          onClick={() => extend30(t)}
                          title="Extend by 30 days"
                          style={{ ...actionBtn, color: 'var(--color-teal)' }}
                        >
                          {busy ? <Loader2 size={13} className="spin" /> : null}+30
                        </button>

                        <button
                          disabled={busy}
                          onClick={() => openCalendar(t)}
                          title="Choose an exact expiry date"
                          style={actionBtn}
                        >
                          <CalendarDays size={13} /> Extend
                        </button>

                        <button
                          disabled={busy || t.status === 'none'}
                          onClick={() => toggleBlock(t)}
                          title={
                            t.status === 'none'
                              ? 'No licence to block — this church already cannot write'
                              : blocked ? 'Unblock this church' : 'Block this church'
                          }
                          style={{
                            ...actionBtn,
                            color: blocked ? 'var(--color-on-accent)' : 'var(--color-rose)',
                            background: blocked ? 'var(--color-rose)' : actionBtn.background,
                            borderColor: blocked ? 'transparent' : 'var(--color-border)',
                            opacity: t.status === 'none' ? 0.4 : 1,
                            cursor: t.status === 'none' ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <Ban size={13} /> {blocked ? 'Blocked' : 'Block'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <p style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            No church matches that search.
          </p>
        )}
      </div>

      {/* Calendar */}
      {calendarFor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Set expiry for ${calendarFor.name}`}
          onClick={() => !busyId && setCalendarFor(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 20,
            background: 'rgba(8, 12, 20, 0.72)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-2xl p-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, margin: '0 0 4px' }}>
              {calendarFor.name}
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 14px' }}>
              Currently {calendarFor.status === 'none' ? 'no licence' : `expires ${formatDate(calendarFor.expiresAt)}`}.
            </p>

            <input
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              aria-label="New expiry date"
              style={{
                width: '100%', padding: '11px 13px', borderRadius: 10, fontSize: 13.5,
                background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                color: 'var(--color-text)', colorScheme: 'dark', marginBottom: 6,
              }}
            />
            {dateInput && new Date(dateInput).getTime() < Date.now() && (
              <p style={{ fontSize: 11.5, color: 'var(--color-gold)', margin: '0 0 8px' }}>
                That date is in the past — the church becomes read-only at once.
              </p>
            )}

            <div className="flex justify-end gap-2 mt-3">
              <button
                disabled={Boolean(busyId)}
                style={{ ...actionBtn, padding: '9px 14px', background: 'transparent' }}
                onClick={() => setCalendarFor(null)}
              >
                Cancel
              </button>
              <button
                disabled={Boolean(busyId) || !dateInput}
                onClick={() => saveDate(calendarFor)}
                style={{
                  ...actionBtn, padding: '9px 14px',
                  background: 'var(--color-teal)', color: 'var(--color-on-accent)',
                  borderColor: 'transparent', opacity: !dateInput ? 0.5 : 1,
                }}
              >
                {busyId ? <Loader2 size={13} className="spin" /> : null} Save expiry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block confirmation */}
      {confirmBlock && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Block ${confirmBlock.name}`}
          onClick={() => !busyId && setConfirmBlock(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 20,
            background: 'rgba(8, 12, 20, 0.72)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] rounded-2xl p-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-start gap-3 mb-2">
              <AlertTriangle size={18} style={{ color: 'var(--color-rose)', flexShrink: 0, marginTop: 2 }} />
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, margin: 0 }}>
                Block {confirmBlock.name}?
              </h3>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-dim)', lineHeight: 1.65, margin: '0 0 18px' }}>
              Its staff are locked out of the Pastor app immediately. Members keep read access to their own
              receipts, and the time left on the licence is preserved, so unblocking restores it.
            </p>
            <div className="flex justify-end gap-2">
              <button
                disabled={Boolean(busyId)}
                style={{ ...actionBtn, padding: '9px 14px', background: 'transparent' }}
                onClick={() => setConfirmBlock(null)}
              >
                Cancel
              </button>
              <button
                disabled={Boolean(busyId)}
                onClick={() => run(confirmBlock.churchId, () => suspendChurch(confirmBlock.churchId))}
                style={{
                  ...actionBtn, padding: '9px 14px',
                  background: 'var(--color-rose)', color: 'var(--color-on-accent)',
                  borderColor: 'transparent',
                }}
              >
                {busyId ? <Loader2 size={13} className="spin" /> : null} Block church
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
