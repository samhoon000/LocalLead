import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Business, DiscoveryJob, JobEvent, LeadScore, SearchInput, SearchRecord, WebsiteAnalysis } from "./types";
import { id } from "./utils";

type MemoryState = { searches: Map<string, SearchRecord>; jobs: Map<string, DiscoveryJob> };
type JsonState = { searches: SearchRecord[]; jobs: DiscoveryJob[] };
const globalStore = globalThis as unknown as { __localLeadStore?: MemoryState };
const memory = globalStore.__localLeadStore ?? { searches: new Map(), jobs: new Map() };
globalStore.__localLeadStore = memory;
const localDirectory = path.join(process.cwd(), ".locallead");
const localDatabase = path.join(localDirectory, "demo-db.json");

function supabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}
function hydrateLocal() {
  if (!existsSync(localDatabase)) return;
  try {
    const state = JSON.parse(readFileSync(localDatabase, "utf8")) as JsonState;
    memory.searches = new Map(state.searches.map((search) => [search.id, search]));
    memory.jobs = new Map(state.jobs.map((job) => [job.id, job]));
  } catch { /* A partial demo file should not stop the app from starting. */ }
}
function persistLocal() {
  mkdirSync(localDirectory, { recursive: true });
  const state: JsonState = { searches: [...memory.searches.values()], jobs: [...memory.jobs.values()] };
  writeFileSync(localDatabase, JSON.stringify(state, null, 2), "utf8");
}

interface DbAnalysisRow { raw_result?: WebsiteAnalysis; }
interface DbScoreRow { score: number; classification: LeadScore["label"]; factors: LeadScore["factors"]; }
interface DbBusinessRow {
  id: string; search_id: string; provider: string; provider_business_id: string; name: string; category: string; subcategory?: string;
  country: string; state?: string; city: string; postal_code?: string; address: string; latitude?: number; longitude?: number; phone?: string;
  email?: string; maps_url?: string; provider_url?: string; rating?: number; review_count?: number; price_level?: string; business_status: string;
  website_url?: string; website_domain?: string; website_status: Business["websiteStatus"]; website_quality_score?: number; lead_score: number;
  lead_status: Business["leadStatus"]; notes: string; created_at: string; updated_at: string; website_analyses?: DbAnalysisRow[] | DbAnalysisRow; lead_scores?: DbScoreRow[] | DbScoreRow;
}
interface DbFilterRow { minimum_rating?: number; minimum_reviews?: number; website_status: SearchInput["websiteFilter"]; business_status: SearchInput["businessStatus"]; radius_km?: number; }
interface DbJobRow { id: string; search_id: string; status: DiscoveryJob["status"]; progress: number; processed: number; total: number; error?: string; created_at: string; updated_at: string; }
interface DbSearchRow { id: string; user_id: string; name: string; country: string; state?: string; city: string; category: string; raw_query: string; result_count: number; status: SearchRecord["status"]; created_at: string; updated_at: string; search_filters?: DbFilterRow[]; discovery_jobs?: DbJobRow[]; businesses?: DbBusinessRow[]; }
interface DbEventRow { id: string; job_id: string; stage: JobEvent["stage"]; message: string; created_at: string; }

