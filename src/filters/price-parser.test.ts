import { describe, it, expect } from "vitest";
import { parsePrice, getComparisonPrice } from "./price-parser.js";

describe("parsePrice", () => {
  it("parses fixed price format", () => {
    expect(parsePrice("$750,000")).toEqual({ type: "fixed", amount: 750000 });
    expect(parsePrice("$1,200,000")).toEqual({ type: "fixed", amount: 1200000 });
    expect(parsePrice("750000")).toEqual({ type: "fixed", amount: 750000 });
  });

  it("parses range format", () => {
    expect(parsePrice("$650,000 - $700,000")).toEqual({
      type: "range",
      lower: 650000,
      upper: 700000,
    });
    expect(parsePrice("$600,000-$650,000")).toEqual({
      type: "range",
      lower: 600000,
      upper: 650000,
    });
  });

  it("parses plus format", () => {
    expect(parsePrice("$700,000+")).toEqual({ type: "plus", minimum: 700000 });
    expect(parsePrice("$700,000 +")).toEqual({ type: "plus", minimum: 700000 });
  });

  it("parses offers over format", () => {
    expect(parsePrice("Offers over $600,000")).toEqual({
      type: "offers_over",
      amount: 600000,
    });
    expect(parsePrice("Offer over $500,000")).toEqual({
      type: "offers_over",
      amount: 500000,
    });
    expect(parsePrice("OFFERS OVER $800,000")).toEqual({
      type: "offers_over",
      amount: 800000,
    });
  });

  it("returns unparseable for non-price strings", () => {
    expect(parsePrice("Contact Agent")).toEqual({ type: "unparseable" });
    expect(parsePrice("Auction")).toEqual({ type: "unparseable" });
    expect(parsePrice("")).toEqual({ type: "unparseable" });
    expect(parsePrice("  ")).toEqual({ type: "unparseable" });
  });

  it("handles edge cases with varied spacing", () => {
    expect(parsePrice(" $750,000 ")).toEqual({ type: "fixed", amount: 750000 });
    expect(parsePrice("$650,000  -  $700,000")).toEqual({
      type: "range",
      lower: 650000,
      upper: 700000,
    });
  });
});

describe("getComparisonPrice", () => {
  it("returns amount for fixed price", () => {
    expect(getComparisonPrice({ type: "fixed", amount: 750000 })).toBe(750000);
  });

  it("returns upper bound for range", () => {
    expect(
      getComparisonPrice({ type: "range", lower: 650000, upper: 700000 })
    ).toBe(700000);
  });

  it("returns minimum for plus format", () => {
    expect(getComparisonPrice({ type: "plus", minimum: 700000 })).toBe(700000);
  });

  it("returns amount for offers_over", () => {
    expect(getComparisonPrice({ type: "offers_over", amount: 600000 })).toBe(
      600000
    );
  });

  it("returns null for unparseable", () => {
    expect(getComparisonPrice({ type: "unparseable" })).toBeNull();
  });
});
