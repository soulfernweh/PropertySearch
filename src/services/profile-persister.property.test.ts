/**
 * Property-based tests for profile persistence round trip.
 *
 * Property 9: Profile persistence round trip
 * - For any valid SearchCriteria, saving it to a UserProfile and then loading
 *   that profile SHALL return SearchCriteria with identical field values to the original.
 *
 * Validates: Requirements 7.2
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { promises as fs } from "node:fs";
import path from "node:path";
import { saveProfile, loadProfile } from "./profile-persister.js";
import type { SearchCriteria, CommuteMode, StoreyPreference, UserProfile } from "../types/index.js";

const PROFILES_DIR = path.resolve(process.cwd(), "data", "profiles");

// --- Arbitraries for valid SearchCriteria ---

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

/** Generates a unique user id for test isolation */
const testUserId = fc.uuid().map((id) => `pbt-${id}`);

describe("Property 9: Profile persistence round trip", () => {
  const createdFiles: string[] = [];

  afterEach(async () => {
    // Clean up all profile files created during property tests
    for (const file of createdFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore if file doesn't exist
      }
    }
    createdFiles.length = 0;
  });

  it("saving a UserProfile and loading it back SHALL return identical SearchCriteria field values", () => {
    return fc.assert(
      fc.asyncProperty(validSearchCriteria, testUserId, async (criteria, userId) => {
        const profile: UserProfile = {
          id: userId,
          searchCriteria: criteria,
          lastUpdated: new Date().toISOString(),
        };

        // Track file for cleanup
        createdFiles.push(path.join(PROFILES_DIR, `${userId}.json`));

        // Save and load back
        await saveProfile(profile);
        const loaded = await loadProfile(userId);

        // Profile must exist
        expect(loaded).not.toBeNull();

        // All searchCriteria fields must be identical
        expect(loaded!.searchCriteria.maxBudget).toBe(criteria.maxBudget);
        expect(loaded!.searchCriteria.workAddress).toBe(criteria.workAddress);
        expect(loaded!.searchCriteria.maxCommuteMinutes).toBe(criteria.maxCommuteMinutes);
        expect(loaded!.searchCriteria.commuteMode).toBe(criteria.commuteMode);
        expect(loaded!.searchCriteria.minBedrooms).toBe(criteria.minBedrooms);
        expect(loaded!.searchCriteria.minLandSize).toBe(criteria.minLandSize);
        expect(loaded!.searchCriteria.storeyPreference).toBe(criteria.storeyPreference);

        // Deep equality check on the entire searchCriteria object
        expect(loaded!.searchCriteria).toEqual(criteria);

        // Profile id must match
        expect(loaded!.id).toBe(userId);
      }),
      { numRuns: 100 }
    );
  });
});
