import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";

function loadEnv(file = ".env") {
  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

const env = loadEnv();
if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required and must remain server-only.");
const parsedDatabaseUrl = new URL(env.DATABASE_URL);
const baseConfig = { user: decodeURIComponent(parsedDatabaseUrl.username), password: decodeURIComponent(parsedDatabaseUrl.password), database: parsedDatabaseUrl.pathname.slice(1), port: Number(parsedDatabaseUrl.port || 5432), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 6_000 };
async function connect(config) {
  const candidate = new Client(config);
  try { await candidate.connect(); return candidate; }
  catch (error) { await candidate.end().catch(() => undefined); throw error; }
}
let client;
try {
  client = await connect({ ...baseConfig, host: parsedDatabaseUrl.hostname });
} catch {
  const reference = parsedDatabaseUrl.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1];
  const regions = ["ap-south-1","ap-southeast-1","ap-southeast-2","ap-northeast-1","eu-west-1","eu-central-1","us-east-1","us-west-1","us-west-2","ca-central-1","sa-east-1"];
  if (!reference) throw new Error("Could not derive the Supabase project reference for a pooler fallback.");
  for (const region of regions) {
    try { client = await connect({ ...baseConfig, user: `postgres.${reference}`, host: `aws-0-${region}.pooler.supabase.com`, port: 5432 }); break; }
    catch { /* Try the next documented Supabase region. */ }
  }
  if (!client) throw new Error("The direct database endpoint is unreachable and no pooler region accepted the configured credentials. Add the exact Supabase pooler connection string as DATABASE_URL.");
}
try {
  const initialExists = await client.query("select to_regclass('public.searches') is not null as installed");
  await client.query("create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now())");
  if (initialExists.rows[0].installed) await client.query("insert into public.schema_migrations(version) values ($1) on conflict do nothing", ["202610050001_initial_schema.sql"]);
  const applied = [];
  const skipped = [];
  for (const version of readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort()) {
    const recorded = await client.query("select 1 from public.schema_migrations where version = $1", [version]);
    if (recorded.rowCount) { skipped.push(version); continue; }
    const migration = readFileSync(`supabase/migrations/${version}`, "utf8");
    await client.query("begin");
    try {
      await client.query(migration);
      await client.query("insert into public.schema_migrations(version) values ($1)", [version]);
      await client.query("commit");
      applied.push(version);
    } catch (error) { await client.query("rollback"); throw error; }
  }
  const tables = await client.query("select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = any($1::text[]) order by tablename", [["profiles","searches","search_filters","discovery_jobs","businesses","website_analyses","lead_scores","lead_notes","job_events"]]);
  const indexes = await client.query("select indexname from pg_indexes where schemaname = 'public' and indexname = any($1::text[]) order by indexname", [["businesses_search_id_idx","businesses_website_status_idx","businesses_lead_score_idx","businesses_city_idx","businesses_country_idx","businesses_category_idx","businesses_provider_id_idx","searches_user_created_idx","discovery_jobs_search_idx","job_events_job_created_idx"]]);
  const policies = await client.query("select tablename, policyname from pg_policies where schemaname = 'public' order by tablename, policyname");
  const foreignKeys = await client.query("select c.conname, c.conrelid::regclass::text as child_table, c.confrelid::regclass::text as parent_table from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'f' order by child_table, c.conname");
  const constraints = await client.query("select count(*)::int as count from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype in ('f','u','p','c')");
  const triggers = await client.query("select event_object_table as table_name, trigger_name from information_schema.triggers where trigger_schema = 'public' order by event_object_table, trigger_name");
  console.log(JSON.stringify({ migrations: { applied, skipped }, tables: tables.rows, indexes: indexes.rows.map((row) => row.indexname), policies: policies.rows, foreignKeys: foreignKeys.rows, constraints: constraints.rows[0].count, triggers: triggers.rows }, null, 2));
} finally {
  await client.end();
}
