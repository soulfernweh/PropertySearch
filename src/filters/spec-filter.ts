import { PropertyListing, StoreyPreference } from "../types/index.js";

/**
 * Criteria for filtering property listings by specifications.
 * All fields are optional — when a field is undefined, that dimension is not filtered.
 */
export interface SpecFilterCriteria {
  minBedrooms?: number;
  minLandSize?: number;
  storeyPreference?: StoreyPreference;
}

/**
 * Filters property listings by bedroom count, land size, and storey preference.
 *
 * A listing is included only if it passes ALL active filters simultaneously:
 * - minBedrooms defined → listing.bedrooms must be >= minBedrooms
 * - minLandSize defined → listing.landSizeSqm must be >= minLandSize
 * - storeyPreference:
 *     "single" → listing.storeys must be exactly 1 (excludes >1)
 *     "double" → listing.storeys must be >= 2 (excludes <2)
 *     "any" or undefined → no storey filtering
 */
export function filterBySpecs(
  listings: PropertyListing[],
  criteria: SpecFilterCriteria
): PropertyListing[] {
  return listings.filter((listing) => {
    // Check minimum bedrooms
    if (criteria.minBedrooms !== undefined && listing.bedrooms < criteria.minBedrooms) {
      return false;
    }

    // Check minimum land size
    if (criteria.minLandSize !== undefined && listing.landSizeSqm < criteria.minLandSize) {
      return false;
    }

    // Check storey preference
    if (criteria.storeyPreference !== undefined && criteria.storeyPreference !== "any") {
      if (criteria.storeyPreference === "single" && listing.storeys > 1) {
        return false;
      }
      if (criteria.storeyPreference === "double" && listing.storeys < 2) {
        return false;
      }
    }

    return true;
  });
}
