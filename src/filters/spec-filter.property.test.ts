import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { filterBySpecs, SpecFilterCriteria } from "./spec-filter.js";
import { PropertyListing, StoreyPreference, GeoCoordinates } from "../types/index.js";

/**
 * Property 5: Property specification filtering
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.7
 *
 * For any PropertyListing and for any combination of optional filter criteria
 * (minBedrooms, minLandSize, storeyPreference), the listing SHALL be included
 * if and only if:
 *   (a) minBedrooms is undefined OR listing.bedrooms >= minBedrooms, AND
 *   (b) minLandSize is undefined OR listing.landSizeSqm >= minLandSize, AND
 *   (c) storeyPreference is "any" or undefined OR
 *       (storeyPreference is "single" AND listing.storeys == 1) OR
 *       (storeyPreference is "double" AND listing.storeys >= 2).
 */

// --- Generators ---

const arbCoordinates: fc.Arbitrary<GeoCoordinates> = fc.record({
  latitude: fc.double({ min: -38.5, max: -33.5, noNaN: true, noDefaultInfinity: true }),
  longitude: fc.double({ min: 144.5, max: 151.5, noNaN: true, noDefaultInfinity: true }),
});

const arbPropertyListing: fc.Arbitrary<PropertyListing> = fc.record({
  id: fc.uuid(),
  address: fc.string({ minLength: 5, maxLength: 80 }),
  priceText: fc.constant("$750,000"),
  bedrooms: fc.integer({ min: 1, max: 10 }),
  landSizeSqm: fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
  storeys: fc.integer({ min: 1, max: 4 }),
  coordinates: arbCoordinates,
  listedDate: fc.constant("2024-01-15"),
  listingUrl: fc.option(fc.webUrl(), { nil: undefined }),
});

const arbStoreyPreference: fc.Arbitrary<StoreyPreference> = fc.constantFrom(
  "single",
  "double",
  "any"
);

const arbSpecFilterCriteria: fc.Arbitrary<SpecFilterCriteria> = fc.record({
  minBedrooms: fc.option(fc.integer({ min: 1, max: 6 }), { nil: undefined }),
  minLandSize: fc.option(fc.double({ min: 0, max: 2000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
  storeyPreference: fc.option(arbStoreyPreference, { nil: undefined }),
});

// --- Helper: reference implementation of the expected filtering logic ---

function shouldInclude(listing: PropertyListing, criteria: SpecFilterCriteria): boolean {
  // (a) minBedrooms check
  if (criteria.minBedrooms !== undefined && listing.bedrooms < criteria.minBedrooms) {
    return false;
  }

  // (b) minLandSize check
  if (criteria.minLandSize !== undefined && listing.landSizeSqm < criteria.minLandSize) {
    return false;
  }

  // (c) storeyPreference check
  if (criteria.storeyPreference !== undefined && criteria.storeyPreference !== "any") {
    if (criteria.storeyPreference === "single" && listing.storeys !== 1) {
      return false;
    }
    if (criteria.storeyPreference === "double" && listing.storeys < 2) {
      return false;
    }
  }

  return true;
}

// --- Property Tests ---

describe("Property 5: Property specification filtering", () => {
  it("includes a listing iff all active filter conditions are met simultaneously", () => {
    fc.assert(
      fc.property(
        fc.array(arbPropertyListing, { minLength: 0, maxLength: 30 }),
        arbSpecFilterCriteria,
        (listings, criteria) => {
          const result = filterBySpecs(listings, criteria);

          // Every listing in the result should pass all conditions
          for (const included of result) {
            expect(shouldInclude(included, criteria)).toBe(true);
          }

          // Every listing NOT in the result should fail at least one condition
          const resultIds = new Set(result.map((l) => l.id));
          for (const listing of listings) {
            if (!resultIds.has(listing.id)) {
              expect(shouldInclude(listing, criteria)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("returns all listings when all criteria are undefined (no filtering)", () => {
    fc.assert(
      fc.property(
        fc.array(arbPropertyListing, { minLength: 0, maxLength: 20 }),
        (listings) => {
          const criteria: SpecFilterCriteria = {};
          const result = filterBySpecs(listings, criteria);
          expect(result.length).toBe(listings.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns all listings when storeyPreference is 'any' and other fields undefined", () => {
    fc.assert(
      fc.property(
        fc.array(arbPropertyListing, { minLength: 0, maxLength: 20 }),
        (listings) => {
          const criteria: SpecFilterCriteria = { storeyPreference: "any" };
          const result = filterBySpecs(listings, criteria);
          expect(result.length).toBe(listings.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("bedroom filter: listing included iff bedrooms >= minBedrooms", () => {
    fc.assert(
      fc.property(
        arbPropertyListing,
        fc.integer({ min: 1, max: 6 }),
        (listing, minBedrooms) => {
          const criteria: SpecFilterCriteria = { minBedrooms };
          const result = filterBySpecs([listing], criteria);

          if (listing.bedrooms >= minBedrooms) {
            expect(result).toHaveLength(1);
          } else {
            expect(result).toHaveLength(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("land size filter: listing included iff landSizeSqm >= minLandSize", () => {
    fc.assert(
      fc.property(
        arbPropertyListing,
        fc.double({ min: 0, max: 2000, noNaN: true, noDefaultInfinity: true }),
        (listing, minLandSize) => {
          const criteria: SpecFilterCriteria = { minLandSize };
          const result = filterBySpecs([listing], criteria);

          if (listing.landSizeSqm >= minLandSize) {
            expect(result).toHaveLength(1);
          } else {
            expect(result).toHaveLength(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("storey preference 'single': listing included iff storeys == 1", () => {
    fc.assert(
      fc.property(arbPropertyListing, (listing) => {
        const criteria: SpecFilterCriteria = { storeyPreference: "single" };
        const result = filterBySpecs([listing], criteria);

        if (listing.storeys === 1) {
          expect(result).toHaveLength(1);
        } else {
          expect(result).toHaveLength(0);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("storey preference 'double': listing included iff storeys >= 2", () => {
    fc.assert(
      fc.property(arbPropertyListing, (listing) => {
        const criteria: SpecFilterCriteria = { storeyPreference: "double" };
        const result = filterBySpecs([listing], criteria);

        if (listing.storeys >= 2) {
          expect(result).toHaveLength(1);
        } else {
          expect(result).toHaveLength(0);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("filters are conjunctive: all conditions must be met simultaneously", () => {
    fc.assert(
      fc.property(
        arbPropertyListing,
        fc.integer({ min: 1, max: 6 }),
        fc.double({ min: 0, max: 2000, noNaN: true, noDefaultInfinity: true }),
        arbStoreyPreference,
        (listing, minBedrooms, minLandSize, storeyPreference) => {
          const criteria: SpecFilterCriteria = { minBedrooms, minLandSize, storeyPreference };
          const result = filterBySpecs([listing], criteria);

          const expected = shouldInclude(listing, criteria);
          if (expected) {
            expect(result).toHaveLength(1);
          } else {
            expect(result).toHaveLength(0);
          }
        }
      ),
      { numRuns: 300 }
    );
  });
});
