import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function createCookieStorage() {
  return {
    getItem(key: string) {
      if (typeof document === "undefined") {
        return null;
      }

      const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
      return match ? decodeURIComponent(match[1]) : null;
    },
    setItem(key: string, value: string) {
      if (typeof document === "undefined") {
        return;
      }

      document.cookie = `${key}=${encodeURIComponent(value)}; path=/; SameSite=Lax; Max-Age=31536000`;
    },
    removeItem(key: string) {
      if (typeof document === "undefined") {
        return;
      }

      document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    },
  };
}

export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: createCookieStorage(),
      storageKey: "sb-auth-token",
    },
  });
}

export const supabase = createBrowserClient();