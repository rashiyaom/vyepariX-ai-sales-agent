import { createClient } from "@supabase/supabase-js";

// Dedicated Supabase Project URL & Publishable Key
const envUrl = (import.meta.env["VITE_SUPABASE_URL"] as string) || "";
export const SUPABASE_URL: string =
  envUrl && !envUrl.includes("your-project")
    ? envUrl
    : "https://adhgwqlulqeqpwycvmni.supabase.co";

const envKey =
  (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string) ||
  (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string) ||
  "";
export const SUPABASE_PUBLISHABLE_KEY: string =
  envKey && !envKey.includes("xxxxxxxx")
    ? envKey
    : "sb_publishable_xLcJx_03aKm_jLKJKtzcBA_9R5lF0Hx";

export const isSupabaseConfigured =
  Boolean(SUPABASE_URL) &&
  !SUPABASE_URL.includes("your-project") &&
  Boolean(SUPABASE_PUBLISHABLE_KEY);

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "vyepari_x_auth_token",
  },
});

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("Error fetching Supabase session:", error);
    return null;
  }
  return data.session;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return null;
  }
  return data.user;
}
