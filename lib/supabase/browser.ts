import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emitSessionChange } from "@/lib/auth/session-events";
import { assertSupabaseEnv, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!client) {
    assertSupabaseEnv();
    client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // Cualquier cambio de usuario invalida las queries (no se muestran datos de otra sesión).
    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") emitSessionChange();
    });
  }
  return client;
}
