import type { SearchInput } from "@/lib/types";

export interface NormalizedBusiness {
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
}

export interface BusinessSearchResult { businesses: NormalizedBusiness[]; attribution: string; warnings: string[]; }
export interface BusinessDataProvider {
  readonly name: string;
  readonly maxResults: number;
  searchBusinesses(params: SearchInput): Promise<BusinessSearchResult>;
  getBusinessDetails(id: string): Promise<NormalizedBusiness | null>;
}
