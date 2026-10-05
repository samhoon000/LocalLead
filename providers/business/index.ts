import type { BusinessDataProvider } from "./BusinessDataProvider";
import { MockBusinessDataProvider } from "./mock";
import { GeoapifyBusinessDataProvider } from "./geoapify";
import { getBusinessProviderName, getGeoapifyKey } from "@/lib/server-env";

export function getBusinessProvider(): BusinessDataProvider {
  const provider = getBusinessProviderName();
  if (provider === "geoapify") {
    return new GeoapifyBusinessDataProvider(getGeoapifyKey());
  }
  if (provider === "mock" && process.env.NODE_ENV !== "production") return new MockBusinessDataProvider();
  throw new Error(`Unsupported BUSINESS_DATA_PROVIDER: ${provider}`);
}
