import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarPlus, CalendarCheck, Ban, Play, FilePlus2,
  Users, Wallet, Receipt, UserCog, Loader2, AlertTriangle,
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { formatMoney, formatDate, formatDateTime, extendedExpiry } from '../../lib/tenants';
import type { Tenant } from '../../lib/tenants';
import {
  extendLicence, setExpiry, suspendChurch, reactivateChurch, issueLicence,
} from '../tenants/useTenants';

const EXTENSIONS = [1, 3, 6, 12];

/** Actions that change what a paying customer can do are confirmed, not fired
 *  on a single click. Blocking a church stops its staff mid-service. */
type Pending =
  | { kind: 'suspend' }
  | { kind: 'reactivate' }
  | { kind: 'extend'; months: number }
  | { kind: 'issue'; months: number }
  | { kind: 'expiry'; date: string }
  | null;

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
        <Icon size={13} />
        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
      </div>
      <p className="tnum" style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, margin: 0 }}>
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-2.5"
      style={{ borderTop: '1px solid var(--color-border)' }}
    >
      <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export default function ChurchDetail({ tenants, onChanged }: { tenants: Tenant[]; onChanged: () => void }) {
  const { churchId } = useParams();
  const tenant = useMemo(() => tenants.find((t) => t.churchId === churchId), [tenants, churchId]);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [dateInput, setDateInput] = useState('');
  const [pending, setPending] = useState<Pending>(null);

  if (!tenant) {
    return (
      <div className="p-5 max-w-[900px] mx-auto">
        <Link to="/churches" style={{ color: 'var(--color-text-muted)', fontSize: 13, textDecoration: 'none' }}>
          <ArrowLeft size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> Back to churches
        </Link>
        <p style={{ marginTop: 20, fontSize: 13.5, color: 'var(--color-text-dim)' }}>
          That church is not in the loaded data. It may have been deleted — reload from the header.
        </p>
      </div>
    );
  }

  const run = async (fn: () => Promise<string | null>, okText: string) => {
    setBusy(true);
    setMessage(null);
    const err = await fn();
    setBusy(false);
    setPending(null);

    if (err) {
      // A denied write here is the policy talking, not a bug. licenses_* require
      // is_superadmin(), so the usual cause is an account that lost the role.
      setMessage({ tone: 'bad', text: err });
      return;
    }
    setMessage({ tone: 'ok', text: okText });
    // Re-read rather than patching local state: the expiry the DATABASE stored
    // is the one that matters, and guessing it here is how a console starts
    // disagreeing with the product it administers.
    onChanged();
  };

  const describe = (p: NonNullable<Pending>): { title: string; body: string; confirm: string; danger: boolean } => {
    switch (p.kind) {
      case 'suspend':
        return {
          title: `Block ${tenant.name}?`,
          body: 'Staff are locked out of the Pastor app immediately — no recording giving, no adding members. Members keep read access to their own receipts. Time left on the licence is preserved, so unblocking restores it.',
          confirm: 'Block church',
          danger: true,
        };
      case 'reactivate':
        return {
          title: `Unblock ${tenant.name}?`,
          body:
            tenant.daysRemaining !== null && tenant.daysRemaining <= 0
              ? 'The licence had already lapsed, so the church becomes read-only rather than fully active. Extend it as well to restore writing.'
              : 'Staff regain full access straight away.',
          confirm: 'Unblock church',
          danger: false,
        };
      case 'extend':
        return {
          title: `Extend by ${p.months} month${p.months > 1 ? 's' : ''}?`,
          body: `New expiry: ${formatDate(extendedExpiry(tenant.expiresAt, p.months).toISOString())}. Counted from whichever is later — today or the current expiry — so nothing already paid for is lost.`,
          confirm: 'Extend licence',
          danger: false,
        };
      case 'issue':
        return {
          title: `Issue a ${p.months}-month licence?`,
          body: `This church has no licence row, so its staff currently cannot write anything. New expiry: ${formatDate(extendedExpiry(null, p.months).toISOString())}.`,
          confirm: 'Issue licence',
          danger: false,
        };
      case 'expiry':
        return {
          title: 'Set an exact expiry date?',
          body: `The licence will be set active and expire on ${formatDate(new Date(p.date).toISOString())}. A date in the past makes the church read-only at once.`,
          confirm: 'Set expiry',
          danger: new Date(p.date).getTime() < Date.now(),
        };
    }
  };

  const perform = (p: NonNullable<Pending>) => {
    switch (p.kind) {
      case 'suspend':
        return run(() => suspendChurch(tenant.churchId), `${tenant.name} is blocked.`);
      case 'reactivate':
        return run(() => reactivateChurch(tenant.churchId), `${tenant.name} is unblocked.`);
      case 'extend':
        return run(() => extendLicence(tenant.churchId, tenant.expiresAt, p.months), `Extended by ${p.months} month${p.months > 1 ? 's' : ''}.`);
      case 'issue':
        return run(() => issueLicence(tenant.churchId, tenant.name, p.months), `Licence issued for ${p.months} months.`);
      case 'expiry':
        return run(() => setExpiry(tenant.churchId, p.date), 'Expiry updated.');
    }
  };

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px',
    borderRadius: 10, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12.5,
    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.55 : 1,
  };

  const hasLicence = tenant.status !== 'none';
  const dialog = pending ? describe(pending) : null;

  return (
    <div className="p-5 max-w-[900px] mx-auto">
      <Link to="/churches" style={{ color: 'var(--color-text-muted)', fontSize: 13, textDecoration: 'none' }}>
        <ArrowLeft size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> Back to churches
      </Link>

      <div className="flex flex-wrap items-center gap-3 mt-3 mb-5">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: 0 }}>
          {tenant.name}
        </h1>
        <StatusBadge status={tenant.status} expiringSoon={tenant.expiringSoon} />
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Stat icon={Users} label="Members" value={formatMoney(tenant.members)} />
        <Stat icon={Receipt} label="Contributions" value={formatMoney(tenant.contributions)} />
        <Stat icon={Wallet} label="Giving (TZS)" value={formatMoney(tenant.totalGiving)} />
        <Stat icon={UserCog} label="Treasurers" value={formatMoney(tenant.treasurers)} />
      </div>

      <div
        className="rounded-2xl p-4 mb-5"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>
          Church
        </h2>
        <Row label="Pastor" value={tenant.pastorName || <span style={{ color: 'var(--color-text-muted)' }}>not on record</span>} />
        <Row label="Pastor e-mail" value={tenant.pastorEmail || '—'} />
        <Row label="Location" value={tenant.location || '—'} />
        <Row label="Church ID" value={<code style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{tenant.churchId}</code>} />
      </div>

      <div
        className="rounded-2xl p-4"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>
          Licence
        </h2>
        <Row label="Status" value={<StatusBadge status={tenant.status} expiringSoon={tenant.expiringSoon} />} />
        <Row
          label="Days remaining"
          value={
            <span className="tnum" style={{ color: tenant.expiringSoon ? 'var(--color-gold)' : undefined }}>
              {hasLicence ? tenant.daysRemaining ?? '—' : '—'}
            </span>
          }
        />
        <Row label="Expires" value={<span className="tnum">{formatDate(tenant.expiresAt)}</span>} />
        <Row label="Last changed" value={<span className="tnum">{formatDateTime(tenant.updatedAt)}</span>} />

        {message && (
          <p
            role="status"
            style={{
              marginTop: 14, marginBottom: 0, padding: '10px 12px', borderRadius: 9, fontSize: 12.5,
              background: message.tone === 'ok'
                ? 'color-mix(in srgb, var(--color-teal) 12%, transparent)'
                : 'color-mix(in srgb, var(--color-rose) 12%, transparent)',
              color: message.tone === 'ok' ? 'var(--color-teal)' : 'var(--color-rose)',
            }}
          >
            {message.text}
          </p>
        )}

        {!hasLicence ? (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-dim)', margin: '0 0 10px' }}>
              This church has no licence row, so <strong>its staff cannot write anything</strong> — that is how
              <code> church_licence_active()</code> treats a missing licence.
            </p>
            <div className="flex flex-wrap gap-2">
              {EXTENSIONS.map((m) => (
                <button key={m} disabled={busy} style={btn} onClick={() => setPending({ kind: 'issue', months: m })}>
                  <FilePlus2 size={14} /> Issue {m} month{m > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
                Extend
              </p>
              <div className="flex flex-wrap gap-2">
                {EXTENSIONS.map((m) => (
                  <button key={m} disabled={busy} style={btn} onClick={() => setPending({ kind: 'extend', months: m })}>
                    <CalendarPlus size={14} /> +{m} month{m > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
                Or set an exact date
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  aria-label="Exact expiry date"
                  style={{
                    padding: '9px 12px', borderRadius: 10, fontSize: 12.5,
                    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text)', colorScheme: 'dark',
                  }}
                />
                <button
                  disabled={busy || !dateInput}
                  style={{ ...btn, opacity: busy || !dateInput ? 0.45 : 1, cursor: !dateInput ? 'not-allowed' : btn.cursor }}
                  onClick={() => dateInput && setPending({ kind: 'expiry', date: dateInput })}
                >
                  <CalendarCheck size={14} /> Set expiry
                </button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
                Access
              </p>
              {tenant.status === 'suspended' ? (
                <button
                  disabled={busy}
                  style={{ ...btn, color: 'var(--color-teal)' }}
                  onClick={() => setPending({ kind: 'reactivate' })}
                >
                  <Play size={14} /> Unblock church
                </button>
              ) : (
                <button
                  disabled={busy}
                  style={{ ...btn, color: 'var(--color-rose)' }}
                  onClick={() => setPending({ kind: 'suspend' })}
                >
                  <Ban size={14} /> Block church
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {dialog && pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={dialog.title}
          onClick={() => !busy && setPending(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 20,
            background: 'rgba(8, 12, 20, 0.72)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] rounded-2xl p-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-start gap-3 mb-2">
              {dialog.danger && <AlertTriangle size={18} style={{ color: 'var(--color-rose)', flexShrink: 0, marginTop: 2 }} />}
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, margin: 0 }}>
                {dialog.title}
              </h3>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-dim)', lineHeight: 1.65, margin: '0 0 18px' }}>
              {dialog.body}
            </p>
            <div className="flex justify-end gap-2">
              <button disabled={busy} style={{ ...btn, background: 'transparent' }} onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                disabled={busy}
                style={{
                  ...btn,
                  background: dialog.danger ? 'var(--color-rose)' : 'var(--color-teal)',
                  color: 'var(--color-on-accent)',
                  borderColor: 'transparent',
                }}
                onClick={() => perform(pending)}
              >
                {busy ? <Loader2 size={14} className="spin" /> : null}
                {dialog.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
