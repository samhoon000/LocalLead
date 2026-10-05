import type { BusinessDataProvider } from "./BusinessDataProvider";
import { MockBusinessDataProvider } from "./mock";
import { GeoapifyBusinessDataProvider } from "./geoapify";

export function getBusinessProvider(): BusinessDataProvider {
  const provider = (process.env.BUSINESS_DATA_PROVIDER ?? "mock").toLowerCase();
  if (provider === "geoapify") {
    const key = process.env.GEOAPIFY_API_KEY ?? process.env.BUSINESS_DATA_PROVIDER_API_KEY;
    if (!key) throw new Error("GEOAPIFY_API_KEY is required when BUSINESS_DATA_PROVIDER=geoapify");
    return new GeoapifyBusinessDataProvider(key);
  }
  return new MockBusinessDataProvider();
}
