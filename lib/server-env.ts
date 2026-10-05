import "server-only";

function value(name: string): string | undefined {
  const current = process.env[name]?.trim();
  return current || undefined;
}

function assertSupabaseHttpUrl(url: string): string {
  if (/^postgres(?:ql)?:\/\//i.test(url)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be the HTTPS Supabase project URL, not a PostgreSQL connection string.");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }
  if (parsed.protocol !== "https:") throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTPS.");
  return url.replace(/\/$/, "");
}

export function isDemoMode(): boolean {
  const enabled = value("DEMO_MODE") === "true";
  if (enabled && process.env.NODE_ENV === "production") throw new Error("DEMO_MODE must be false in production.");
  return enabled;
}

export function getSupabaseServerConfig(): { url: string; serviceRoleKey: string } | null {
  const rawUrl = value("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = value("SUPABASE_SERVICE_ROLE_KEY");
  if (!rawUrl && !serviceRoleKey) {
    if (process.env.NODE_ENV === "production") throw new Error("Supabase server configuration is missing.");
    return null;
  }
  if (!rawUrl || !serviceRoleKey) throw new Error("Both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server persistence.");
  return { url: assertSupabaseHttpUrl(rawUrl), serviceRoleKey };
}

export function getSupabaseAuthConfig(): { url: string; anonKey: string } {
  const rawUrl = value("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = value("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!rawUrl || !anonKey) throw new Error("Supabase authentication configuration is missing.");
  return { url: assertSupabaseHttpUrl(rawUrl), anonKey };
}

export function getBusinessProviderName(): string {
  return (value("BUSINESS_DATA_PROVIDER") ?? (process.env.NODE_ENV === "production" ? "geoapify" : "mock")).toLowerCase();
}

export function getGeoapifyKey(): string {
  const key = value("GEOAPIFY_API_KEY") ?? value("BUSINESS_DATA_PROVIDER_API_KEY");
  if (!key) throw new Error("A Geoapify server API key is required.");
  return key;
}

export function numberSetting(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = value(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}
