import { describe, it, expect } from "vitest";
import { assembleShortlist } from "./shortlist-assembler.js";
import type { PropertyListing } from "../types/index.js";
import type { CommuteResult } from "../services/commute-calculator.js";

function makeListing(overrides: Partial<PropertyListing> & { id: string }): PropertyListing {
  return {
    address: "1 Test St, Melbourne VIC",
    priceText: "$750,000",
    bedrooms: 3,
    landSizeSqm: 400,
    storeys: 1,
    coordinates: { latitude: -37.8, longitude: 144.9 },
    listedDate: "2024-01-01",
    ...overrides,
  };
}

function makeCommute(propertyId: string, durationMinutes: number | null): CommuteResult {
  return { propertyId, durationMinutes, mode: "driving" };
}

describe("assembleShortlist", () => {
  it("returns matching properties sorted by commute then price", () => {
    const listings: PropertyListing[] = [
      makeListing({ id: "a", priceText: "$800,000" }),
      makeListing({ id: "b", priceText: "$600,000" }),
      makeListing({ id: "c", priceText: "$700,000" }),
    ];
    const commutes: CommuteResult[] = [
      makeCommute("a", 30),
      makeCommute("b", 20),
      makeCommute("c", 20),
    ];

    const result = assembleShortlist(listings, commutes, 45);

    expect(result.properties).toHaveLength(3);
    // b and c both have 20 min commute; b ($600k) should come before c ($700k)
    expect(result.properties[0].id).toBe("b");
    expect(result.properties[1].id).toBe("c");
    expect(result.properties[2].id).toBe("a");
  });

  it("excludes listings with null commute duration", () => {
    const listings = [makeListing({ id: "a" }), makeListing({ id: "b" })];
    const commutes = [makeCommute("a", 15), makeCommute("b", null)];

    const result = assembleShortlist(listings, commutes, 60);

    expect(result.properties).toHaveLength(1);
    expect(result.properties[0].id).toBe("a");
  });

  it("excludes listings exceeding maxCommuteMinutes", () => {
    const listings = [makeListing({ id: "a" }), makeListing({ id: "b" })];
    const commutes = [makeCommute("a", 25), makeCommute("b", 35)];

    const result = assembleShortlist(listings, commutes, 30);

    expect(result.properties).toHaveLength(1);
    expect(result.properties[0].id).toBe("a");
  });

  it("sets totalEvaluated to listings.length", () => {
    const listings = [makeListing({ id: "a" }), makeListing({ id: "b" }), makeListing({ id: "c" })];
    const commutes = [makeCommute("a", 10)];

    const result = assembleShortlist(listings, commutes, 60);

    expect(result.totalEvaluated).toBe(3);
  });

  it("caps results at maxResults and sets hasMore", () => {
    const listings = Array.from({ length: 5 }, (_, i) =>
      makeListing({ id: `prop-${i}`, priceText: `$${500000 + i * 10000}` })
    );
    const commutes = listings.map((l) => makeCommute(l.id, 10));

    const result = assembleShortlist(listings, commutes, 60, 3);

    expect(result.properties).toHaveLength(3);
    expect(result.totalMatching).toBe(5);
    expect(result.hasMore).toBe(true);
  });

  it("sets hasMore to false when matching <= maxResults", () => {
    const listings = [makeListing({ id: "a" }), makeListing({ id: "b" })];
    const commutes = [makeCommute("a", 10), makeCommute("b", 15)];

    const result = assembleShortlist(listings, commutes, 60);

    expect(result.hasMore).toBe(false);
    expect(result.totalMatching).toBe(2);
  });

  it("returns suggestedRelaxation when zero results", () => {
    const listings = [makeListing({ id: "a" })];
    const commutes = [makeCommute("a", 90)]; // exceeds max

    const result = assembleShortlist(listings, commutes, 30);

    expect(result.totalMatching).toBe(0);
    expect(result.properties).toHaveLength(0);
    expect(result.suggestedRelaxation).toBeDefined();
    expect(result.suggestedRelaxation).toContain("commute");
  });

  it("does not set suggestedRelaxation when results exist", () => {
    const listings = [makeListing({ id: "a" })];
    const commutes = [makeCommute("a", 10)];

    const result = assembleShortlist(listings, commutes, 60);

    expect(result.suggestedRelaxation).toBeUndefined();
  });

  it("uses 0 for unparseable prices", () => {
    const listings = [makeListing({ id: "a", priceText: "Contact Agent" })];
    const commutes = [makeCommute("a", 10)];

    const result = assembleShortlist(listings, commutes, 60);

    expect(result.properties[0].priceAud).toBe(0);
  });

  it("defaults maxResults to 20", () => {
    const listings = Array.from({ length: 25 }, (_, i) =>
      makeListing({ id: `prop-${i}` })
    );
    const commutes = listings.map((l) => makeCommute(l.id, 10));

    const result = assembleShortlist(listings, commutes, 60);

    expect(result.properties).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    expect(result.totalMatching).toBe(25);
  });

  it("excludes listings without a commute result entry", () => {
    const listings = [makeListing({ id: "a" }), makeListing({ id: "b" })];
    const commutes = [makeCommute("a", 10)]; // no entry for "b"

    const result = assembleShortlist(listings, commutes, 60);

    expect(result.properties).toHaveLength(1);
    expect(result.properties[0].id).toBe("a");
  });
});
