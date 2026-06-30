/**
 * Integration tests for the pipeline orchestrator.
 *
 * Tests the full search pipeline end-to-end with all external services mocked.
 * Validates: Requirements 2.3, 4.7, 6.4, 6.6
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SearchCriteria } from "../types/index.js";
import type { GeocodeResult } from "../services/geocoder.js";
import type { FetchResult } from "../services/listing-fetcher.js";
import type { CommuteResult } from "../services/commute-calculator.js";

// Mock external services at module level
vi.mock("../services/geocoder.js");
vi.mock("../services/listing-fetcher.js");
vi.mock("../services/commute-calculator.js");
vi.mock("../services/profile-persister.js");

import { runSearchPipeline } from "./orchestrator.js";
import { geocodeAddress } from "../services/geocoder.js";
import { fetchListings } from "../services/listing-fetcher.js";
import { calculateCommuteTimes } from "../services/commute-calculator.js";
import { saveProfile } from "../services/profile-persister.js";

// Cast mocks for type safety
const mockGeocodeAddress = vi.mocked(geocodeAddress);
const mockFetchListings = vi.mocked(fetchListings);
const mockCalculateCommuteTimes = vi.mocked(calculateCommuteTimes);
const mockSaveProfile = vi.mocked(saveProfile);

/** Valid search criteria used across tests */
const validCriteria: SearchCriteria = {
  maxBudget: 800_000,
  workAddress: "123 Collins St, Melbourne VIC 3000",
  maxCommuteMinutes: 45,
  commuteMode: "driving",
  minBedrooms: 3,
  minLandSize: 300,
  storeyPreference: "any",
};

/** Helper to create mock listings with all required fields */
function createMockRawListings(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `listing-${i + 1}`,
    address: `${i + 1} Test St, Melbourne VIC`,
    suburb: "TestSuburb",
    state: "VIC" as const,
    priceText: `$${600_000 + i * 50_000}`,
    bedrooms: 3 + (i % 3),
    landSizeSqm: 400 + i * 10,
    storeys: 1 + (i % 2),
    coordinates: { latitude: -37.8 - i * 0.01, longitude: 144.9 + i * 0.01 },
    listedDate: "2024-01-15",
    status: "for_sale" as const,
    listingUrl: `https://domain.com.au/listing-${i + 1}`,
  }));
}

/** Helper to create mock commute results */
function createMockCommuteResults(listingIds: string[], mode: "driving" | "public_transport" | "cycling" | "walking" = "driving"): CommuteResult[] {
  return listingIds.map((id, i) => ({
    propertyId: id,
    durationMinutes: 20 + i * 5,
    mode,
  }));
}

