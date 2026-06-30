import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { CommuteMode } from "../types/index.js";
import type { CommuteResult } from "./commute-calculator.js";

/**
 * Property 6: Commute time filtering invariant
 * Validates: Requirements 4.2, 4.4
 *
 * For any PropertyListing with a computed commute duration and for any maximum
 * commute time value, the listing SHALL be included if and only if its commute
 * duration in minutes is less than or equal to the maximum commute time.
 * Listings with null duration (route not found or timeout) SHALL always be excluded.
 */

// --- Commute Filter Helper ---

/**
 * Filters listings by commute time constraint.
 * - Includes only listings whose commute duration ≤ maxCommuteMinutes
 * - Excludes listings with null duration (route not found / timeout)
 */
export function filterByCommute(
  commuteResults: CommuteResult[],
  maxCommuteMinutes: number
): CommuteResult[] {
  return commuteResults.filter(
    (result) =>
      result.durationMinutes !== null &&
      result.durationMinutes <= maxCommuteMinutes
  );
}

// --- Generators ---

const arbCommuteMode: fc.Arbitrary<CommuteMode> = fc.constantFrom(
  "driving",
  "public_transport",
  "cycling",
  "walking"
);

/** Generates a CommuteResult with a non-null duration (1–200 minutes) */
const arbCommuteResultWithDuration: fc.Arbitrary<CommuteResult> = fc.record({
  propertyId: fc.uuid(),
  durationMinutes: fc.integer({ min: 1, max: 200 }),
  mode: arbCommuteMode,
});

/** Generates a CommuteResult with null duration (route not found / timeout) */
const arbCommuteResultNull: fc.Arbitrary<CommuteResult> = fc.record({
  propertyId: fc.uuid(),
  durationMinutes: fc.constant(null),
  mode: arbCommuteMode,
});

/** Generates a mixed array of CommuteResults (some with duration, some null) */
const arbCommuteResults: fc.Arbitrary<CommuteResult[]> = fc.array(
  fc.oneof(
    { weight: 3, arbitrary: arbCommuteResultWithDuration },
    { weight: 1, arbitrary: arbCommuteResultNull }
  ),
  { minLength: 0, maxLength: 50 }
);

/** Generates a maxCommuteMinutes value between 5 and 120 */
const arbMaxCommuteMinutes: fc.Arbitrary<number> = fc.integer({ min: 5, max: 120 });

// --- Property Tests ---

describe("Property 6: Commute time filtering invariant", () => {
  it("includes a listing iff durationMinutes is non-null and ≤ maxCommuteMinutes", () => {
    fc.assert(
      fc.property(
        arbCommuteResults,
        arbMaxCommuteMinutes,
        (commuteResults, maxCommuteMinutes) => {
          const filtered = filterByCommute(commuteResults, maxCommuteMinutes);

          // Every included result must have non-null duration ≤ max
          for (const result of filtered) {
            expect(result.durationMinutes).not.toBeNull();
            expect(result.durationMinutes!).toBeLessThanOrEqual(maxCommuteMinutes);
          }

          // Every excluded result must have null duration or duration > max
          const filteredIds = new Set(filtered.map((r) => r.propertyId));
          for (const result of commuteResults) {
            if (!filteredIds.has(result.propertyId)) {
              const excluded =
                result.durationMinutes === null ||
                result.durationMinutes > maxCommuteMinutes;
              expect(excluded).toBe(true);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("listings with null duration are always excluded", () => {
    fc.assert(
      fc.property(
        fc.array(arbCommuteResultNull, { minLength: 1, maxLength: 30 }),
        arbMaxCommuteMinutes,
        (nullResults, maxCommuteMinutes) => {
          const filtered = filterByCommute(nullResults, maxCommuteMinutes);
          expect(filtered).toHaveLength(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("listing with duration exactly equal to maxCommuteMinutes is included", () => {
    fc.assert(
      fc.property(
        arbMaxCommuteMinutes,
        arbCommuteMode,
        (maxCommuteMinutes, mode) => {
          const result: CommuteResult = {
            propertyId: "exact-boundary",
            durationMinutes: maxCommuteMinutes,
            mode,
          };
          const filtered = filterByCommute([result], maxCommuteMinutes);
          expect(filtered).toHaveLength(1);
          expect(filtered[0].propertyId).toBe("exact-boundary");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("listing with duration one minute over maxCommuteMinutes is excluded", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 119 }), // max 119 so +1 = 120 max valid duration
        arbCommuteMode,
        (maxCommuteMinutes, mode) => {
          const result: CommuteResult = {
            propertyId: "over-boundary",
            durationMinutes: maxCommuteMinutes + 1,
            mode,
          };
          const filtered = filterByCommute([result], maxCommuteMinutes);
          expect(filtered).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("filtering preserves result count: included + excluded = total input", () => {
    fc.assert(
      fc.property(
        arbCommuteResults,
        arbMaxCommuteMinutes,
        (commuteResults, maxCommuteMinutes) => {
          const filtered = filterByCommute(commuteResults, maxCommuteMinutes);
          const excludedCount = commuteResults.length - filtered.length;

          // Verify excluded items are the ones that don't pass
          const expectedExcluded = commuteResults.filter(
            (r) => r.durationMinutes === null || r.durationMinutes > maxCommuteMinutes
          );
          expect(excludedCount).toBe(expectedExcluded.length);
        }
      ),
      { numRuns: 200 }
    );
  });
});
