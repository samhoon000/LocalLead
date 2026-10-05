export type JobStatus = "queued" | "discovering" | "enriching" | "analyzing" | "scoring" | "completed" | "failed" | "cancelled";
export type WebsiteStatus = "unknown" | "has_website" | "no_website" | "uncertain";
export type LeadStatus = "new" | "contacted" | "interested" | "not_interested" | "converted";

export interface SearchInput {
  country: string;
  state?: string;
  city: string;
  category: string;
  rawQuery: string;
  resultCount: number;
  minimumRating?: number;
  minimumReviews?: number;
  websiteFilter: "any" | "no_website" | "has_website";
  businessStatus: "open" | "any";
  radiusKm?: number;
}

export interface WebsiteAnalysis {
  id: string;
  businessId: string;
  qualityScore: number;
  httpsEnabled: boolean;
  mobileFriendly: boolean;
  hasTitle: boolean;
  hasMetaDescription: boolean;
  hasContactInfo: boolean;
  hasPhoneCta: boolean;
  hasEmailCta: boolean;
  hasContactForm: boolean;
  hasBooking: boolean;
  hasClearCta: boolean;
  servicesExplained: boolean;
  locationVisible: boolean;
  hasSocialLinks: boolean;
  issues: string[];
  checkedAt: string;
  error?: string;
}

export interface LeadScore {
  score: number;
  label: "High opportunity" | "Good opportunity" | "Possible opportunity" | "Low opportunity";
  factors: { label: string; points: number }[];
}

export interface Business {
  id: string;
  searchId: string;
  provider: string;
  providerBusinessId: string;
  name: string;
  category: string;
  subcategory?: string;
  country: string;
  state?: string;
  city: string;
  postalCode?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  mapsUrl?: string;
  providerUrl?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: string;
  businessStatus: string;
  websiteUrl?: string;
  websiteDomain?: string;
  websiteStatus: WebsiteStatus;
  analysis?: WebsiteAnalysis;
  leadScore: LeadScore;
  leadStatus: LeadStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobEvent { id: string; jobId: string; stage: JobStatus; message: string; createdAt: string; }
export interface DiscoveryJob { id: string; searchId: string; status: JobStatus; progress: number; processed: number; total: number; error?: string; events: JobEvent[]; createdAt: string; updatedAt: string; }
export interface SearchRecord extends SearchInput { id: string; userId: string; name: string; status: JobStatus; jobId: string; businesses: Business[]; createdAt: string; updatedAt: string; }
