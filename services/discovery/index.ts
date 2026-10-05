import type { Business, SearchRecord } from "@/lib/types";
import { id, sleep } from "@/lib/utils";
import { store } from "@/lib/store";
import { getBusinessProvider } from "@/providers/business";
import { enrichBusiness } from "@/services/enrichment";
import { analyzeWebsite } from "@/services/website-analysis";
import { deduplicateBusinesses, scoreOpportunity } from "@/services/scoring";

async function active(jobId: string, userId: string) { return (await store.getJob(jobId, userId))?.status !== "cancelled"; }
export async function runDiscovery(search: SearchRecord) {
  try {
    const provider = getBusinessProvider();
    await store.updateJob(search.jobId, { status: "discovering", progress: 5 }, "Location resolved and search created");
    const result = await provider.searchBusinesses(search);
    const filtered = result.businesses.filter((business) => (search.minimumRating === undefined || (business.rating ?? 0) >= search.minimumRating) && (search.minimumReviews === undefined || (business.reviewCount ?? 0) >= search.minimumReviews) && (search.businessStatus === "any" || business.businessStatus === "open"));
    const normalized: Business[] = deduplicateBusinesses(filtered.map((source): Business => ({ ...source, id: id(), searchId: search.id, websiteStatus: "unknown", leadScore: { score: 0, label: "Low opportunity", factors: [] }, leadStatus: "new", notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })));
    await store.updateJob(search.jobId, { progress: 25, processed: normalized.length, total: normalized.length }, `${normalized.length} unique businesses found · ${result.attribution}`);
    if (!await active(search.jobId, search.userId)) return;
    await store.updateJob(search.jobId, { status: "enriching", progress: 32, processed: 0 }, "Checking official website signals");
    for (let i = 0; i < normalized.length; i++) {
      Object.assign(normalized[i], enrichBusiness(normalized[i]));
      if (i % 5 === 0 || i === normalized.length - 1) await store.updateJob(search.jobId, { processed: i + 1, progress: 32 + Math.round(((i + 1) / Math.max(1, normalized.length)) * 18) }, `${i + 1} of ${normalized.length} website records checked`);
    }
    const qualified = search.websiteFilter === "any" ? normalized : normalized.filter((business) => business.websiteStatus === search.websiteFilter);
    if (qualified.length !== normalized.length) await store.updateJob(search.jobId, { total: qualified.length }, `${qualified.length} businesses matched the website filter`);
    if (!await active(search.jobId, search.userId)) return;
    await store.updateJob(search.jobId, { status: "analyzing", progress: 52, processed: 0 }, "Analyzing publicly accessible websites");
    const batchSize = provider.name === "mock" ? 1 : 5;
    for (let offset = 0; offset < qualified.length; offset += batchSize) {
      const batch = qualified.slice(offset, offset + batchSize);
      await Promise.all(batch.map(async (business) => {
        if (business.websiteStatus === "has_website" && business.websiteUrl && process.env.WEBSITE_ANALYSIS_ENABLED !== "false") business.analysis = await analyzeWebsite(business.id, business.websiteUrl);
        if (provider.name === "mock") await sleep(12);
      }));
      const processed = Math.min(offset + batch.length, qualified.length);
      await store.updateJob(search.jobId, { processed, progress: 52 + Math.round((processed / Math.max(1, qualified.length)) * 28) }, `${processed} of ${qualified.length} businesses analyzed`);
      if (!await active(search.jobId, search.userId)) return;
    }
    if (!await active(search.jobId, search.userId)) return;
    await store.updateJob(search.jobId, { status: "scoring", progress: 84, processed: 0 }, "Calculating transparent opportunity scores");
    const businesses = qualified.map((business): Business => ({ ...business, leadScore: scoreOpportunity(business) }));
    await store.saveBusinesses(search.id, businesses);
    await store.updateJob(search.jobId, { status: "completed", progress: 100, processed: businesses.length }, `${businesses.length} qualified leads are ready`);
  } catch (error) {
    const message = error instanceof Error && /Geoapify|Location|provider|website/i.test(error.message) ? error.message : "Discovery failed";
    await store.updateJob(search.jobId, { status: "failed", error: message }, "Discovery stopped after an unexpected error");
  }
}
