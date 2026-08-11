import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { useTenants } from './features/tenants/useTenants';
import Login from './features/auth/Login';
import Layout from './components/Layout';
import Dashboard from './features/dashboard/Dashboard';
import ChurchesPage from './features/churches/ChurchesPage';
import ChurchDetail from './features/churches/ChurchDetail';
import LicencesPage from './features/licences/LicencesPage';
import { isConfigured } from './lib/supabase';

function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-full flex items-center justify-center p-6"
      style={{ background: 'var(--color-ink)' }}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl p-7 text-center"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Shown when a real, valid account signs in that simply is not a superadmin.
 *
 * It says so plainly instead of showing an empty dashboard. Without a licence
 * to read anything, every query below would return zero rows and the console
 * would look broken rather than forbidden — the same confusion that made the
 * church-creation failures so hard to place.
 */
function NotAuthorised() {
  const { profile, signOut } = useAuth();
  return (
    <Centred>
      <ShieldAlert size={30} style={{ color: 'var(--color-gold)' }} className="mx-auto mb-3" />
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>
        This account is not a superadmin
      </h1>
      <p style={{ fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.6, margin: '0 0 6px' }}>
        You are signed in as <strong>{profile?.email || 'an unknown account'}</strong>
        {profile?.role ? <> with the role <strong>{profile.role}</strong></> : null}.
      </p>
      <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: '0 0 18px' }}>
        The console reads and writes nothing without it — row-level security gates
        every query on <code>is_superadmin()</code>. Promote the account in the SQL
        editor, then sign in again.
      </p>
      <button
        onClick={signOut}
        className="inline-flex items-center justify-center gap-2 rounded-lg w-full"
        style={{
          padding: '11px 16px', background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)', color: 'var(--color-text)',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}
      >
        <LogOut size={15} /> Sign out
      </button>
    </Centred>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div
      className="min-h-full flex flex-col items-center justify-center gap-3"
      style={{ background: 'var(--color-ink)' }}
    >
      <Loader2 size={22} className="spin" style={{ color: 'var(--color-violet)' }} />
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>{label}</p>
    </div>
  );
}

/**
 * The estate is loaded ONCE here and handed down.
 *
 * Every screen is a different arrangement of the same six tables, so fetching
 * per route would mean re-reading all of them on each navigation and letting
 * two screens disagree about the same church. `reload` is passed to the header
 * so a refresh is explicit rather than a surprise.
 */
function Console() {
  const { tenants, totals, serverTime, loading, error, reload } = useTenants();

  if (loading && tenants.length === 0) return <Loading label="Loading the estate…" />;

  return (
    <>
      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 16px', fontSize: 12.5,
            background: 'color-mix(in srgb, var(--color-rose) 12%, transparent)',
            color: 'var(--color-rose)', borderBottom: '1px solid var(--color-border)',
          }}
        >
          {error}
        </div>
      )}
      <Routes>
        <Route element={<Layout onReload={reload} serverTime={serverTime} />}>
          <Route index element={<Dashboard tenants={tenants} totals={totals} />} />
          <Route path="churches" element={<ChurchesPage tenants={tenants} />} />
          <Route path="licences" element={<LicencesPage tenants={tenants} onChanged={reload} />} />
          <Route path="churches/:churchId" element={<ChurchDetail tenants={tenants} onChanged={reload} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

function Gate() {
  const { session, isLoading, isSuperadmin } = useAuth();

  if (!isConfigured) {
    return (
      <Centred>
        <ShieldAlert size={30} style={{ color: 'var(--color-rose)' }} className="mx-auto mb-3" />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>
          Not configured
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.6, margin: 0 }}>
          Copy <code>.env.example</code> to <code>.env</code> and set{' '}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart.
        </p>
      </Centred>
    );
  }

  if (isLoading) return <Loading label="Checking your session…" />;
  if (!session) return <Login />;
  if (!isSuperadmin) return <NotAuthorised />;

  return <Console />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  );
}
