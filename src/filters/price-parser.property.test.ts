/**
 * Property-based tests for price parsing round trip.
 *
 * **Validates: Requirements 3.2**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parsePrice, getComparisonPrice } from "./price-parser.js";
import type { PriceFormat } from "../types/index.js";

/**
 * Formats a number as an Australian currency string with commas.
 * e.g., 750000 → "750,000"
 */
function formatAsCurrency(amount: number): string {
  return amount.toLocaleString("en-AU");
}

/**
 * Arbitrary for generating integer amounts in the valid property price range.
 */
const amountArb = fc.integer({ min: 100_000, max: 10_000_000 });

/**
 * Arbitrary for generating a fixed PriceFormat.
 */
const fixedPriceArb = amountArb.map((amount) => ({
  type: "fixed" as const,
  amount,
}));

/**
 * Arbitrary for generating a range PriceFormat where lower < upper.
 */
const rangePriceArb = fc
  .tuple(amountArb, amountArb)
  .filter(([a, b]) => a !== b)
  .map(([a, b]) => ({
    type: "range" as const,
    lower: Math.min(a, b),
    upper: Math.max(a, b),
  }));

/**
 * Arbitrary for generating a plus PriceFormat.
 */
const plusPriceArb = amountArb.map((minimum) => ({
  type: "plus" as const,
  minimum,
}));

/**
 * Arbitrary for generating an offers_over PriceFormat.
 */
const offersOverPriceArb = amountArb.map((amount) => ({
  type: "offers_over" as const,
  amount,
}));

/**
 * Formats a PriceFormat into an Australian price string that the parser
 * should be able to round-trip.
 */
function formatPriceString(price: PriceFormat): string {
  switch (price.type) {
    case "fixed":
      return `$${formatAsCurrency(price.amount)}`;
    case "range":
      return `$${formatAsCurrency(price.lower)} - $${formatAsCurrency(price.upper)}`;
    case "plus":
      return `$${formatAsCurrency(price.minimum)}+`;
    case "offers_over":
      return `Offers over $${formatAsCurrency(price.amount)}`;
    case "unparseable":
      return "Contact Agent";
  }
}

describe("Property 3: Price parsing round trip", () => {
  it("fixed price round trips correctly", () => {
    fc.assert(
      fc.property(fixedPriceArb, (price) => {
        const formatted = formatPriceString(price);
        const parsed = parsePrice(formatted);
        expect(parsed).toEqual(price);
      })
    );
  });

  it("range price round trips correctly", () => {
    fc.assert(
      fc.property(rangePriceArb, (price) => {
        const formatted = formatPriceString(price);
        const parsed = parsePrice(formatted);
        expect(parsed).toEqual(price);
      })
    );
  });

  it("plus price round trips correctly", () => {
    fc.assert(
      fc.property(plusPriceArb, (price) => {
        const formatted = formatPriceString(price);
        const parsed = parsePrice(formatted);
        expect(parsed).toEqual(price);
      })
    );
  });

  it("offers_over price round trips correctly", () => {
    fc.assert(
      fc.property(offersOverPriceArb, (price) => {
        const formatted = formatPriceString(price);
        const parsed = parsePrice(formatted);
        expect(parsed).toEqual(price);
      })
    );
  });

  it("comparison price for fixed equals amount", () => {
    fc.assert(
      fc.property(fixedPriceArb, (price) => {
        const formatted = formatPriceString(price);
        const parsed = parsePrice(formatted);
        const comparison = getComparisonPrice(parsed);
        expect(comparison).toBe(price.amount);
      })
    );
  });

  it("comparison price for range equals upper bound", () => {
    fc.assert(
      fc.property(rangePriceArb, (price) => {
        const formatted = formatPriceString(price);
        const parsed = parsePrice(formatted);
        const comparison = getComparisonPrice(parsed);
        expect(comparison).toBe(price.upper);
      })
    );
  });

  it("comparison price for plus equals minimum", () => {
    fc.assert(
      fc.property(plusPriceArb, (price) => {
        const formatted = formatPriceString(price);
        const parsed = parsePrice(formatted);
        const comparison = getComparisonPrice(parsed);
        expect(comparison).toBe(price.minimum);
      })
    );
  });

  it("comparison price for offers_over equals amount", () => {
    fc.assert(
      fc.property(offersOverPriceArb, (price) => {
        const formatted = formatPriceString(price);
        const parsed = parsePrice(formatted);
        const comparison = getComparisonPrice(parsed);
        expect(comparison).toBe(price.amount);
      })
    );
  });
});