describe("Pipeline Orchestrator Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveProfile.mockResolvedValue(undefined);
  });

  describe("Full pipeline success", () => {
    it("should return a shortlist with correct properties when all services succeed", async () => {
      // Arrange: mock all services returning valid data
      const mockListings = createMockRawListings(5);

      mockGeocodeAddress.mockResolvedValue({
        success: true,
        coordinates: { latitude: -37.8136, longitude: 144.9631 },
        formattedAddress: "123 Collins St, Melbourne VIC 3000, Australia",
      });

      mockFetchListings.mockResolvedValue({
        success: true,
        listings: mockListings,
      });

      const commuteResults = createMockCommuteResults(
        mockListings.map((l) => l.id)
      );
      mockCalculateCommuteTimes.mockResolvedValue(commuteResults);

      // Act
      const result = await runSearchPipeline(validCriteria);

      // Assert
      expect(result.success).toBe(true);
      expect(result.shortlist).toBeDefined();
      expect(result.shortlist!.properties.length).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();

      // Verify pipeline called services in order
      expect(mockGeocodeAddress).toHaveBeenCalledWith(validCriteria.workAddress);
      expect(mockFetchListings).toHaveBeenCalled();
      expect(mockCalculateCommuteTimes).toHaveBeenCalled();
      expect(mockSaveProfile).toHaveBeenCalled();

      // Verify shortlist properties have expected shape
      for (const prop of result.shortlist!.properties) {
        expect(prop.id).toBeDefined();
        expect(prop.address).toBeDefined();
        expect(prop.priceAud).toBeGreaterThan(0);
        expect(prop.commuteMinutes).toBeLessThanOrEqual(validCriteria.maxCommuteMinutes);
      }
    });
  });

  describe("Pipeline timeout enforcement", () => {
    it("should set timedOut flag when commute calculator exceeds timeout", async () => {
      // Arrange
      mockGeocodeAddress.mockResolvedValue({
        success: true,
        coordinates: { latitude: -37.8136, longitude: 144.9631 },
      });

      const mockListings = createMockRawListings(3);
      mockFetchListings.mockResolvedValue({
        success: true,
        listings: mockListings,
      });

      // Simulate slow commute API — delay beyond the pipeline timeout
      mockCalculateCommuteTimes.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 5_000))
      );

      // Act: use a very short timeout to trigger the timeout path
      const result = await runSearchPipeline(validCriteria, 100);

      // Assert
      expect(result.timedOut).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Listing API unavailability", () => {
    it("should return error at stage listing_fetch when fetchListings fails", async () => {
      // Arrange
      mockGeocodeAddress.mockResolvedValue({
        success: true,
        coordinates: { latitude: -37.8136, longitude: 144.9631 },
      });

      mockFetchListings.mockResolvedValue({
        success: false,
        listings: [],
        error: "Domain API request failed: Service temporarily unavailable",
      });

      // Act
      const result = await runSearchPipeline(validCriteria);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.stage).toBe("listing_fetch");
      expect(result.error!.message).toContain("Domain API");
      expect(result.shortlist).toBeUndefined();
    });
  });

  describe("Geocoding failure", () => {
    it("should return error at stage geocoding when geocodeAddress fails", async () => {
      // Arrange
      mockGeocodeAddress.mockResolvedValue({
        success: false,
        error: "Geocoding failed: ZERO_RESULTS",
      });

      // Act
      const result = await runSearchPipeline(validCriteria);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.stage).toBe("geocoding");
      expect(result.error!.message).toContain("Geocoding failed");
      expect(result.shortlist).toBeUndefined();
      // Listing fetcher should not have been called
      expect(mockFetchListings).not.toHaveBeenCalled();
    });
  });

  describe("Zero results with relaxation suggestion", () => {
    it("should produce suggestedRelaxation when all listings exceed budget or commute", async () => {
      // Arrange: listings all exceed the budget
      const expensiveListings = Array.from({ length: 3 }, (_, i) => ({
        id: `expensive-${i + 1}`,
        address: `${i + 1} Expensive St, Melbourne VIC`,
        suburb: "Toorak",
        state: "VIC" as const,
        priceText: `$${2_000_000 + i * 500_000}`,
        bedrooms: 4,
        landSizeSqm: 500,
        storeys: 2,
        coordinates: { latitude: -37.85, longitude: 144.99 },
        listedDate: "2024-01-15",
        status: "for_sale" as const,
        listingUrl: `https://domain.com.au/expensive-${i + 1}`,
      }));

      mockGeocodeAddress.mockResolvedValue({
        success: true,
        coordinates: { latitude: -37.8136, longitude: 144.9631 },
      });

      mockFetchListings.mockResolvedValue({
        success: true,
        listings: expensiveListings,
      });

      // Commute results — properties that pass commute but fail budget
      mockCalculateCommuteTimes.mockResolvedValue([]);

      // Act — budget of 800k, all listings are 2M+
      const result = await runSearchPipeline(validCriteria);

      // Assert
      expect(result.success).toBe(true);
      expect(result.shortlist).toBeDefined();
      expect(result.shortlist!.properties).toHaveLength(0);
      expect(result.shortlist!.totalMatching).toBe(0);
      expect(result.shortlist!.suggestedRelaxation).toBeDefined();
      expect(result.shortlist!.suggestedRelaxation!.length).toBeGreaterThan(0);
    });
  });

  describe("Validation failure", () => {
    it("should return error at stage validation when criteria are invalid", async () => {
      // Arrange: invalid criteria (budget below minimum)
      const invalidCriteria = {
        maxBudget: 50_000, // below 100,000 minimum
        workAddress: "123 Collins St, Melbourne VIC 3000",
        maxCommuteMinutes: 45,
        commuteMode: "driving" as const,
      };

      // Act
      const result = await runSearchPipeline(invalidCriteria as SearchCriteria);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.stage).toBe("validation");
      expect(result.error!.message).toContain("maxBudget");
      // Should not call any external services
      expect(mockGeocodeAddress).not.toHaveBeenCalled();
      expect(mockFetchListings).not.toHaveBeenCalled();
      expect(mockCalculateCommuteTimes).not.toHaveBeenCalled();
    });

    it("should return error at stage validation when required fields are missing", async () => {
      // Arrange: missing required fields
      const incompleteCriteria = {
        maxBudget: 800_000,
        // workAddress is missing
        maxCommuteMinutes: 45,
        // commuteMode is missing
      };

      // Act
      const result = await runSearchPipeline(incompleteCriteria as SearchCriteria);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.stage).toBe("validation");
      expect(mockGeocodeAddress).not.toHaveBeenCalled();
    });
  });
});
