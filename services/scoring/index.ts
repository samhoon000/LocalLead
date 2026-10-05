import type { Business, LeadScore, WebsiteAnalysis, WebsiteStatus } from "@/lib/types";
import { clamp } from "@/lib/utils";

export function scoreOpportunity(input: { websiteStatus: WebsiteStatus; analysis?: WebsiteAnalysis; rating?: number; reviewCount?: number }): LeadScore {
  const factors: LeadScore["factors"] = [];
  if (input.websiteStatus === "no_website") factors.push({ label: "No official website found", points: 40 });
  if (input.websiteStatus === "uncertain") factors.push({ label: "Official website is uncertain", points: 18 });
  if (input.analysis && input.analysis.qualityScore <= 45) factors.push({ label: "Website needs substantial improvement", points: 25 });
  if (input.analysis && !input.analysis.mobileFriendly) factors.push({ label: "Weak mobile experience", points: 15 });
  if (input.analysis && !input.analysis.hasClearCta) factors.push({ label: "No clear primary call to action", points: 10 });
  if (input.analysis && !input.analysis.hasContactForm && !input.analysis.hasBooking) factors.push({ label: "No online contact or booking flow", points: 5 });
  if ((input.rating ?? 0) >= 4.3) factors.push({ label: "Strong customer rating", points: 5 });
  if ((input.reviewCount ?? 0) >= 100) factors.push({ label: "Established review volume", points: 5 });
  const score = clamp(factors.reduce((sum, factor) => sum + factor.points, 0));
  const label = score >= 80 ? "High opportunity" : score >= 60 ? "Good opportunity" : score >= 40 ? "Possible opportunity" : "Low opportunity";
  return { score, label, factors };
}

export function deduplicateBusinesses<T extends Pick<Business, "provider" | "providerBusinessId">>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => { const key = `${item.provider}:${item.providerBusinessId}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
