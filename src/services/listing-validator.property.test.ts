import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validateListings } from "./listing-validator.js";
import { RawListing, GeoCoordinates } from "../types/index.js";

/**
 * Property 2: Listing completeness filter excludes incomplete listings
 * Validates: Requirements 2.4, 2.5, 5.6
 *
 * For any raw listing, if all required fields (price text, bedrooms, land size,
 * storeys, coordinates) are present and non-null, the listing SHALL be included
 * in the validated set. If any required field is null or missing, the listing
 * SHALL be excluded from the validated set.
 */

// --- Generators ---

const arbCoordinates: fc.Arbitrary<GeoCoordinates> = fc.record({
  latitude: fc.double({ min: -38.5, max: -33.5, noNaN: true, noDefaultInfinity: true }),
  longitude: fc.double({ min: 144.5, max: 151.5, noNaN: true, noDefaultInfinity: true }),
});

const arbState: fc.Arbitrary<"VIC" | "NSW"> = fc.constantFrom("VIC", "NSW");

const arbStatus: fc.Arbitrary<"for_sale" | "sold" | "withdrawn" | "off_market"> =
  fc.constantFrom("for_sale", "sold", "withdrawn", "off_market");

/** Generator for a complete RawListing where ALL required fields are present and non-null */
const arbCompleteRawListing: fc.Arbitrary<RawListing> = fc.record({
  id: fc.uuid(),
  address: fc.string({ minLength: 5, maxLength: 80 }),
  suburb: fc.string({ minLength: 3, maxLength: 30 }),
  state: arbState,
  priceText: fc.stringMatching(/^\$[1-9]\d{2},\d{3}$/), // e.g. "$750,000"
  bedrooms: fc.integer({ min: 1, max: 10 }),
  landSizeSqm: fc.double({ min: 10, max: 5000, noNaN: true, noDefaultInfinity: true }),
  storeys: fc.integer({ min: 1, max: 4 }),
  coordinates: arbCoordinates,
  listedDate: fc.constant("2024-01-15"),
  status: arbStatus,
  listingUrl: fc.webUrl(),
});

/** Generator for a RawListing with at least one null required field */
const arbIncompleteRawListing: fc.Arbitrary<RawListing> = fc
  .record({
    id: fc.uuid(),
    address: fc.string({ minLength: 5, maxLength: 80 }),
    suburb: fc.string({ minLength: 3, maxLength: 30 }),
    state: arbState,
    priceText: fc.oneof(
      fc.stringMatching(/^\$[1-9]\d{2},\d{3}$/),
      fc.constant("") // empty priceText counts as incomplete
    ),
    bedrooms: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
    landSizeSqm: fc.option(fc.double({ min: 10, max: 5000, noNaN: true, noDefaultInfinity: true }), { nil: null }),
    storeys: fc.option(fc.integer({ min: 1, max: 4 }), { nil: null }),
    coordinates: fc.option(arbCoordinates, { nil: null }),
    listedDate: fc.constant("2024-01-15"),
    status: arbStatus,
    listingUrl: fc.webUrl(),
  })
  .filter((listing) => {
    // At least one required field must be null or priceText must be empty
    return (
      listing.priceText.trim().length === 0 ||
      listing.bedrooms === null ||
      listing.landSizeSqm === null ||
      listing.storeys === null ||
      listing.coordinates === null
    );
  });

// --- Helper: reference implementation ---

function isComplete(listing: RawListing): boolean {
  return (
    listing.priceText.trim().length > 0 &&
    listing.bedrooms !== null &&
    listing.landSizeSqm !== null &&
    listing.storeys !== null &&
    listing.coordinates !== null
  );
}

// --- Property Tests ---

describe("Property 2: Listing completeness filter excludes incomplete listings", () => {
  it("includes listings when ALL required fields are present and non-null", () => {
    fc.assert(
      fc.property(
        fc.array(arbCompleteRawListing, { minLength: 1, maxLength: 20 }),
        (listings) => {
          const result = validateListings(listings);

          // All complete listings should be in the valid set
          expect(result.valid).toHaveLength(listings.length);
          expect(result.excluded).toHaveLength(0);

          // Each valid listing should have the correct field values
          for (let i = 0; i < listings.length; i++) {
            const raw = listings[i];
            const valid = result.valid[i];
            expect(valid.id).toBe(raw.id);
            expect(valid.bedrooms).toBe(raw.bedrooms);
            expect(valid.landSizeSqm).toBe(raw.landSizeSqm);
            expect(valid.storeys).toBe(raw.storeys);
            expect(valid.coordinates).toEqual(raw.coordinates);
            expect(valid.priceText).toBe(raw.priceText);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("excludes listings when ANY required field is null or missing", () => {
    fc.assert(
      fc.property(
        fc.array(arbIncompleteRawListing, { minLength: 1, maxLength: 20 }),
        (listings) => {
          const result = validateListings(listings);

          // All incomplete listings should be in the excluded set
          expect(result.excluded).toHaveLength(listings.length);
          expect(result.valid).toHaveLength(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("mixed array: listing included iff ALL required fields non-null AND priceText non-empty", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(arbCompleteRawListing, arbIncompleteRawListing),
          { minLength: 0, maxLength: 30 }
        ),
        (listings) => {
          const result = validateListings(listings);

          // Verify the invariant: included iff complete
          const expectedValidCount = listings.filter(isComplete).length;
          const expectedExcludedCount = listings.length - expectedValidCount;

          expect(result.valid).toHaveLength(expectedValidCount);
          expect(result.excluded).toHaveLength(expectedExcludedCount);

          // Every valid listing should satisfy completeness
          for (const valid of result.valid) {
            // PropertyListing fields are non-null by type, but verify mapping is correct
            expect(valid.bedrooms).not.toBeNull();
            expect(valid.landSizeSqm).not.toBeNull();
            expect(valid.storeys).not.toBeNull();
            expect(valid.coordinates).not.toBeNull();
            expect(valid.priceText.trim().length).toBeGreaterThan(0);
          }

          // Every excluded listing should have at least one null/missing field
          for (const excluded of result.excluded) {
            expect(isComplete(excluded)).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("empty input returns empty valid and excluded arrays", () => {
    const result = validateListings([]);
    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(0);
  });
});
