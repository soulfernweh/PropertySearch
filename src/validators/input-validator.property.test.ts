/**
 * Property-based tests for SearchCriteria input validation.
 *
 * Property 1: Input validation accepts valid criteria and rejects invalid criteria
 * - Valid SearchCriteria within all specified ranges → validation returns valid=true
 * - SearchCriteria with at least one out-of-range or missing field → validation returns valid=false with errors
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validateSearchCriteria } from "./input-validator.js";
import type { SearchCriteria, CommuteMode, StoreyPreference } from "../types/index.js";

// --- Arbitraries for valid values ---

const validBudget = fc.integer({ min: 100_000, max: 10_000_000 });
const validCommuteMinutes = fc.integer({ min: 5, max: 120 });
const validCommuteMode = fc.constantFrom<CommuteMode>("driving", "public_transport", "cycling", "walking");
const validWorkAddress = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);
const validBedrooms = fc.integer({ min: 1, max: 6 });
const validLandSize = fc.integer({ min: 0, max: 2000 });
const validStoreyPreference = fc.constantFrom<StoreyPreference>("single", "double", "any");

/** Generates a fully valid SearchCriteria with all required fields and random optional fields */
const validSearchCriteria: fc.Arbitrary<SearchCriteria> = fc.record({
  maxBudget: validBudget,
  workAddress: validWorkAddress,
  maxCommuteMinutes: validCommuteMinutes,
  commuteMode: validCommuteMode,
  minBedrooms: fc.option(validBedrooms, { nil: undefined }),
  minLandSize: fc.option(validLandSize, { nil: undefined }),
  storeyPreference: fc.option(validStoreyPreference, { nil: undefined }),
});

// --- Arbitraries for invalid values ---

const invalidBudgetTooLow = fc.integer({ min: -1_000_000, max: 99_999 });
const invalidBudgetTooHigh = fc.integer({ min: 10_000_001, max: 100_000_000 });
const invalidBudget = fc.oneof(invalidBudgetTooLow, invalidBudgetTooHigh);

const invalidCommuteTooLow = fc.integer({ min: -100, max: 4 });
const invalidCommuteTooHigh = fc.integer({ min: 121, max: 1000 });
const invalidCommuteMinutes = fc.oneof(invalidCommuteTooLow, invalidCommuteTooHigh);

const invalidCommuteMode = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => !["driving", "public_transport", "cycling", "walking"].includes(s));

const invalidBedroomsTooLow = fc.integer({ min: -10, max: 0 });
const invalidBedroomsTooHigh = fc.integer({ min: 7, max: 100 });
const invalidBedrooms = fc.oneof(invalidBedroomsTooLow, invalidBedroomsTooHigh);

const invalidLandSizeTooLow = fc.integer({ min: -1000, max: -1 });
const invalidLandSizeTooHigh = fc.integer({ min: 2001, max: 100_000 });
const invalidLandSize = fc.oneof(invalidLandSizeTooLow, invalidLandSizeTooHigh);

const invalidStoreyPreference = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => !["single", "double", "any"].includes(s));

describe("Property 1: Input validation accepts valid criteria and rejects invalid criteria", () => {
  it("should return valid=true for any SearchCriteria with all required fields and values within ranges", () => {
    fc.assert(
      fc.property(validSearchCriteria, (criteria) => {
        const result = validateSearchCriteria(criteria);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }),
      { numRuns: 200 }
    );
  });

  it("should return valid=false when maxBudget is out of range", () => {
    fc.assert(
      fc.property(
        invalidBudget,
        validWorkAddress,
        validCommuteMinutes,
        validCommuteMode,
        (budget, address, commute, mode) => {
          const criteria: Partial<SearchCriteria> = {
            maxBudget: budget,
            workAddress: address,
            maxCommuteMinutes: commute,
            commuteMode: mode,
          };
          const result = validateSearchCriteria(criteria);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field === "maxBudget")).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("should return valid=false when maxCommuteMinutes is out of range", () => {
    fc.assert(
      fc.property(
        validBudget,
        validWorkAddress,
        invalidCommuteMinutes,
        validCommuteMode,
        (budget, address, commute, mode) => {
          const criteria: Partial<SearchCriteria> = {
            maxBudget: budget,
            workAddress: address,
            maxCommuteMinutes: commute,
            commuteMode: mode,
          };
          const result = validateSearchCriteria(criteria);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field === "maxCommuteMinutes")).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("should return valid=false when commuteMode is invalid", () => {
    fc.assert(
      fc.property(
        validBudget,
        validWorkAddress,
        validCommuteMinutes,
        invalidCommuteMode,
        (budget, address, commute, mode) => {
          const criteria = {
            maxBudget: budget,
            workAddress: address,
            maxCommuteMinutes: commute,
            commuteMode: mode as CommuteMode,
          };
          const result = validateSearchCriteria(criteria);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field === "commuteMode")).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("should return valid=false when any required field is missing", () => {
    // Generate a valid criteria then remove one required field at random
    const requiredFields: (keyof SearchCriteria)[] = [
      "maxBudget",
      "workAddress",
      "maxCommuteMinutes",
      "commuteMode",
    ];

    fc.assert(
      fc.property(
        validSearchCriteria,
        fc.constantFrom(...requiredFields),
        (criteria, fieldToRemove) => {
          const partial: Partial<SearchCriteria> = { ...criteria };
          delete partial[fieldToRemove];

          const result = validateSearchCriteria(partial);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field === fieldToRemove)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("should return valid=false when optional minBedrooms is out of range", () => {
    fc.assert(
      fc.property(
        validBudget,
        validWorkAddress,
        validCommuteMinutes,
        validCommuteMode,
        invalidBedrooms,
        (budget, address, commute, mode, bedrooms) => {
          const criteria: Partial<SearchCriteria> = {
            maxBudget: budget,
            workAddress: address,
            maxCommuteMinutes: commute,
            commuteMode: mode,
            minBedrooms: bedrooms,
          };
          const result = validateSearchCriteria(criteria);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field === "minBedrooms")).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("should return valid=false when optional minLandSize is out of range", () => {
    fc.assert(
      fc.property(
        validBudget,
        validWorkAddress,
        validCommuteMinutes,
        validCommuteMode,
        invalidLandSize,
        (budget, address, commute, mode, landSize) => {
          const criteria: Partial<SearchCriteria> = {
            maxBudget: budget,
            workAddress: address,
            maxCommuteMinutes: commute,
            commuteMode: mode,
            minLandSize: landSize,
          };
          const result = validateSearchCriteria(criteria);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field === "minLandSize")).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("should return valid=false when optional storeyPreference is invalid", () => {
    fc.assert(
      fc.property(
        validBudget,
        validWorkAddress,
        validCommuteMinutes,
        validCommuteMode,
        invalidStoreyPreference,
        (budget, address, commute, mode, storey) => {
          const criteria = {
            maxBudget: budget,
            workAddress: address,
            maxCommuteMinutes: commute,
            commuteMode: mode,
            storeyPreference: storey as StoreyPreference,
          };
          const result = validateSearchCriteria(criteria);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.field === "storeyPreference")).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});
