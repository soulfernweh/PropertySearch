import { describe, it, expect } from "vitest";
import { validateListings } from "./listing-validator.js";
import { RawListing } from "../types/index.js";

function makeCompleteListing(overrides: Partial<RawListing> = {}): RawListing {
  return {
    id: "listing-1",
    address: "10 Smith St",
    suburb: "Richmond",
    state: "VIC",
    priceText: "$750,000",
    bedrooms: 3,
    landSizeSqm: 450,
    storeys: 2,
    coordinates: { latitude: -37.82, longitude: 144.99 },
    listedDate: "2024-01-15",
    status: "for_sale",
    listingUrl: "https://domain.com.au/listing-1",
    ...overrides,
  };
}

describe("validateListings", () => {
  it("should include a listing when all required fields are present", () => {
    const listings = [makeCompleteListing()];
    const result = validateListings(listings);

    expect(result.valid).toHaveLength(1);
    expect(result.excluded).toHaveLength(0);
    expect(result.valid[0]).toEqual({
      id: "listing-1",
      address: "10 Smith St",
      priceText: "$750,000",
      bedrooms: 3,
      landSizeSqm: 450,
      storeys: 2,
      coordinates: { latitude: -37.82, longitude: 144.99 },
      listedDate: "2024-01-15",
      listingUrl: "https://domain.com.au/listing-1",
    });
  });

  it("should exclude a listing with null bedrooms", () => {
    const listings = [makeCompleteListing({ bedrooms: null })];
    const result = validateListings(listings);

    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
  });

  it("should exclude a listing with null landSizeSqm", () => {
    const listings = [makeCompleteListing({ landSizeSqm: null })];
    const result = validateListings(listings);

    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
  });

  it("should exclude a listing with null storeys", () => {
    const listings = [makeCompleteListing({ storeys: null })];
    const result = validateListings(listings);

    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
  });

  it("should exclude a listing with null coordinates", () => {
    const listings = [makeCompleteListing({ coordinates: null })];
    const result = validateListings(listings);

    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
  });

  it("should exclude a listing with empty priceText", () => {
    const listings = [makeCompleteListing({ priceText: "" })];
    const result = validateListings(listings);

    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
  });

  it("should exclude a listing with whitespace-only priceText", () => {
    const listings = [makeCompleteListing({ priceText: "   " })];
    const result = validateListings(listings);

    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
  });

  it("should separate valid and invalid listings in a mixed batch", () => {
    const listings = [
      makeCompleteListing({ id: "valid-1" }),
      makeCompleteListing({ id: "missing-beds", bedrooms: null }),
      makeCompleteListing({ id: "valid-2" }),
      makeCompleteListing({ id: "missing-coords", coordinates: null }),
      makeCompleteListing({ id: "missing-land", landSizeSqm: null }),
    ];

    const result = validateListings(listings);

    expect(result.valid).toHaveLength(2);
    expect(result.excluded).toHaveLength(3);
    expect(result.valid.map((l) => l.id)).toEqual(["valid-1", "valid-2"]);
    expect(result.excluded.map((l) => l.id)).toEqual([
      "missing-beds",
      "missing-coords",
      "missing-land",
    ]);
  });

  it("should return empty arrays for empty input", () => {
    const result = validateListings([]);

    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(0);
  });

  it("should exclude a listing with multiple null fields", () => {
    const listings = [
      makeCompleteListing({
        bedrooms: null,
        landSizeSqm: null,
        storeys: null,
        coordinates: null,
      }),
    ];
    const result = validateListings(listings);

    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
  });
});
