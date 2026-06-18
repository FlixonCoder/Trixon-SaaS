import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for use in browser (Client Components).
 *
 * This client is used for:
 * - Authentication (sign up, sign in, sign out)
 * - Session management (auto-refresh tokens)
 * - Real-time subscriptions
 *
 * The anon key is safe to expose — RLS policies protect the data.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
