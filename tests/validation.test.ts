import { describe, expect, it } from "vitest";
import { searchInputSchema } from "@/lib/validation";

describe("search validation", () => {
  const valid = { country: "India", state: "Karnataka", city: "Mangaluru", category: "Dentists", rawQuery: "Dentists", resultCount: 25, websiteFilter: "any", businessStatus: "open" };
  it("accepts valid searches", () => expect(searchInputSchema.safeParse(valid).success).toBe(true));
  it("rejects unsafe result counts and empty places", () => { expect(searchInputSchema.safeParse({ ...valid, resultCount: 501 }).success).toBe(false); expect(searchInputSchema.safeParse({ ...valid, city: "" }).success).toBe(false); });
});
