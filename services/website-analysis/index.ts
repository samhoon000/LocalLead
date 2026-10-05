import type { WebsiteAnalysis } from "@/lib/types";
import { id } from "@/lib/utils";

const directoryHosts = ["facebook.com", "instagram.com", "yelp.com", "google.com", "maps.google.com", "tripadvisor.com", "yellowpages.com"];

export function classifyWebsite(url?: string): "has_website" | "no_website" | "uncertain" {
  if (!url) return "no_website";
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return directoryHosts.some((directory) => host === directory || host.endsWith(`.${directory}`)) ? "uncertain" : "has_website";
  } catch { return "uncertain"; }
}

export async function analyzeWebsite(businessId: string, url: string): Promise<WebsiteAnalysis> {
  if (url.endsWith(".example")) {
    const n = [...url].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const good = (offset: number) => (n + offset) % 4 !== 0;
    const flags = { httpsEnabled: true, mobileFriendly: good(1), hasTitle: true, hasMetaDescription: good(2), hasContactInfo: true, hasPhoneCta: good(3), hasEmailCta: good(4), hasContactForm: good(5), hasBooking: good(6), hasClearCta: good(7), servicesExplained: true, locationVisible: good(8), hasSocialLinks: good(9) };
    return finish(businessId, flags);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.WEBSITE_ANALYSIS_TIMEOUT_MS ?? 8000));
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow", headers: { "User-Agent": "LocalLeadWebsiteChecker/1.0 (+public-site-analysis)" } });
    if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`);
    const html = (await response.text()).slice(0, 1_000_000);
    const lower = html.toLowerCase();
    return finish(businessId, {
      httpsEnabled: response.url.startsWith("https://"), mobileFriendly: /<meta[^>]+name=["']viewport["']/i.test(html), hasTitle: /<title[^>]*>\s*[^<]+/i.test(html),
      hasMetaDescription: /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+/i.test(html) || /<meta[^>]+content=["'][^"']+["'][^>]+name=["']description["']/i.test(html),
      hasContactInfo: /(contact|tel:|mailto:)/i.test(html), hasPhoneCta: /href=["']tel:/i.test(html), hasEmailCta: /href=["']mailto:/i.test(html),
      hasContactForm: /<form[\s>]/i.test(html), hasBooking: /(book now|appointment|reservation|schedule)/i.test(html), hasClearCta: /(get a quote|contact us|call now|book now|schedule|request)/i.test(html),
      servicesExplained: /(services|what we do|our work)/i.test(html), locationVisible: /(address|location|find us|directions)/i.test(html), hasSocialLinks: /(facebook\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com)/i.test(lower)
    });
  } catch (error) {
    return { ...finish(businessId, { httpsEnabled: url.startsWith("https://"), mobileFriendly: false, hasTitle: false, hasMetaDescription: false, hasContactInfo: false, hasPhoneCta: false, hasEmailCta: false, hasContactForm: false, hasBooking: false, hasClearCta: false, servicesExplained: false, locationVisible: false, hasSocialLinks: false }), error: error instanceof Error ? error.message : "Website check failed" };
  } finally { clearTimeout(timeout); }
}

type Flags = Omit<WebsiteAnalysis, "id" | "businessId" | "qualityScore" | "issues" | "checkedAt" | "error">;
function finish(businessId: string, flags: Flags): WebsiteAnalysis {
  const weights: [keyof Flags, number, string][] = [
    ["httpsEnabled", 10, "HTTPS is not enabled"], ["mobileFriendly", 15, "Mobile viewport is missing"], ["hasTitle", 5, "Page title is missing"], ["hasMetaDescription", 5, "Meta description is missing"],
    ["hasContactInfo", 10, "Contact information is hard to find"], ["hasPhoneCta", 5, "No tap-to-call link"], ["hasEmailCta", 5, "No email link"], ["hasContactForm", 10, "No contact form"],
    ["hasBooking", 5, "No booking functionality detected"], ["hasClearCta", 10, "No clear primary CTA"], ["servicesExplained", 8, "Services are not clearly explained"],
    ["locationVisible", 7, "Location is not clearly visible"], ["hasSocialLinks", 5, "No social links detected"]
  ];
  const qualityScore = weights.reduce((sum, [key, weight]) => sum + (flags[key] ? weight : 0), 0);
  const issues = weights.filter(([key]) => !flags[key]).map(([, , issue]) => issue);
  return { id: id(), businessId, qualityScore, ...flags, issues, checkedAt: new Date().toISOString() };
}
