import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { formatMoney, formatDate } from '../../lib/tenants';
import type { Tenant } from '../../lib/tenants';

type Filter = 'all' | 'active' | 'expiring' | 'expired' | 'suspended' | 'none';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'expiring', label: 'Expiring' },
  { id: 'expired', label: 'Expired' },
  { id: 'suspended', label: 'Blocked' },
  { id: 'none', label: 'No licence' },
];

export default function ChurchesPage({ tenants }: { tenants: Tenant[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants
      .filter((t) => {
        if (filter === 'expiring') return t.expiringSoon;
        if (filter === 'active') return t.status === 'active' && !t.expiringSoon;
        if (filter !== 'all') return t.status === filter;
        return true;
      })
      .filter((t) => {
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          (t.pastorName || '').toLowerCase().includes(q) ||
          (t.pastorEmail || '').toLowerCase().includes(q) ||
          (t.location || '').toLowerCase().includes(q)
        );
      })
      // Soonest to expire first — the operator's working order.
      .sort((a, b) => (a.daysRemaining ?? Number.MAX_SAFE_INTEGER) - (b.daysRemaining ?? Number.MAX_SAFE_INTEGER));
  }, [tenants, query, filter]);

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '10px 14px', fontSize: 11,
    fontWeight: 700, color: 'var(--color-text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' };

  return (
    <div className="p-5 max-w-[1200px] mx-auto">
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, margin: '0 0 16px' }}>
        Churches
      </h1>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={15} style={{ position: 'absolute', left: 13, top: 12, color: 'var(--color-text-muted)' }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search church, pastor or town…"
            aria-label="Search churches"
            style={{
              width: '100%', padding: '10px 12px 10px 38px', borderRadius: 10,
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', fontSize: 13.5, outline: 'none',
            }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              style={{
                padding: '8px 12px', borderRadius: 9, fontSize: 12.5,
                fontFamily: 'var(--font-display)', fontWeight: filter === f.id ? 700 : 500,
                background: filter === f.id ? 'var(--color-surface-2)' : 'transparent',
                border: `1px solid ${filter === f.id ? 'var(--color-border)' : 'transparent'}`,
                color: filter === f.id ? 'var(--color-text)' : 'var(--color-text-muted)',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ background: 'var(--color-ink-800)' }}>
                <th style={th}>Church</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Days left</th>
                <th style={th}>Expires</th>
                <th style={{ ...th, textAlign: 'right' }}>Members</th>
                <th style={{ ...th, textAlign: 'right' }}>Giving (TZS)</th>
                <th style={{ ...th, width: 40 }} aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.churchId} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={td}>
                    <Link to={`/churches/${t.churchId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      <span style={{ fontWeight: 600 }}>{t.name}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {t.pastorName || t.pastorEmail || 'no pastor on record'}
                        {t.location ? ` · ${t.location}` : ''}
                      </span>
                    </Link>
                  </td>
                  <td style={td}><StatusBadge status={t.status} expiringSoon={t.expiringSoon} /></td>
                  <td className="tnum" style={{ ...td, textAlign: 'right', color: t.expiringSoon ? 'var(--color-gold)' : 'var(--color-text-dim)' }}>
                    {t.status === 'none' ? '—' : t.daysRemaining ?? '—'}
                  </td>
                  <td className="tnum" style={{ ...td, color: 'var(--color-text-dim)' }}>{formatDate(t.expiresAt)}</td>
                  <td className="tnum" style={{ ...td, textAlign: 'right' }}>{formatMoney(t.members)}</td>
                  <td className="tnum" style={{ ...td, textAlign: 'right' }}>{formatMoney(t.totalGiving)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <Link to={`/churches/${t.churchId}`} aria-label={`Open ${t.name}`} style={{ color: 'var(--color-text-muted)' }}>
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <p style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            No church matches that search.
          </p>
        )}
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 12 }}>
        Showing {rows.length} of {tenants.length}.
      </p>
    </div>
  );
}
