import { describe, expect, it } from "vitest";
import { store } from "@/lib/store";

describe("database repository and main flow", () => {
  it("creates an isolated search and job in demo storage", async () => { const testUser = "00000000-0000-0000-0000-000000000099"; const search = await store.createSearch(testUser, { country: "Canada", state: "Alberta", city: "Calgary", category: "HVAC contractors", rawQuery: "HVAC contractors", resultCount: 25, websiteFilter: "any", businessStatus: "open" }); const fetched = await store.getSearch(search.id, testUser); const job = await store.getJob(search.jobId, testUser); expect(fetched?.name).toBe("Calgary HVAC contractors"); expect(job?.status).toBe("queued"); expect(await store.getSearch(search.id, "another-user")).toBeNull(); });
});
