/**
 * Unit tests for input validation (SearchCriteria).
 * Tests boundary values, missing required fields, and invalid enum values.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5
 */

import { describe, it, expect } from "vitest";
import { validateSearchCriteria } from "./input-validator.js";
import type { SearchCriteria } from "../types/index.js";

/** Helper: returns a valid SearchCriteria with all required fields */
function validCriteria(overrides: Partial<SearchCriteria> = {}): Partial<SearchCriteria> {
  return {
    maxBudget: 800_000,
    workAddress: "123 Collins St, Melbourne VIC 3000",
    maxCommuteMinutes: 45,
    commuteMode: "driving",
    ...overrides,
  };
}

describe("validateSearchCriteria", () => {
  // --- Budget boundary values (Requirement 1.2) ---

  describe("budget boundary values", () => {
    it("accepts budget exactly at minimum (100,000)", () => {
      const result = validateSearchCriteria(validCriteria({ maxBudget: 100_000 }));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts budget exactly at maximum (10,000,000)", () => {
      const result = validateSearchCriteria(validCriteria({ maxBudget: 10_000_000 }));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects budget just below minimum (99,999)", () => {
      const result = validateSearchCriteria(validCriteria({ maxBudget: 99_999 }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "maxBudget" })
      );
    });

    it("rejects budget just above maximum (10,000,001)", () => {
      const result = validateSearchCriteria(validCriteria({ maxBudget: 10_000_001 }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "maxBudget" })
      );
    });
  });

  // --- Commute time boundary values (Requirement 1.3) ---

  describe("commute time boundary values", () => {
    it("accepts commute time exactly at minimum (5)", () => {
      const result = validateSearchCriteria(validCriteria({ maxCommuteMinutes: 5 }));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts commute time exactly at maximum (120)", () => {
      const result = validateSearchCriteria(validCriteria({ maxCommuteMinutes: 120 }));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects commute time just below minimum (4)", () => {
      const result = validateSearchCriteria(validCriteria({ maxCommuteMinutes: 4 }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "maxCommuteMinutes" })
      );
    });

    it("rejects commute time just above maximum (121)", () => {
      const result = validateSearchCriteria(validCriteria({ maxCommuteMinutes: 121 }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "maxCommuteMinutes" })
      );
    });
  });

  // --- Missing required fields (Requirement 1.5) ---

  describe("missing required fields individually", () => {
    it("rejects missing maxBudget", () => {
      const criteria = validCriteria();
      delete criteria.maxBudget;
      const result = validateSearchCriteria(criteria);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "maxBudget" })
      );
    });

    it("rejects missing workAddress", () => {
      const criteria = validCriteria();
      delete criteria.workAddress;
      const result = validateSearchCriteria(criteria);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "workAddress" })
      );
    });

    it("rejects empty workAddress", () => {
      const result = validateSearchCriteria(validCriteria({ workAddress: "" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "workAddress" })
      );
    });

    it("rejects missing maxCommuteMinutes", () => {
      const criteria = validCriteria();
      delete criteria.maxCommuteMinutes;
      const result = validateSearchCriteria(criteria);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "maxCommuteMinutes" })
      );
    });

    it("rejects missing commuteMode", () => {
      const criteria = validCriteria();
      delete criteria.commuteMode;
      const result = validateSearchCriteria(criteria);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "commuteMode" })
      );
    });
  });

  describe("missing required fields in combination", () => {
    it("reports errors for all missing required fields at once", () => {
      const result = validateSearchCriteria({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);

      const errorFields = result.errors.map((e) => e.field);
      expect(errorFields).toContain("maxBudget");
      expect(errorFields).toContain("workAddress");
      expect(errorFields).toContain("maxCommuteMinutes");
      expect(errorFields).toContain("commuteMode");
    });

    it("reports errors for two missing required fields", () => {
      const criteria = validCriteria();
      delete criteria.maxBudget;
      delete criteria.commuteMode;
      const result = validateSearchCriteria(criteria);
      expect(result.valid).toBe(false);

      const errorFields = result.errors.map((e) => e.field);
      expect(errorFields).toContain("maxBudget");
      expect(errorFields).toContain("commuteMode");
      expect(errorFields).not.toContain("workAddress");
      expect(errorFields).not.toContain("maxCommuteMinutes");
    });
  });

  // --- Invalid enum values (Requirements 1.1) ---

  describe("invalid enum values", () => {
    it("rejects invalid commuteMode", () => {
      const result = validateSearchCriteria(
        validCriteria({ commuteMode: "teleportation" as any })
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "commuteMode" })
      );
    });

    it("rejects invalid storeyPreference", () => {
      const result = validateSearchCriteria(
        validCriteria({ storeyPreference: "triple" as any })
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "storeyPreference" })
      );
    });
  });

  // --- Valid criteria acceptance (Requirement 1.1) ---

  describe("valid criteria acceptance", () => {
    it("accepts valid criteria with only required fields", () => {
      const result = validateSearchCriteria(validCriteria());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts valid criteria with all optional fields", () => {
      const result = validateSearchCriteria(
        validCriteria({
          minBedrooms: 3,
          minLandSize: 400,
          storeyPreference: "double",
        })
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
