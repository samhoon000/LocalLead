import { describe, expect, it } from "vitest";
import { classifyWebsite } from "@/services/website-analysis";

describe("website classification", () => {
  it("does not call directories official websites", () => { expect(classifyWebsite("https://facebook.com/acme")).toBe("uncertain"); expect(classifyWebsite("https://www.yelp.com/biz/acme")).toBe("uncertain"); });
  it("handles missing and malformed URLs", () => { expect(classifyWebsite()).toBe("no_website"); expect(classifyWebsite("not a url")).toBe("uncertain"); });
  it("accepts a standalone domain", () => { expect(classifyWebsite("https://acme.example")).toBe("has_website"); });
});
