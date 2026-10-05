import { readFileSync } from "node:fs";

function loadEnv(file = ".env") {
  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

const env = loadEnv();
const base = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const geoapifyKey = env.GEOAPIFY_API_KEY;
if (!base || !serviceKey || !anonKey || !geoapifyKey) throw new Error("Required credentials are missing.");

const tables = ["profiles", "searches", "search_filters", "discovery_jobs", "businesses", "website_analyses", "lead_scores", "lead_notes", "job_events"];
const tableResults = [];
for (const table of tables) {
  try {
    const response = await fetch(`${base}/rest/v1/${table}?select=*&limit=0`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    tableResults.push({ table, status: response.status, ready: response.ok, error: response.ok ? undefined : (await response.json().catch(() => ({}))).message });
  } catch (error) {
    tableResults.push({ table, status: 0, ready: false, error: error instanceof Error ? error.message : "transport error" });
  }
}

let auth;
try {
  const response = await fetch(`${base}/auth/v1/settings`, { headers: { apikey: anonKey } });
  auth = { reachable: response.ok, status: response.status, routing: Object.fromEntries([...response.headers].filter(([name]) => /region|location|server|pop/i.test(name))) };
} catch (error) {
  auth = { reachable: false, status: 0, error: error instanceof Error ? error.message : "transport error" };
}

let geoapify;
try {
  const geocodeUrl = new URL("https://api.geoapify.com/v1/geocode/search");
  geocodeUrl.searchParams.set("text", "Auckland, New Zealand"); geocodeUrl.searchParams.set("limit", "1"); geocodeUrl.searchParams.set("apiKey", geoapifyKey);
  const geocodeResponse = await fetch(geocodeUrl); const geocodeBody = await geocodeResponse.json();
  const coordinates = geocodeBody.features?.[0]?.geometry?.coordinates;
  if (!geocodeResponse.ok || !coordinates) throw new Error(`Geocoding failed with HTTP ${geocodeResponse.status}`);
  const placesUrl = new URL("https://api.geoapify.com/v2/places");
  placesUrl.searchParams.set("categories", "catering.restaurant"); placesUrl.searchParams.set("filter", `circle:${coordinates[0]},${coordinates[1]},10000`); placesUrl.searchParams.set("bias", `proximity:${coordinates[0]},${coordinates[1]}`); placesUrl.searchParams.set("limit", "10"); placesUrl.searchParams.set("apiKey", geoapifyKey);
  const placesResponse = await fetch(placesUrl); const placesBody = await placesResponse.json();
  geoapify = { geocodeStatus: geocodeResponse.status, placesStatus: placesResponse.status, results: placesBody.features?.length ?? 0, namedResults: (placesBody.features ?? []).filter((feature) => feature.properties?.name).length, error: placesResponse.ok ? undefined : placesBody.message };
} catch (error) {
  geoapify = { geocodeStatus: 0, placesStatus: 0, results: 0, namedResults: 0, error: error instanceof Error ? error.message : "transport error" };
}

console.log(JSON.stringify({ auth, tables: tableResults, geoapify }, null, 2));
