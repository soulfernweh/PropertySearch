/**
 * Listing fetcher service — retrieves property listings from the Domain API
 * and maps them to the internal RawListing type.
 */

import axios from "axios";
import type { RawListing } from "../types/index.js";
import type { DomainListingResponse } from "../types/api.js";

/** Result of a listing fetch operation */
export interface FetchResult {
  success: boolean;
  listings: RawListing[];
  error?: string;
}

const DOMAIN_API_URL =
  "https://api.domain.com.au/v1/listings/residential/_search";
const TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESULTS = 500;

/**
 * Map a region name to the Domain API state code.
 */
function regionToState(region: "melbourne" | "sydney"): "VIC" | "NSW" {
  return region === "melbourne" ? "VIC" : "NSW";
}

/**
 * Map a DomainListingResponse to a RawListing.
 */
function mapToRawListing(response: DomainListingResponse): RawListing {
  const { listing } = response;
  const { propertyDetails, priceDetails } = listing;

  return {
    id: String(response.id),
    address: propertyDetails.displayableAddress,
    suburb: propertyDetails.suburb,
    state: propertyDetails.state as "VIC" | "NSW",
    priceText: priceDetails.displayPrice,
    bedrooms: propertyDetails.bedrooms ?? null,
    landSizeSqm: propertyDetails.landArea ?? null,
    storeys: null, // Domain API does not provide storeys directly; inferred from features if available
    coordinates:
      propertyDetails.latitude != null && propertyDetails.longitude != null
        ? {
            latitude: propertyDetails.latitude,
            longitude: propertyDetails.longitude,
          }
        : null,
    listedDate: listing.dateListed,
    status: "for_sale",
    listingUrl: `https://www.domain.com.au/${listing.listingSlug}`,
  };
}

/**
 * Fetch property listings from the Domain API for a given region.
 *
 * - Filters to "for_sale" listings only.
 * - Maps Domain API responses to RawListing type.
 * - Enforces a 30-second timeout.
 * - Caps results at maxResults (default 500).
 *
 * @param region - Target region ("melbourne" or "sydney")
 * @param maxResults - Maximum number of listings to return (default 500)
 * @returns FetchResult with success status and listings or error
 */
export async function fetchListings(
  region: "melbourne" | "sydney",
  maxResults: number = DEFAULT_MAX_RESULTS
): Promise<FetchResult> {
  const apiKey = process.env.DOMAIN_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      listings: [],
      error: "DOMAIN_API_KEY environment variable is not set",
    };
  }

  const cap = Math.min(Math.max(1, maxResults), DEFAULT_MAX_RESULTS);

  try {
    const response = await axios.post<DomainListingResponse[]>(
      DOMAIN_API_URL,
      {
        listingType: "Sale",
        locations: [
          {
            state: regionToState(region),
            region: "",
          },
        ],
        pageSize: cap,
      },
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: TIMEOUT_MS,
      }
    );

    const { data } = response;

    if (!Array.isArray(data)) {
      return {
        success: false,
        listings: [],
        error: "Unexpected response format from Domain API",
      };
    }

    // Filter to for_sale listings only and map to RawListing
    const listings: RawListing[] = data
      .filter(
        (item) =>
          item.listing &&
          item.listing.listingType &&
          item.listing.listingType.toLowerCase() === "sale"
      )
      .slice(0, cap)
      .map(mapToRawListing);

    return {
      success: true,
      listings,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return {
          success: false,
          listings: [],
          error: "Domain API request timed out after 30 seconds",
        };
      }
      return {
        success: false,
        listings: [],
        error: `Domain API request failed: ${error.message}`,
      };
    }

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      listings: [],
      error: `Domain API request failed: ${message}`,
    };
  }
}
