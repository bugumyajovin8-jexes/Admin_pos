import { Link, Outlet, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, Church, KeyRound, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';

export default function Layout({ onReload, serverTime }: { onReload?: () => void; serverTime?: string | null }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const nav = [
    { to: '/', icon: LayoutDashboard, label: 'Overview' },
    { to: '/churches', icon: Church, label: 'Churches' },
    { to: '/licences', icon: KeyRound, label: 'Licences' },
  ];

  const isActive = (to: string) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));

  return (
    <div className="min-h-full flex flex-col" style={{ background: 'var(--color-ink)' }}>
      <header
        className="shrink-0 flex items-center gap-4 px-5 py-3"
        style={{ background: 'var(--color-ink-800)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--color-violet) 16%, transparent)' }}
          >
            <Shield size={17} style={{ color: 'var(--color-violet)' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15 }}>Admin Console</span>
        </div>

        <nav className="flex items-center gap-1 ml-4">
          {nav.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 rounded-lg"
              style={{
                padding: '8px 13px',
                fontSize: 13,
                fontWeight: isActive(to) ? 700 : 500,
                fontFamily: 'var(--font-display)',
                color: isActive(to) ? 'var(--color-text)' : 'var(--color-text-muted)',
                background: isActive(to) ? 'var(--color-surface)' : 'transparent',
                textDecoration: 'none',
              }}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {serverTime && (
          <span className="tnum hidden md:inline" style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
            server {new Date(serverTime).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
          </span>
        )}

        {onReload && (
          <button
            onClick={onReload}
            aria-label="Reload data"
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 34, height: 34, background: 'var(--color-surface)',
              border: '1px solid var(--color-border)', color: 'var(--color-text-dim)', cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} />
          </button>
        )}

        <div className="flex items-center gap-3 pl-2" style={{ borderLeft: '1px solid var(--color-border)' }}>
          <div className="text-right hidden sm:block">
            <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0 }}>{profile?.full_name || 'Superadmin'}</p>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>{profile?.email}</p>
          </div>
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 34, height: 34, background: 'transparent',
              border: '1px solid var(--color-border)', color: 'var(--color-rose)', cursor: 'pointer',
            }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
