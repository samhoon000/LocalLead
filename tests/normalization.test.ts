import { describe, expect, it } from "vitest";
import { normalizeMockBusiness } from "@/providers/business/mock";
import type { SearchInput } from "@/lib/types";

const input: SearchInput = { country: "New Zealand", state: "Canterbury", city: "Christchurch", category: "Plumbers", rawQuery: "Plumbers", resultCount: 25, websiteFilter: "any", businessStatus: "open" };
describe("business normalization", () => {
  it("creates deterministic normalized provider records", () => { const first = normalizeMockBusiness(input, 2); const again = normalizeMockBusiness(input, 2); expect(first).toEqual(again); expect(first.provider).toBe("mock"); expect(first.city).toBe("Christchurch"); expect(first.providerBusinessId).toMatch(/^mock-/); });
});
