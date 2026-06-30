/**
 * Property-based test for profile partial update.
 *
 * Property 10: Profile partial update preserves unchanged fields
 * - Generate random saved UserProfile and random non-empty subset of fields to update
 * - Perform partial update, assert updated fields have new values, unchanged fields retain original values
 *
 * Validates: Requirements 7.3
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fc from "fast-check";
import { promises as fs } from "node:fs";
import path from "node:path";
import { saveProfile, loadProfile, updateProfileFields } from "./profile-persister.js";
import type { UserProfile, SearchCriteria, CommuteMode, StoreyPreference } from "../types/index.js";

const PROFILES_DIR = path.resolve(process.cwd(), "data", "profiles");

// --- Arbitraries for valid SearchCriteria fields ---

const validBudget = fc.integer({ min: 100_000, max: 10_000_000 });
const validCommuteMinutes = fc.integer({ min: 5, max: 120 });
const validCommuteMode = fc.constantFrom<CommuteMode>("driving", "public_transport", "cycling", "walking");
const validWorkAddress = fc.stringMatching(/^[A-Za-z0-9 ,]{5,100}$/);
const validBedrooms = fc.integer({ min: 1, max: 6 });
const validLandSize = fc.integer({ min: 0, max: 2000 });
const validStoreyPreference = fc.constantFrom<StoreyPreference>("single", "double", "any");

/** Generates a fully populated SearchCriteria (all optional fields present) */
const fullSearchCriteria: fc.Arbitrary<SearchCriteria> = fc.record({
  maxBudget: validBudget,
  workAddress: validWorkAddress,
  maxCommuteMinutes: validCommuteMinutes,
  commuteMode: validCommuteMode,
  minBedrooms: validBedrooms,
  minLandSize: validLandSize,
  storeyPreference: validStoreyPreference,
});

/** Generates a valid UserProfile with a unique ID */
const validUserProfile = (index: number): fc.Arbitrary<UserProfile> =>
  fullSearchCriteria.map((criteria) => ({
    id: `pbt-update-${index}-${Date.now()}`,
    searchCriteria: criteria,
    lastUpdated: new Date().toISOString(),
  }));

/**
 * All SearchCriteria field keys that can be partially updated.
 */
const allCriteriaKeys: (keyof SearchCriteria)[] = [
  "maxBudget",
  "workAddress",
  "maxCommuteMinutes",
  "commuteMode",
  "minBedrooms",
  "minLandSize",
  "storeyPreference",
];

/**
 * Generates a random non-empty subset of SearchCriteria keys
 * along with new values for each selected key.
 */
const partialUpdateArb: fc.Arbitrary<{ keys: (keyof SearchCriteria)[]; fields: Partial<SearchCriteria> }> =
  fc.record({
    maxBudget: validBudget,
    workAddress: validWorkAddress,
    maxCommuteMinutes: validCommuteMinutes,
    commuteMode: validCommuteMode,
    minBedrooms: validBedrooms,
    minLandSize: validLandSize,
    storeyPreference: validStoreyPreference,
  }).chain((newValues) =>
    fc.subarray(allCriteriaKeys, { minLength: 1, maxLength: allCriteriaKeys.length }).map((keys) => {
      const fields: Partial<SearchCriteria> = {};
      for (const key of keys) {
        (fields as Record<string, unknown>)[key] = newValues[key];
      }
      return { keys, fields };
    })
  );

// --- Cleanup helpers ---

const createdProfileIds: string[] = [];

afterAll(async () => {
  // Clean up all profile files created during tests
  for (const id of createdProfileIds) {
    try {
      await fs.unlink(path.join(PROFILES_DIR, `${id}.json`));
    } catch {
      // Ignore if file doesn't exist
    }
  }
});

describe("Property 10: Profile partial update preserves unchanged fields", () => {
  let testCounter = 0;

  it("updated fields have new values and unchanged fields retain original values", async () => {
    await fc.assert(
      fc.asyncProperty(
        fullSearchCriteria,
        partialUpdateArb,
        async (originalCriteria, { keys: updatedKeys, fields: updateFields }) => {
          // Create a unique profile for this test run
          const profileId = `pbt-update-${testCounter++}-${Date.now()}`;
          createdProfileIds.push(profileId);

          const profile: UserProfile = {
            id: profileId,
            searchCriteria: originalCriteria,
            lastUpdated: new Date().toISOString(),
          };

          // Step 1: Save the original profile
          await saveProfile(profile);

          // Step 2: Record timestamp before update
          const beforeUpdate = new Date();

          // Step 3: Perform partial update
          const updatedProfile = await updateProfileFields(profileId, updateFields);

          // Step 4: Load the profile back from disk
          const loadedProfile = await loadProfile(profileId);
          expect(loadedProfile).not.toBeNull();

          // Step 5: Assert updated fields have new values
          for (const key of updatedKeys) {
            expect(updatedProfile.searchCriteria[key]).toEqual(updateFields[key]);
            expect(loadedProfile!.searchCriteria[key]).toEqual(updateFields[key]);
          }

          // Step 6: Assert unchanged fields retain original values
          const unchangedKeys = allCriteriaKeys.filter((k) => !updatedKeys.includes(k));
          for (const key of unchangedKeys) {
            expect(updatedProfile.searchCriteria[key]).toEqual(originalCriteria[key]);
            expect(loadedProfile!.searchCriteria[key]).toEqual(originalCriteria[key]);
          }

          // Step 7: Assert lastUpdated is updated
          const updatedDate = new Date(updatedProfile.lastUpdated);
          expect(updatedDate.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());

          const loadedDate = new Date(loadedProfile!.lastUpdated);
          expect(loadedDate.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
        }
      ),
      { numRuns: 100 }
    );
  });
});
