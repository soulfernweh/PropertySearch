import { RawListing, PropertyListing } from "../types/index.js";

/**
 * Result of validating a batch of raw listings.
 * - valid: listings with all required fields present, converted to PropertyListing
 * - excluded: listings missing one or more required fields
 */
export interface ListingValidationResult {
  valid: PropertyListing[];
  excluded: RawListing[];
}

/**
 * Checks whether a RawListing has all required fields present and non-null:
 * - priceText must be a non-empty string
 * - bedrooms must not be null
 * - landSizeSqm must not be null
 * - storeys must not be null
 * - coordinates must not be null
 */
function isComplete(listing: RawListing): boolean {
  return (
    listing.priceText.trim().length > 0 &&
    listing.bedrooms !== null &&
    listing.landSizeSqm !== null &&
    listing.storeys !== null &&
    listing.coordinates !== null
  );
}

/**
 * Converts a complete RawListing to a PropertyListing.
 * Only call this after verifying isComplete() returns true.
 */
function toPropertyListing(listing: RawListing): PropertyListing {
  return {
    id: listing.id,
    address: listing.address,
    priceText: listing.priceText,
    bedrooms: listing.bedrooms!,
    landSizeSqm: listing.landSizeSqm!,
    storeys: listing.storeys!,
    coordinates: listing.coordinates!,
    listedDate: listing.listedDate,
    listingUrl: listing.listingUrl,
  };
}

/**
 * Validates an array of RawListings, separating them into valid PropertyListings
 * (all required fields present) and excluded RawListings (missing fields).
 *
 * Requirements: 2.4, 2.5, 5.6
 */
export function validateListings(listings: RawListing[]): ListingValidationResult {
  const valid: PropertyListing[] = [];
  const excluded: RawListing[] = [];

  for (const listing of listings) {
    if (isComplete(listing)) {
      valid.push(toPropertyListing(listing));
    } else {
      excluded.push(listing);
    }
  }

  return { valid, excluded };
}
