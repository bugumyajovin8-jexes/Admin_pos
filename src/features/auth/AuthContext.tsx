import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

interface AuthState {
  session: Session | null;
  profile: any | null;
  isLoading: boolean;
  /** True only when the signed-in account's profile says 'superadmin'. */
  isSuperadmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  isLoading: true,
  isSuperadmin: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      if (!data.session) setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setIsLoading(false);
      }
    });

    // Without this the subscription outlives the provider across hot reloads
    // and stacks duplicates, each re-running the profile fetch.
    return () => listener?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!session?.user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        // Surfaced rather than swallowed: a denied read here is almost always a
        // missing Data API grant (42501) and would otherwise look like a
        // permissions problem with the account itself.
        console.error('Could not read the signed-in profile:', error);
      }
      setProfile(data ?? null);
      setIsLoading(false);
    };

    loadProfile();
    return () => { cancelled = true; };
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  // The gate is the database, not this flag. Every query and mutation this
  // console makes is checked against is_superadmin() by row-level security, so
  // a user who forced this to true client-side would still read and write
  // nothing. It exists to show an honest screen, not to enforce anything.
  const isSuperadmin = profile?.role === 'superadmin';

  return (
    <AuthContext.Provider value={{ session, profile, isLoading, isSuperadmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
