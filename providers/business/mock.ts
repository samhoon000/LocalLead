import type { BusinessDataProvider, BusinessSearchResult, NormalizedBusiness } from "./BusinessDataProvider";
import type { SearchInput } from "@/lib/types";

const prefixes = ["Northstar", "Bluebird", "Summit", "Cornerstone", "Oak & Co.", "Evergreen", "Citywide", "Brightway", "Harbor", "Atlas", "Willow", "Parkside", "Prime", "Local", "Heritage"];
const suffixes = ["Collective", "Company", "Pros", "Studio", "Works", "Services", "Group", "Experts"];
const streets = ["Market Street", "High Street", "Victoria Road", "Oak Avenue", "King Street", "Lakeview Drive", "Main Street", "Station Road"];

function hash(value: string) {
  let h = 2166136261;
  for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function normalizeMockBusiness(input: SearchInput, index: number): NormalizedBusiness {
  const seed = hash(`${input.city}:${input.category}:${index}`);
  const noWebsite = index % 4 === 0;
  const uncertain = index % 13 === 0;
  const slug = `${prefixes[index % prefixes.length]}-${input.category}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return {
    provider: "mock",
    providerBusinessId: `mock-${seed}`,
    name: `${prefixes[index % prefixes.length]} ${input.category} ${suffixes[(index * 3) % suffixes.length]}`,
    category: input.category,
    subcategory: index % 3 === 0 ? `Independent ${input.category}` : undefined,
    country: input.country,
    state: input.state,
    city: input.city,
    postalCode: `${10000 + (seed % 89999)}`,
    address: `${10 + (seed % 890)} ${streets[index % streets.length]}, ${input.city}`,
    latitude: 40 + ((seed % 1000) / 10000),
    longitude: -74 + ((seed % 1000) / 10000),
    phone: `+1 555 ${String(100 + (seed % 899))} ${String(1000 + (seed % 8999))}`,
    email: index % 5 === 0 ? `hello@${slug}.example` : undefined,
    mapsUrl: `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${input.city} ${input.category}`)}`,
    rating: Number((3.5 + (seed % 15) / 10).toFixed(1)),
    reviewCount: 8 + (seed % 493),
    priceLevel: ["$", "$$", "$$$"][seed % 3],
    businessStatus: index % 17 === 0 ? "temporarily_closed" : "open",
    websiteUrl: noWebsite ? undefined : uncertain ? `https://facebook.com/${slug}` : `https://${slug}.example`
  };
}

export class MockBusinessDataProvider implements BusinessDataProvider {
  readonly name = "mock";
  readonly maxResults = 500;
  async searchBusinesses(params: SearchInput): Promise<BusinessSearchResult> {
    const all = Array.from({ length: params.resultCount }, (_, i) => normalizeMockBusiness(params, i));
    const businesses = all.filter((b) => (!params.minimumRating || (b.rating ?? 0) >= params.minimumRating) && (!params.minimumReviews || (b.reviewCount ?? 0) >= params.minimumReviews) && (params.businessStatus === "any" || b.businessStatus === "open"));
    return { businesses, attribution: "Synthetic demo data", warnings: businesses.length < params.resultCount ? ["Qualification filters reduced the result count."] : [] };
  }
  async getBusinessDetails() { return null; }
}
