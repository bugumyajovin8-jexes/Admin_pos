import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
  console.warn('Supabase credentials missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

/**
 * The console's only connection, using the ANON key and a normal signed-in
 * session — exactly like the two church apps.
 *
 * There is no service-role client here and there must never be. Every action
 * this tool performs is authorised by the policies in
 * database/rls_policies.sql, which gate on `is_superadmin()`. That means the
 * console cannot do anything the signed-in account could not do by hand in the
 * SQL editor, and a stolen bundle grants nothing: the anon key on its own reads
 * no rows at all.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
