import { z } from "zod";

export const searchInputSchema = z.object({
  country: z.string().trim().min(2).max(100),
  state: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(120),
  rawQuery: z.string().trim().min(2).max(160),
  resultCount: z.number().int().min(1).max(500),
  minimumRating: z.number().min(0).max(5).optional(),
  minimumReviews: z.number().int().min(0).max(1000000).optional(),
  websiteFilter: z.enum(["any", "no_website", "has_website"]),
  businessStatus: z.enum(["open", "any"]),
  radiusKm: z.number().min(1).max(100).optional()
});

export const businessPatchSchema = z.object({
  leadStatus: z.enum(["new", "contacted", "interested", "not_interested", "converted"]).optional(),
  notes: z.string().max(5000).optional()
}).refine((value) => Object.keys(value).length > 0, "At least one field is required");
