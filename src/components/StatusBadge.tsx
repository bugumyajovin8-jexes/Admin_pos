import type { LicenceStatus } from '../lib/tenants';

/**
 * Status never relies on colour alone — each state carries its own word. An
 * operator scanning a long list should be able to read it in greyscale, and
 * "red vs amber" is exactly the distinction colour-blind viewers lose.
 */
const STYLES: Record<LicenceStatus | 'expiring', { label: string; color: string }> = {
  active:    { label: 'Active',      color: 'var(--color-teal)' },
  expiring:  { label: 'Expiring',    color: 'var(--color-gold)' },
  expired:   { label: 'Expired',     color: 'var(--color-rose)' },
  suspended: { label: 'Blocked',     color: 'var(--color-rose)' },
  none:      { label: 'No licence',  color: 'var(--color-text-muted)' },
};

export default function StatusBadge({ status, expiringSoon }: { status: LicenceStatus; expiringSoon?: boolean }) {
  const key = status === 'active' && expiringSoon ? 'expiring' : status;
  const s = STYLES[key];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{
        padding: '3px 10px',
        fontSize: 11.5,
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        color: s.color,
        background: `color-mix(in srgb, ${s.color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${s.color} 30%, transparent)`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}
