import { Link } from 'react-router-dom';
import { Church, Users, Coins, AlertTriangle, Ban, FileWarning, ArrowRight } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { formatMoney, formatDate, EXPIRING_SOON_DAYS } from '../../lib/tenants';
import type { Tenant, Totals } from '../../lib/tenants';

function Stat({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: any;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
        >
          <Icon size={16} />
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
      </div>
      <p className="tnum" style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>{sub}</p>}
    </div>
  );
}

export default function Dashboard({ tenants, totals }: { tenants: Tenant[]; totals: Totals | null }) {
  if (!totals) return null;

  // One list, ordered by urgency: no licence at all, then blocked, then already
  // expired, then running out. Anything healthy is deliberately absent — this
  // panel exists to be emptied, not browsed.
  const rank = (t: Tenant) =>
    t.status === 'none' ? 0 : t.status === 'suspended' ? 1 : t.status === 'expired' ? 2 : 3;

  const needsAttention = tenants
    .filter((t) => t.status !== 'active' || t.expiringSoon)
    .sort((a, b) => rank(a) - rank(b) || (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0));

  return (
    <div className="p-5 max-w-[1200px] mx-auto">
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>
        Overview
      </h1>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px' }}>
        Every church on the platform and the state of its licence.
      </p>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <Stat label="Churches" value={String(totals.churches)} icon={Church} color="var(--color-sky)"
              sub={`${totals.active} with a live licence`} />
        <Stat label="Members" value={formatMoney(totals.members)} icon={Users} color="var(--color-violet)"
              sub="across all churches" />
        <Stat label="Giving recorded" value={`TZS ${formatMoney(totals.totalGiving)}`} icon={Coins} color="var(--color-teal)"
              sub="all time" />
        <Stat label="Need attention" value={String(needsAttention.length)} icon={AlertTriangle} color="var(--color-gold)"
              sub={`expiring, expired, blocked or unlicensed`} />
      </div>

      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <Stat label={`Expiring ≤${EXPIRING_SOON_DAYS}d`} value={String(totals.expiringSoon)} icon={AlertTriangle} color="var(--color-gold)" />
        <Stat label="Expired" value={String(totals.expired)} icon={AlertTriangle} color="var(--color-rose)" />
        <Stat label="Blocked" value={String(totals.suspended)} icon={Ban} color="var(--color-rose)" />
        <Stat label="No licence row" value={String(totals.unlicensed)} icon={FileWarning} color="var(--color-text-muted)" />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, margin: 0 }}>
            Needs attention
          </h2>
          <Link to="/churches" className="flex items-center gap-1.5" style={{ fontSize: 12.5, color: 'var(--color-sky)', textDecoration: 'none' }}>
            All churches <ArrowRight size={13} />
          </Link>
        </div>

        {needsAttention.length === 0 ? (
          <p style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            Nothing to chase — every church has a live licence.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {needsAttention.slice(0, 12).map((t) => (
              <li key={t.churchId} style={{ borderTop: '1px solid var(--color-border)' }}>
                <Link
                  to={`/churches/${t.churchId}`}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>{t.name}</p>
                    <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                      {t.pastorName || t.pastorEmail || 'no pastor on record'}
                      {t.location ? ` · ${t.location}` : ''}
                    </p>
                  </div>
                  <span className="tnum hidden sm:block" style={{ fontSize: 12, color: 'var(--color-text-dim)', minWidth: 120, textAlign: 'right' }}>
                    {t.status === 'none' ? '—' : formatDate(t.expiresAt)}
                  </span>
                  <StatusBadge status={t.status} expiringSoon={t.expiringSoon} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
