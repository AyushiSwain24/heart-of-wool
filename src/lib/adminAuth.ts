import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

/**
 * Real Supabase Auth for the admin panel — replaces the old hardcoded
 * password gate. A session here is a genuine Supabase Auth JWT; the
 * database additionally checks the logged-in email against an allow-list
 * (see is_admin() in supabase/migration_003_admin_auth.sql), so even a
 * stray second auth user could never call the admin functions.
 *
 * When Supabase isn't configured (local mock mode), login is skipped
 * entirely — there's no real backend to protect.
 */

export async function signInAdmin(email: string, password: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: "Supabase isn't configured — nothing to log into in mock mode." };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signOutAdmin(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.auth.signOut();
}

export async function getAdminSession() {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}
