import type { BusinessDataProvider, BusinessSearchResult, NormalizedBusiness } from "./BusinessDataProvider";
import type { SearchInput } from "@/lib/types";
import { retry, sleep } from "@/lib/utils";

type Feature = { properties: Record<string, unknown>; geometry?: { coordinates?: [number, number] } };
const categoryMap: Record<string, string> = {
  restaurants: "catering.restaurant", cafes: "catering.cafe", plumbers: "service.plumber", electricians: "service.electrician",
  hotels: "accommodation.hotel", dentists: "healthcare.dentist", gyms: "sport.fitness", salons: "commercial.health_and_beauty",
  barbers: "commercial.health_and_beauty.hairdresser", "car repair": "service.vehicle.repair", photographers: "service.photographer",
  "real estate agencies": "service.real_estate"
};

function text(p: Record<string, unknown>, key: string) { const value = p[key]; return typeof value === "string" ? value : undefined; }
function normalize(feature: Feature, input: SearchInput): NormalizedBusiness {
  const p = feature.properties;
  const website = text(p, "website");
  const placeId = text(p, "place_id") ?? `${text(p, "name")}-${text(p, "formatted")}`;
  return {
    provider: "geoapify", providerBusinessId: placeId, name: text(p, "name") ?? "Unnamed business", category: input.category,
    country: text(p, "country") ?? input.country, state: text(p, "state") ?? input.state, city: text(p, "city") ?? input.city,
    postalCode: text(p, "postcode"), address: text(p, "formatted") ?? `${input.city}, ${input.country}`,
    longitude: feature.geometry?.coordinates?.[0], latitude: feature.geometry?.coordinates?.[1], phone: text(p, "contact:phone") ?? text(p, "phone"),
    email: text(p, "contact:email") ?? text(p, "email"), websiteUrl: website, providerUrl: text(p, "datasource") as string | undefined,
    businessStatus: "open"
  };
}

export class GeoapifyBusinessDataProvider implements BusinessDataProvider {
  readonly name = "geoapify";
  readonly maxResults = 500;
  constructor(private readonly apiKey: string) {}

  async searchBusinesses(input: SearchInput): Promise<BusinessSearchResult> {
    const category = categoryMap[input.category.toLowerCase()];
    if (!category) throw new Error(`Geoapify does not have a verified category mapping for “${input.category}”. Use the mock provider or add a documented category mapping.`);
    const geocodeUrl = new URL("https://api.geoapify.com/v1/geocode/search");
    geocodeUrl.searchParams.set("text", [input.city, input.state, input.country].filter(Boolean).join(", "));
    geocodeUrl.searchParams.set("limit", "1"); geocodeUrl.searchParams.set("apiKey", this.apiKey);
    const retries = Number(process.env.PROVIDER_MAX_RETRIES ?? 3); const delay = Number(process.env.PROVIDER_REQUEST_DELAY_MS ?? 250);
    const geo = await retry(async () => { const r = await fetch(geocodeUrl); if (!r.ok) throw new Error(`Geoapify geocoding failed (${r.status})`); return r.json(); }, retries, delay) as { features?: Feature[] };
    const point = geo.features?.[0]?.geometry?.coordinates;
    if (!point) throw new Error("Location could not be resolved by Geoapify.");
    const placesUrl = new URL("https://api.geoapify.com/v2/places");
    placesUrl.searchParams.set("categories", category);
    placesUrl.searchParams.set("filter", `circle:${point[0]},${point[1]},${(input.radiusKm ?? 15) * 1000}`);
    placesUrl.searchParams.set("bias", `proximity:${point[0]},${point[1]}`);
    placesUrl.searchParams.set("limit", String(Math.min(input.resultCount, this.maxResults)));
    placesUrl.searchParams.set("apiKey", this.apiKey);
    await sleep(delay);
    const data = await retry(async () => { const r = await fetch(placesUrl); if (r.status === 429) throw new Error("Geoapify rate limit reached"); if (!r.ok) throw new Error(`Geoapify places failed (${r.status})`); return r.json(); }, retries, delay) as { features?: Feature[] };
    return { businesses: (data.features ?? []).map((f) => normalize(f, input)), attribution: "© OpenStreetMap contributors · Powered by Geoapify", warnings: [] };
  }
  async getBusinessDetails() { return null; }
}
