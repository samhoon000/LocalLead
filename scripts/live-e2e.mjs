import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file = ".env") {
  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

const env = loadEnv();
const appUrl = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const publicClient = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `LocalLead-${crypto.randomUUID()}-Aa1!`;
const users = [];

async function createUser(label) {
  const email = `locallead-e2e-${label}-${suffix}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Test user creation failed");
  users.push(data.user.id);
  const client = publicClient(); const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Test sign-in failed");
  return { id: data.user.id, token: signedIn.data.session.access_token, client };
}
async function appFetch(path, token, options = {}) {
  const headers = new Headers(options.headers); headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${appUrl}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("json") ? await response.json() : await response.arrayBuffer();
  return { response, body };
}
async function waitForSearch(id, token, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const current = await appFetch(`/api/searches/${id}`, token);
    if (!current.response.ok) throw new Error(`Search polling failed with HTTP ${current.response.status}`);
    if (["completed", "failed", "cancelled"].includes(current.body.job.status)) return current.body;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Discovery job timed out");
}

let report;
try {
  const owner = await createUser("owner"); const outsider = await createUser("outsider");
  const invalid = await appFetch("/api/searches", owner.token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: "NZ", city: "", category: "", rawQuery: "", resultCount: 999, websiteFilter: "any", businessStatus: "open" }) });
  const create = await appFetch("/api/searches", owner.token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: "New Zealand", state: "Auckland", city: "Auckland", category: "Restaurants", rawQuery: "Restaurants", resultCount: 6, websiteFilter: "any", businessStatus: "open", radiusKm: 10 }) });
  if (!create.response.ok) throw new Error(`Search creation failed with HTTP ${create.response.status}`);
  const searchId = create.body.search.id;
  const start = await appFetch(`/api/searches/${searchId}/start`, owner.token, { method: "POST" }); if (start.response.status !== 202) throw new Error("Search did not enter the queue");
  const completed = await waitForSearch(searchId, owner.token);
  if (completed.job.status !== "completed") throw new Error(`Real discovery ended with ${completed.job.status}: ${completed.job.error ?? "unknown error"}`);
  const businesses = completed.search.businesses;
  if (!businesses.length) throw new Error("Geoapify returned no stored businesses");
  const first = businesses[0];
  const update = await appFetch(`/api/businesses/${first.id}?searchId=${searchId}`, owner.token, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadStatus: "interested", notes: "Automated live verification" }) });
  const persisted = await appFetch(`/api/searches/${searchId}`, owner.token);
  const persistedLead = persisted.body.search.businesses.find((business) => business.id === first.id);
  const csv = await appFetch(`/api/export/${searchId}?format=csv`, owner.token); const xlsx = await appFetch(`/api/export/${searchId}?format=xlsx`, owner.token);
  const { data: outsiderRows, error: outsiderError } = await outsider.client.from("searches").select("id").eq("id", searchId);
  const { data: ownerRows, error: ownerError } = await owner.client.from("searches").select("id").eq("id", searchId);
  if (outsiderError || ownerError) throw outsiderError ?? ownerError;
  const outsiderUpdate = await appFetch(`/api/businesses/${first.id}?searchId=${searchId}`, outsider.token, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadStatus: "converted" }) });
  const failureCreate = await appFetch("/api/searches", owner.token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: "New Zealand", state: "Auckland", city: "Auckland", category: "Unmapped Widget Shops", rawQuery: "Unmapped Widget Shops", resultCount: 5, websiteFilter: "any", businessStatus: "open" }) });
  const failureId = failureCreate.body.search.id; await appFetch(`/api/searches/${failureId}/start`, owner.token, { method: "POST" }); const failed = await waitForSearch(failureId, owner.token, 30_000);
  const dbCounts = {};
  for (const table of ["searches","search_filters","discovery_jobs","businesses","website_analyses","lead_scores","job_events"]) { const { count, error } = await admin.from(table).select("*", { head: true, count: "exact" }).eq("user_id", owner.id); if (error && table === "search_filters") { const fallback = await admin.from(table).select("*,searches!inner(user_id)", { head: true, count: "exact" }).eq("searches.user_id", owner.id); if (fallback.error) throw fallback.error; dbCounts[table] = fallback.count ?? 0; } else { if (error) throw error; dbCounts[table] = count ?? 0; } }
  report = {
    invalidValidationStatus: invalid.response.status,
    completedStatus: completed.job.status,
    progress: completed.job.progress,
    jobEvents: completed.job.events.length,
    businessesRetrieved: businesses.length,
    websitesDetected: businesses.filter((business) => business.websiteStatus === "has_website").length,
    noWebsite: businesses.filter((business) => business.websiteStatus === "no_website").length,
    uncertainWebsite: businesses.filter((business) => business.websiteStatus === "uncertain").length,
    websitesAnalyzed: businesses.filter((business) => business.analysis).length,
    analysisFailuresHandled: businesses.filter((business) => business.analysis?.error).length,
    scoresStored: businesses.filter((business) => business.leadScore?.factors).length,
    leadUpdateStatus: update.response.status,
    leadUpdatePersisted: persistedLead?.leadStatus === "interested" && persistedLead?.notes === "Automated live verification",
    csvExportStatus: csv.response.status,
    csvBytes: csv.body.byteLength,
    xlsxExportStatus: xlsx.response.status,
    xlsxBytes: xlsx.body.byteLength,
    ownerCanRead: ownerRows?.length === 1,
    outsiderCanRead: (outsiderRows?.length ?? 0) > 0,
    outsiderUpdateStatus: outsiderUpdate.response.status,
    gracefulProviderFailureStatus: failed.job.status,
    dbCounts
  };
} finally {
  for (const userId of users.reverse()) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
}

console.log(JSON.stringify(report, null, 2));
