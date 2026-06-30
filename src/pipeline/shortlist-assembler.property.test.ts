import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { PropertyListing } from "../types/index.js";
import type { CommuteResult } from "../services/commute-calculator.js";
import { assembleShortlist } from "./shortlist-assembler.js";

/**
 * Property 7: Shortlist sort invariant
 * Validates: Requirements 6.3
 *
 * For any shortlist result containing two or more properties, for every adjacent
 * pair (property[i], property[i+1]), either property[i].commuteMinutes <
 * property[i+1].commuteMinutes, OR (property[i].commuteMinutes ==
 * property[i+1].commuteMinutes AND property[i].priceAud <= property[i+1].priceAud).
 */

// --- Generators ---

/** Generates a parseable Australian price string with a known numeric value */
const arbPriceText: fc.Arbitrary<string> = fc
  .integer({ min: 100_000, max: 10_000_000 })
  .map((amount) => {
    const formatted = amount.toLocaleString("en-AU");
    return `$${formatted}`;
  });

/** Generates a valid PropertyListing with a parseable price */
const arbPropertyListing: fc.Arbitrary<PropertyListing> = fc.record({
  id: fc.uuid(),
  address: fc.string({ minLength: 5, maxLength: 60 }),
  priceText: arbPriceText,
  bedrooms: fc.integer({ min: 1, max: 6 }),
  landSizeSqm: fc.integer({ min: 50, max: 2000 }),
  storeys: fc.integer({ min: 1, max: 3 }),
  coordinates: fc.record({
    latitude: fc.double({ min: -38.5, max: -33.5, noNaN: true }),
    longitude: fc.double({ min: 144.5, max: 151.5, noNaN: true }),
  }),
  listedDate: fc.constantFrom("2024-01-15", "2024-06-01", "2024-12-31", "2025-03-20"),
});

/** maxCommuteMinutes for the assembler */
const arbMaxCommuteMinutes: fc.Arbitrary<number> = fc.integer({ min: 30, max: 120 });

// --- Property Tests ---

describe("Property 7: Shortlist sort invariant", () => {
  it("for every adjacent pair: commute[i] < commute[i+1] OR (commute[i] == commute[i+1] AND price[i] <= price[i+1])", () => {
    fc.assert(
      fc.property(
        arbMaxCommuteMinutes,
        fc.array(
          fc.tuple(arbPropertyListing, fc.integer({ min: 1, max: 120 })),
          { minLength: 2, maxLength: 50 }
        ),
        (maxCommute, pairs) => {
          const listings: PropertyListing[] = [];
          const commuteTimes: CommuteResult[] = [];

          pairs.forEach(([listing, duration], index) => {
            // Clamp duration to maxCommute so all listings pass the filter
            const clampedDuration = Math.min(duration, maxCommute);
            const uniqueListing = { ...listing, id: `prop-${index}` };
            listings.push(uniqueListing);
            commuteTimes.push({
              propertyId: uniqueListing.id,
              durationMinutes: clampedDuration,
              mode: "driving",
            });
          });

          const result = assembleShortlist(
            listings,
            commuteTimes,
            maxCommute
          );

          // Check sort invariant for every adjacent pair
          for (let i = 0; i < result.properties.length - 1; i++) {
            const current = result.properties[i];
            const next = result.properties[i + 1];

            const commuteOrdered =
              current.commuteMinutes < next.commuteMinutes;
            const commuteTied =
              current.commuteMinutes === next.commuteMinutes;
            const priceOrdered = current.priceAud <= next.priceAud;

            expect(
              commuteOrdered || (commuteTied && priceOrdered),
              `Sort invariant violated at index ${i}: ` +
                `commute[${i}]=${current.commuteMinutes}, commute[${i + 1}]=${next.commuteMinutes}, ` +
                `price[${i}]=${current.priceAud}, price[${i + 1}]=${next.priceAud}`
            ).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("sort invariant holds with duplicate commute times (tiebreaker by price)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 60 }), // fixed commute time for all
        fc.array(arbPropertyListing, { minLength: 3, maxLength: 30 }),
        (fixedCommute, listingsBase) => {
          const listings: PropertyListing[] = listingsBase.map((l, i) => ({
            ...l,
            id: `prop-${i}`,
          }));

          const commuteTimes: CommuteResult[] = listings.map((l) => ({
            propertyId: l.id,
            durationMinutes: fixedCommute,
            mode: "driving" as const,
          }));

          const result = assembleShortlist(
            listings,
            commuteTimes,
            fixedCommute // maxCommute equals the fixed commute so all pass
          );

          // When all commute times are equal, must be sorted by price ascending
          for (let i = 0; i < result.properties.length - 1; i++) {
            const current = result.properties[i];
            const next = result.properties[i + 1];

            expect(current.commuteMinutes).toBe(next.commuteMinutes);
            expect(current.priceAud).toBeLessThanOrEqual(next.priceAud);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("sort invariant holds when all commute times are distinct", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 120 }),
        fc.array(arbPropertyListing, { minLength: 2, maxLength: 30 }),
        (maxCommute, listingsBase) => {
          const listings: PropertyListing[] = listingsBase.map((l, i) => ({
            ...l,
            id: `prop-${i}`,
          }));

          // Assign strictly increasing commute durations (all within threshold)
          const commuteTimes: CommuteResult[] = listings.map((l, i) => ({
            propertyId: l.id,
            durationMinutes: Math.min(1 + i, maxCommute),
            mode: "driving" as const,
          }));

          const result = assembleShortlist(
            listings,
            commuteTimes,
            maxCommute
          );

          // With distinct commute times, sort should be strictly by commute
          for (let i = 0; i < result.properties.length - 1; i++) {
            const current = result.properties[i];
            const next = result.properties[i + 1];

            expect(current.commuteMinutes).toBeLessThanOrEqual(
              next.commuteMinutes
            );
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
