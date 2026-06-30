import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { assembleShortlist } from "./shortlist-assembler.js";
import type { PropertyListing } from "../types/index.js";
import type { CommuteResult } from "../services/commute-calculator.js";

/**
 * Property 8: Shortlist cap and count accuracy
 * Validates: Requirements 6.1, 6.5, 6.7
 *
 * For any set of N matching properties where N >= 0, the shortlist result SHALL
 * contain min(N, 20) properties, the hasMore flag SHALL be true if and only if
 * N > 20, totalMatching SHALL equal N, and totalEvaluated SHALL equal the number
 * of listings entering the filter pipeline.
 */

// --- Generators ---

/**
 * Generates a valid PropertyListing with a parseable fixed price string.
 */
function arbPropertyListing(index: number): fc.Arbitrary<PropertyListing> {
  return fc.record({
    id: fc.constant(`prop-${index}`),
    address: fc.constant(`${index} Test Street, Melbourne VIC`),
    priceText: fc.integer({ min: 100000, max: 5000000 }).map(
      (amount) => `$${amount.toLocaleString("en-AU")}`
    ),
    bedrooms: fc.integer({ min: 1, max: 6 }),
    landSizeSqm: fc.integer({ min: 50, max: 2000 }),
    storeys: fc.integer({ min: 1, max: 3 }),
    coordinates: fc.record({
      latitude: fc.double({ min: -38.5, max: -37.0, noNaN: true }),
      longitude: fc.double({ min: 144.5, max: 145.5, noNaN: true }),
    }),
    listedDate: fc.constant("2024-01-15"),
  });
}

/**
 * Generates N PropertyListings and matching CommuteResults where all commute
 * durations are non-null and ≤ maxCommuteMinutes, ensuring all pass the commute filter.
 */
const arbMatchingSet: fc.Arbitrary<{
  n: number;
  listings: PropertyListing[];
  commuteTimes: CommuteResult[];
  maxCommuteMinutes: number;
}> = fc
  .integer({ min: 0, max: 100 })
  .chain((n) =>
    fc
      .tuple(
        // Generate N listings
        n === 0
          ? fc.constant([] as PropertyListing[])
          : fc.tuple(...Array.from({ length: n }, (_, i) => arbPropertyListing(i))).map(
              (arr) => arr as PropertyListing[]
            ),
        // maxCommuteMinutes between 10 and 120
        fc.integer({ min: 10, max: 120 })
      )
      .chain(([listings, maxCommuteMinutes]) =>
        // Generate commute durations that are all ≤ maxCommuteMinutes (all pass)
        n === 0
          ? fc.constant({
              n,
              listings: [] as PropertyListing[],
              commuteTimes: [] as CommuteResult[],
              maxCommuteMinutes,
            })
          : fc
              .tuple(
                ...listings.map((listing) =>
                  fc.integer({ min: 1, max: maxCommuteMinutes }).map(
                    (duration): CommuteResult => ({
                      propertyId: listing.id,
                      durationMinutes: duration,
                      mode: "driving",
                    })
                  )
                )
              )
              .map((commuteTimes) => ({
                n,
                listings,
                commuteTimes: commuteTimes as CommuteResult[],
                maxCommuteMinutes,
              }))
      )
  );

// --- Property Tests ---

describe("Property 8: Shortlist cap and count accuracy", () => {
  it("result contains min(N, 20) properties for N matching listings", () => {
    fc.assert(
      fc.property(arbMatchingSet, ({ n, listings, commuteTimes, maxCommuteMinutes }) => {
        const result = assembleShortlist(listings, commuteTimes, maxCommuteMinutes);

        expect(result.properties.length).toBe(Math.min(n, 20));
      }),
      { numRuns: 200 }
    );
  });

  it("hasMore is true iff N > 20", () => {
    fc.assert(
      fc.property(arbMatchingSet, ({ n, listings, commuteTimes, maxCommuteMinutes }) => {
        const result = assembleShortlist(listings, commuteTimes, maxCommuteMinutes);

        expect(result.hasMore).toBe(n > 20);
      }),
      { numRuns: 200 }
    );
  });

  it("totalMatching equals N (all matching properties counted)", () => {
    fc.assert(
      fc.property(arbMatchingSet, ({ n, listings, commuteTimes, maxCommuteMinutes }) => {
        const result = assembleShortlist(listings, commuteTimes, maxCommuteMinutes);

        expect(result.totalMatching).toBe(n);
      }),
      { numRuns: 200 }
    );
  });

  it("totalEvaluated equals the number of listings passed to the assembler", () => {
    fc.assert(
      fc.property(arbMatchingSet, ({ n, listings, commuteTimes, maxCommuteMinutes }) => {
        const result = assembleShortlist(listings, commuteTimes, maxCommuteMinutes);

        expect(result.totalEvaluated).toBe(n);
      }),
      { numRuns: 200 }
    );
  });

  it("all four count properties hold simultaneously", () => {
    fc.assert(
      fc.property(arbMatchingSet, ({ n, listings, commuteTimes, maxCommuteMinutes }) => {
        const result = assembleShortlist(listings, commuteTimes, maxCommuteMinutes);

        // Cap: min(N, 20) properties returned
        expect(result.properties.length).toBe(Math.min(n, 20));
        // hasMore flag
        expect(result.hasMore).toBe(n > 20);
        // Total matching count
        expect(result.totalMatching).toBe(n);
        // Total evaluated count
        expect(result.totalEvaluated).toBe(n);
      }),
      { numRuns: 200 }
    );
  });
});
