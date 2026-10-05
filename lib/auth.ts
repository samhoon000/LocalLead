import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getSupabaseAuthConfig, isDemoMode } from "./server-env";

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
export async function getUserId(request: NextRequest): Promise<string | null> {
  if (isDemoMode()) return DEMO_USER_ID;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""); if (!token) return null;
  const { url, anonKey } = getSupabaseAuthConfig();
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token); return error ? null : data.user?.id ?? null;
}
