/**
 * Property-based tests for budget filtering invariant.
 *
 * **Validates: Requirements 3.1, 3.3**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { filterByBudget } from "./budget-filter.js";
import { getComparisonPrice, parsePrice } from "./price-parser.js";
import type { PropertyListing } from "../types/index.js";

/**
 * Formats a number as an Australian currency string with commas.
 */
function formatAsCurrency(amount: number): string {
  return amount.toLocaleString("en-AU");
}

/**
 * Arbitrary for generating integer amounts in the valid property price range.
 */
const amountArb = fc.integer({ min: 100_000, max: 10_000_000 });

/**
 * Arbitrary for generating a maxBudget value.
 */
const budgetArb = fc.integer({ min: 100_000, max: 10_000_000 });

/**
 * Arbitrary for generating a parseable price string in one of the four formats.
 */
const parseablePriceTextArb: fc.Arbitrary<string> = fc.oneof(
  // Fixed: "$750,000"
  amountArb.map((amount) => `$${formatAsCurrency(amount)}`),
  // Range: "$650,000 - $700,000"
  fc
    .tuple(amountArb, amountArb)
    .filter(([a, b]) => a !== b)
    .map(([a, b]) => {
      const lower = Math.min(a, b);
      const upper = Math.max(a, b);
      return `$${formatAsCurrency(lower)} - $${formatAsCurrency(upper)}`;
    }),
  // Plus: "$700,000+"
  amountArb.map((min) => `$${formatAsCurrency(min)}+`),
  // Offers over: "Offers over $600,000"
  amountArb.map((amount) => `Offers over $${formatAsCurrency(amount)}`)
);

/**
 * Arbitrary for generating unparseable price strings.
 */
const unparseablePriceTextArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant("Contact Agent"),
  fc.constant("Auction"),
  fc.constant("Price on Application"),
  fc.constant("Expressions of Interest"),
  fc.constant("By Negotiation")
);

/**
 * Arbitrary for generating a base PropertyListing (without priceText).
 */
const baseListingArb = fc.record({
  id: fc.uuid(),
  address: fc.string({ minLength: 5, maxLength: 50 }),
  bedrooms: fc.integer({ min: 1, max: 6 }),
  landSizeSqm: fc.integer({ min: 50, max: 2000 }),
  storeys: fc.integer({ min: 1, max: 3 }),
  coordinates: fc.record({
    latitude: fc.double({ min: -38.5, max: -37.5, noNaN: true }),
    longitude: fc.double({ min: 144.5, max: 145.5, noNaN: true }),
  }),
  listedDate: fc.integer({
    min: new Date("2024-01-01").getTime(),
    max: new Date("2025-12-31").getTime(),
  }).map((ts) => new Date(ts).toISOString().split("T")[0]),
});

/**
 * Arbitrary for a PropertyListing with a parseable price.
 */
const parseableListingArb: fc.Arbitrary<PropertyListing> = fc
  .tuple(baseListingArb, parseablePriceTextArb)
  .map(([base, priceText]) => ({ ...base, priceText }));

/**
 * Arbitrary for a PropertyListing with an unparseable price.
 */
const unparseableListingArb: fc.Arbitrary<PropertyListing> = fc
  .tuple(baseListingArb, unparseablePriceTextArb)
  .map(([base, priceText]) => ({ ...base, priceText }));

describe("Property 4: Budget filtering invariant", () => {
  it("listing with parseable price is included iff comparison price ≤ maxBudget", () => {
    fc.assert(
      fc.property(
        fc.array(parseableListingArb, { minLength: 1, maxLength: 20 }),
        budgetArb,
        (listings, maxBudget) => {
          const result = filterByBudget(listings, maxBudget);

          for (const listing of listings) {
            const parsed = parsePrice(listing.priceText);
            const comparisonPrice = getComparisonPrice(parsed);

            // All parseable listings should have a non-null comparison price
            expect(comparisonPrice).not.toBeNull();

            if (comparisonPrice! <= maxBudget) {
              expect(result.included).toContainEqual(listing);
              expect(result.excluded).not.toContainEqual(listing);
            } else {
              expect(result.excluded).toContainEqual(listing);
              expect(result.included).not.toContainEqual(listing);
            }
          }
        }
      )
    );
  });

  it("listing with parseable price is excluded iff comparison price > maxBudget", () => {
    fc.assert(
      fc.property(
        fc.array(parseableListingArb, { minLength: 1, maxLength: 20 }),
        budgetArb,
        (listings, maxBudget) => {
          const result = filterByBudget(listings, maxBudget);

          for (const included of result.included) {
            const parsed = parsePrice(included.priceText);
            const comparisonPrice = getComparisonPrice(parsed)!;
            expect(comparisonPrice).toBeLessThanOrEqual(maxBudget);
          }

          for (const excluded of result.excluded) {
            const parsed = parsePrice(excluded.priceText);
            const comparisonPrice = getComparisonPrice(parsed)!;
            expect(comparisonPrice).toBeGreaterThan(maxBudget);
          }
        }
      )
    );
  });

  it("unparseable prices are always placed in the unparseable array", () => {
    fc.assert(
      fc.property(
        fc.array(unparseableListingArb, { minLength: 1, maxLength: 10 }),
        budgetArb,
        (listings, maxBudget) => {
          const result = filterByBudget(listings, maxBudget);

          expect(result.included).toHaveLength(0);
          expect(result.excluded).toHaveLength(0);
          expect(result.unparseable).toHaveLength(listings.length);

          for (const listing of listings) {
            expect(result.unparseable).toContainEqual(listing);
          }
        }
      )
    );
  });

  it("mixed parseable and unparseable listings are correctly partitioned", () => {
    fc.assert(
      fc.property(
        fc.array(parseableListingArb, { minLength: 0, maxLength: 10 }),
        fc.array(unparseableListingArb, { minLength: 0, maxLength: 5 }),
        budgetArb,
        (parseableListings, unparseableListings, maxBudget) => {
          const allListings = [...parseableListings, ...unparseableListings];
          const result = filterByBudget(allListings, maxBudget);

          // Total count is preserved
          const totalOutput =
            result.included.length + result.excluded.length + result.unparseable.length;
          expect(totalOutput).toBe(allListings.length);

          // All unparseable listings end up in the unparseable category
          for (const listing of unparseableListings) {
            expect(result.unparseable).toContainEqual(listing);
            expect(result.included).not.toContainEqual(listing);
            expect(result.excluded).not.toContainEqual(listing);
          }

          // All parseable listings end up in included or excluded (not unparseable)
          for (const listing of parseableListings) {
            expect(result.unparseable).not.toContainEqual(listing);
            const parsed = parsePrice(listing.priceText);
            const comparisonPrice = getComparisonPrice(parsed)!;
            if (comparisonPrice <= maxBudget) {
              expect(result.included).toContainEqual(listing);
            } else {
              expect(result.excluded).toContainEqual(listing);
            }
          }
        }
      )
    );
  });
});
