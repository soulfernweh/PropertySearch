/**
 * Core domain types for the Property Search Shortlist system.
 */

// --- Enums and Literal Types ---

/** Transport mode for commute calculation */
export type CommuteMode = "driving" | "public_transport" | "cycling" | "walking";

/** User's preference for property storeys */
export type StoreyPreference = "single" | "double" | "any";

// --- Geographic Types ---

/** Geographic coordinates (WGS84) */
export interface GeoCoordinates {
  latitude: number;   // -90 to 90
  longitude: number;  // -180 to 180
}

// --- Search Criteria ---

/** Complete set of user-provided search filters */
export interface SearchCriteria {
  maxBudget: number;                    // AUD, 100,000–10,000,000
  workAddress: string;                  // Street address string
  maxCommuteMinutes: number;            // 5–120
  commuteMode: CommuteMode;
  minBedrooms?: number;                 // 1–6, optional
  minLandSize?: number;                 // 0–2000 sqm, optional
  storeyPreference?: StoreyPreference;  // optional
}

// --- Price Parsing ---

/** Structured representation of parsed Australian property price strings */
export type PriceFormat =
  | { type: "fixed"; amount: number }
  | { type: "range"; lower: number; upper: number }
  | { type: "plus"; minimum: number }
  | { type: "offers_over"; amount: number }
  | { type: "unparseable" };

// --- Listing Types ---

/** Raw listing from external API (may have null fields) */
export interface RawListing {
  id: string;
  address: string;
  suburb: string;
  state: "VIC" | "NSW";
  priceText: string;
  bedrooms: number | null;
  landSizeSqm: number | null;
  storeys: number | null;
  coordinates: GeoCoordinates | null;
  listedDate: string;
  status: "for_sale" | "sold" | "withdrawn" | "off_market";
  listingUrl: string;
}

/** Validated property listing (all required fields present and non-null) */
export interface PropertyListing {
  id: string;
  address: string;
  priceText: string;
  bedrooms: number;
  landSizeSqm: number;
  storeys: number;
  coordinates: GeoCoordinates;
  listedDate: string;
  listingUrl?: string;
}

// --- Shortlist Types ---

/** Final shortlisted property for presentation */
export interface ShortlistedProperty {
  id: string;
  address: string;
  priceText: string;
  priceAud: number;
  bedrooms: number;
  landSizeSqm: number;
  storeys: number;
  commuteMinutes: number;
  listingUrl?: string;
}

// --- User Profile ---

/** User profile for persistence */
export interface UserProfile {
  id: string;
  searchCriteria: SearchCriteria;
  lastUpdated: string;  // ISO timestamp
}