function mapBusiness(row: DbBusinessRow): Business {
  const analysisRow = Array.isArray(row.website_analyses) ? row.website_analyses[0] : row.website_analyses;
  const storedScore = Array.isArray(row.lead_scores) ? row.lead_scores[0] : row.lead_scores;
  const label: LeadScore["label"] = row.lead_score >= 80 ? "High opportunity" : row.lead_score >= 60 ? "Good opportunity" : row.lead_score >= 40 ? "Possible opportunity" : "Low opportunity";
  return { id: row.id, searchId: row.search_id, provider: row.provider, providerBusinessId: row.provider_business_id, name: row.name, category: row.category, subcategory: row.subcategory, country: row.country, state: row.state, city: row.city, postalCode: row.postal_code, address: row.address, latitude: row.latitude, longitude: row.longitude, phone: row.phone, email: row.email, mapsUrl: row.maps_url, providerUrl: row.provider_url, rating: row.rating, reviewCount: row.review_count, priceLevel: row.price_level, businessStatus: row.business_status, websiteUrl: row.website_url, websiteDomain: row.website_domain, websiteStatus: row.website_status, analysis: analysisRow?.raw_result, leadScore: storedScore ? { score: storedScore.score, label: storedScore.classification, factors: storedScore.factors } : { score: row.lead_score, label, factors: [] }, leadStatus: row.lead_status, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapSearch(row: DbSearchRow): SearchRecord {
  const filter = row.search_filters?.[0]; const job = row.discovery_jobs?.[0];
  return { id: row.id, userId: row.user_id, name: row.name, country: row.country, state: row.state, city: row.city, category: row.category, rawQuery: row.raw_query, resultCount: row.result_count, minimumRating: filter?.minimum_rating, minimumReviews: filter?.minimum_reviews, websiteFilter: filter?.website_status ?? "any", businessStatus: filter?.business_status ?? "open", radiusKm: filter?.radius_km, status: row.status, jobId: job?.id ?? "", businesses: (row.businesses ?? []).map(mapBusiness), createdAt: row.created_at, updatedAt: row.updated_at };
}
const searchSelection = "*,search_filters(*),discovery_jobs(*),businesses(*,website_analyses(raw_result),lead_scores(score,classification,factors))";

export const store = {
  mode: () => supabase() ? "supabase" : "local-file",
  async createSearch(userId: string, input: SearchInput): Promise<SearchRecord> {
    if (!supabase()) hydrateLocal();
    const searchId = id(), jobId = id(), now = new Date().toISOString();
    const record: SearchRecord = { ...input, id: searchId, userId, name: `${input.city} ${input.category}`, status: "queued", jobId, businesses: [], createdAt: now, updatedAt: now };
    const job: DiscoveryJob = { id: jobId, searchId, status: "queued", progress: 0, processed: 0, total: input.resultCount, events: [], createdAt: now, updatedAt: now };
    const db = supabase();
    if (db) {
      const { error: searchError } = await db.from("searches").insert({ id: searchId, user_id: userId, name: record.name, country: input.country, state: input.state, city: input.city, category: input.category, raw_query: input.rawQuery, result_count: input.resultCount, status: "queued" }); if (searchError) throw searchError;
      const { error: filterError } = await db.from("search_filters").insert({ search_id: searchId, minimum_rating: input.minimumRating, minimum_reviews: input.minimumReviews, website_status: input.websiteFilter, business_status: input.businessStatus, radius_km: input.radiusKm }); if (filterError) throw filterError;
      const { error: jobError } = await db.from("discovery_jobs").insert({ id: jobId, search_id: searchId, user_id: userId, status: "queued", total: input.resultCount }); if (jobError) throw jobError;
    }
    memory.searches.set(searchId, record); memory.jobs.set(jobId, job); if (!db) persistLocal(); return record;
  },
  async listSearches(userId: string): Promise<SearchRecord[]> {
    const db = supabase(); if (db) { const { data, error } = await db.from("searches").select(searchSelection).eq("user_id", userId).order("created_at", { ascending: false }); if (error) throw error; return ((data ?? []) as unknown as DbSearchRow[]).map(mapSearch); }
    hydrateLocal(); return [...memory.searches.values()].filter((search) => search.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getSearch(searchId: string, userId: string): Promise<SearchRecord | null> {
    const db = supabase(); if (db) { const { data, error } = await db.from("searches").select(searchSelection).eq("id", searchId).eq("user_id", userId).maybeSingle(); if (error) throw error; return data ? mapSearch(data as unknown as DbSearchRow) : null; }
    hydrateLocal(); const found = memory.searches.get(searchId); return found?.userId === userId ? found : null;
  },
  async getJob(jobId: string, userId: string): Promise<DiscoveryJob | null> {
    const db = supabase(); if (db) { const { data, error } = await db.from("discovery_jobs").select("*,job_events(*)").eq("id", jobId).eq("user_id", userId).maybeSingle(); if (error) throw error; if (!data) return null; const row = data as unknown as DbJobRow & { job_events?: DbEventRow[] }; return { id: row.id, searchId: row.search_id, status: row.status, progress: row.progress, processed: row.processed, total: row.total, error: row.error, events: (row.job_events ?? []).map((event) => ({ id: event.id, jobId: event.job_id, stage: event.stage, message: event.message, createdAt: event.created_at })).sort((a,b) => a.createdAt.localeCompare(b.createdAt)), createdAt: row.created_at, updatedAt: row.updated_at }; }
    hydrateLocal(); const job = memory.jobs.get(jobId); if (!job) return null; const search = memory.searches.get(job.searchId); return search?.userId === userId ? job : null;
  },
  async updateJob(jobId: string, patch: Partial<DiscoveryJob>, message?: string) {
    const db = supabase(); if (!db) hydrateLocal(); const job = memory.jobs.get(jobId); if (!job) throw new Error("Job not found"); Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    const search = memory.searches.get(job.searchId); if (search && patch.status) { search.status = patch.status; search.updatedAt = job.updatedAt; }
    if (message) { const event: JobEvent = { id: id(), jobId, stage: patch.status ?? job.status, message, createdAt: new Date().toISOString() }; job.events.push(event); }
    if (db) { const { error } = await db.from("discovery_jobs").update({ status: job.status, progress: job.progress, processed: job.processed, total: job.total, error: job.error, updated_at: job.updatedAt }).eq("id", jobId); if (error) throw error; if (search) await db.from("searches").update({ status: search.status, updated_at: search.updatedAt }).eq("id", search.id); if (message) await db.from("job_events").insert({ job_id: jobId, user_id: search?.userId, stage: job.status, message }); } else persistLocal();
  },
  async saveBusinesses(searchId: string, businesses: Business[]) {
    const db = supabase(); if (!db) hydrateLocal(); const search = memory.searches.get(searchId); if (!search) throw new Error("Search not found"); search.businesses = businesses; search.updatedAt = new Date().toISOString();
    if (db && businesses.length) {
      const rows = businesses.map((b) => ({ id: b.id, search_id: b.searchId, user_id: search.userId, provider: b.provider, provider_business_id: b.providerBusinessId, name: b.name, category: b.category, subcategory: b.subcategory, country: b.country, state: b.state, city: b.city, postal_code: b.postalCode, address: b.address, latitude: b.latitude, longitude: b.longitude, phone: b.phone, email: b.email, maps_url: b.mapsUrl, provider_url: b.providerUrl, rating: b.rating, review_count: b.reviewCount, price_level: b.priceLevel, business_status: b.businessStatus, website_url: b.websiteUrl, website_domain: b.websiteDomain, website_status: b.websiteStatus, website_checked_at: b.analysis?.checkedAt, website_quality_score: b.analysis?.qualityScore, lead_score: b.leadScore.score, lead_status: b.leadStatus, notes: b.notes })); const { error } = await db.from("businesses").upsert(rows, { onConflict: "search_id,provider,provider_business_id" }); if (error) throw error;
      const analyses = businesses.filter((b) => b.analysis).map((b) => ({ id: b.analysis!.id, business_id: b.id, user_id: search.userId, quality_score: b.analysis!.qualityScore, https_enabled: b.analysis!.httpsEnabled, mobile_friendly: b.analysis!.mobileFriendly, has_contact_form: b.analysis!.hasContactForm, has_booking: b.analysis!.hasBooking, has_clear_cta: b.analysis!.hasClearCta, has_social_links: b.analysis!.hasSocialLinks, issues: b.analysis!.issues, raw_result: b.analysis })); if (analyses.length) { const { error } = await db.from("website_analyses").upsert(analyses); if (error) throw error; }
      const scores = businesses.map((b) => ({ business_id: b.id, user_id: search.userId, score: b.leadScore.score, classification: b.leadScore.label, factors: b.leadScore.factors })); const { error: scoreError } = await db.from("lead_scores").upsert(scores, { onConflict: "business_id" }); if (scoreError) throw scoreError;
    } else if (!db) persistLocal();
  },
  async updateBusiness(searchId: string, businessId: string, patch: Partial<Business>) {
    const db = supabase(); if (!db) hydrateLocal(); const search: SearchRecord | undefined = memory.searches.get(searchId); const business = search?.businesses.find((item: Business) => item.id === businessId); if (!business) return null; Object.assign(business, patch, { updatedAt: new Date().toISOString() });
    if (db) { const { error } = await db.from("businesses").update({ lead_status: business.leadStatus, notes: business.notes, updated_at: business.updatedAt }).eq("id", businessId).eq("user_id", search!.userId); if (error) throw error; } else persistLocal(); return business;
  },
  async cancelJob(jobId: string, userId: string) { const job = await this.getJob(jobId, userId); if (!job || ["completed", "failed"].includes(job.status)) return false; memory.jobs.set(job.id, job); const search = await this.getSearch(job.searchId, userId); if (search) memory.searches.set(search.id, search); await this.updateJob(jobId, { status: "cancelled" }, "Discovery cancelled"); return true; }
};
