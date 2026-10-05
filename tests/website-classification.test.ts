import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeWebsite, classifyWebsite } from "@/services/website-analysis";

afterEach(() => vi.unstubAllGlobals());

describe("website classification", () => {
  it("does not call directories official websites", () => { expect(classifyWebsite("https://facebook.com/acme")).toBe("uncertain"); expect(classifyWebsite("https://www.yelp.com/biz/acme")).toBe("uncertain"); });
  it("handles missing and malformed URLs", () => { expect(classifyWebsite()).toBe("no_website"); expect(classifyWebsite("not a url")).toBe("uncertain"); });
  it("accepts a standalone domain", () => { expect(classifyWebsite("https://acme.example")).toBe("has_website"); });
  it("returns evidence instead of throwing when a website is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unreachable")));
    const result = await analyzeWebsite("business-id", "https://unreachable.invalid");
    expect(result.error).toBe("unreachable");
    expect(result.httpsEnabled).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
