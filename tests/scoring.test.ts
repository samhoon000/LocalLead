import { describe, expect, it } from "vitest";
import { deduplicateBusinesses, scoreOpportunity } from "@/services/scoring";

describe("lead scoring", () => {
  it("scores no-website businesses transparently", () => { const result = scoreOpportunity({ websiteStatus: "no_website", rating: 4.7, reviewCount: 220 }); expect(result.score).toBe(50); expect(result.label).toBe("Possible opportunity"); expect(result.factors.map((f) => f.label)).toContain("No official website found"); });
  it("caps scores at 100", () => { const result = scoreOpportunity({ websiteStatus: "no_website", rating: 5, reviewCount: 500, analysis: { id: "a", businessId: "b", qualityScore: 10, httpsEnabled: false, mobileFriendly: false, hasTitle: false, hasMetaDescription: false, hasContactInfo: false, hasPhoneCta: false, hasEmailCta: false, hasContactForm: false, hasBooking: false, hasClearCta: false, servicesExplained: false, locationVisible: false, hasSocialLinks: false, issues: [], checkedAt: "" } }); expect(result.score).toBe(100); expect(result.label).toBe("High opportunity"); });
});
describe("deduplication", () => { it("uses provider and stable provider id", () => { const items = [{ provider: "x", providerBusinessId: "1" }, { provider: "x", providerBusinessId: "1" }, { provider: "y", providerBusinessId: "1" }]; expect(deduplicateBusinesses(items)).toHaveLength(2); }); });
