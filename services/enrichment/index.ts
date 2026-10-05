import type { NormalizedBusiness } from "@/providers/business/BusinessDataProvider";
import { classifyWebsite } from "@/services/website-analysis";

export function enrichBusiness(business: NormalizedBusiness) {
  const websiteStatus = classifyWebsite(business.websiteUrl);
  let websiteDomain: string | undefined;
  if (websiteStatus === "has_website" && business.websiteUrl) {
    try { websiteDomain = new URL(business.websiteUrl).hostname.replace(/^www\./, ""); } catch { /* classification already handles this */ }
  }
  return { websiteStatus, websiteDomain };
}
