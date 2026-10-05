import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
export async function getUserId(request: NextRequest): Promise<string | null> {
  if (process.env.DEMO_MODE !== "false" || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return DEMO_USER_ID;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""); if (!token) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data } = await client.auth.getUser(token); return data.user?.id ?? null;
}
