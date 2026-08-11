import { useState } from 'react';
import { Shield, Mail, Lock, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { supabase, isConfigured } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    setLoading(false);
  };

  const field: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px 12px 42px',
    borderRadius: 12,
    background: 'var(--color-ink)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-sans)',
    fontSize: 15,
    outline: 'none',
  };

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: 'color-mix(in srgb, var(--color-violet) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-violet) 30%, transparent)',
            }}
          >
            <Shield size={30} style={{ color: 'var(--color-violet)' }} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: 0 }}>
            Admin Console
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
            Superadmin access only
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl p-6"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Email
          </label>
          <div style={{ position: 'relative', margin: '8px 0 18px' }}>
            <Mail size={16} style={{ position: 'absolute', left: 14, top: 15, color: 'var(--color-text-muted)' }} />
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              style={field}
            />
          </div>

          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Password
          </label>
          <div style={{ position: 'relative', margin: '8px 0 20px' }}>
            <Lock size={16} style={{ position: 'absolute', left: 14, top: 15, color: 'var(--color-text-muted)' }} />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ ...field, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', right: 8, top: 8, padding: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)',
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div
              className="flex items-start gap-2 rounded-xl p-3 mb-4"
              style={{
                background: 'color-mix(in srgb, var(--color-rose) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-rose) 28%, transparent)',
              }}
            >
              <AlertTriangle size={15} style={{ color: 'var(--color-rose)', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12.5, color: 'var(--color-text)', lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2"
            style={{
              padding: '13px', borderRadius: 12, border: 'none',
              background: 'var(--color-violet)', color: 'var(--color-on-accent)',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 18, lineHeight: 1.6 }}>
          Accounts are not created here. Promote an existing account with
          <code style={{ color: 'var(--color-text-dim)' }}> database/bootstrap.sql</code>.
        </p>
      </div>
    </div>
  );
}
