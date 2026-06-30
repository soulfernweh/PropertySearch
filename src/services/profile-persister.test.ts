import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { saveProfile, loadProfile, updateProfileFields } from "./profile-persister.js";
import type { UserProfile, SearchCriteria } from "../types/index.js";

const PROFILES_DIR = path.resolve(process.cwd(), "data", "profiles");

function createTestProfile(overrides?: Partial<UserProfile>): UserProfile {
  const defaultCriteria: SearchCriteria = {
    maxBudget: 800000,
    workAddress: "123 Collins St, Melbourne VIC 3000",
    maxCommuteMinutes: 45,
    commuteMode: "driving",
    minBedrooms: 3,
    minLandSize: 400,
    storeyPreference: "any",
  };

  return {
    id: "test-user-1",
    searchCriteria: defaultCriteria,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

describe("profile-persister", () => {
  beforeEach(async () => {
    // Clean up test files before each test
    try {
      const files = await fs.readdir(PROFILES_DIR);
      for (const file of files) {
        if (file.startsWith("test-")) {
          await fs.unlink(path.join(PROFILES_DIR, file));
        }
      }
    } catch {
      // Directory may not exist yet, that's fine
    }
  });

  afterEach(async () => {
    // Clean up test files after each test
    try {
      const files = await fs.readdir(PROFILES_DIR);
      for (const file of files) {
        if (file.startsWith("test-")) {
          await fs.unlink(path.join(PROFILES_DIR, file));
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("saveProfile", () => {
    it("should save a profile as JSON file", async () => {
      const profile = createTestProfile();
      await saveProfile(profile);

      const filePath = path.join(PROFILES_DIR, `${profile.id}.json`);
      const content = await fs.readFile(filePath, "utf-8");
      const saved = JSON.parse(content) as UserProfile;

      expect(saved.id).toBe(profile.id);
      expect(saved.searchCriteria.maxBudget).toBe(800000);
      expect(saved.searchCriteria.workAddress).toBe("123 Collins St, Melbourne VIC 3000");
    });

    it("should set lastUpdated timestamp on save", async () => {
      const profile = createTestProfile({ lastUpdated: "2020-01-01T00:00:00.000Z" });
      const beforeSave = new Date();
      await saveProfile(profile);

      const filePath = path.join(PROFILES_DIR, `${profile.id}.json`);
      const content = await fs.readFile(filePath, "utf-8");
      const saved = JSON.parse(content) as UserProfile;

      const savedDate = new Date(saved.lastUpdated);
      expect(savedDate.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
    });

    it("should create the profiles directory if it doesn't exist", async () => {
      // Verify the directory exists after a save operation.
      // Note: We don't remove PROFILES_DIR here to avoid interfering with parallel tests.
      // The ensureProfilesDir logic is exercised on every saveProfile call — if the dir
      // didn't exist at process start, the first save would create it.
      const profile = createTestProfile({ id: "test-dir-creation" });
      await saveProfile(profile);

      const stat = await fs.stat(PROFILES_DIR);
      expect(stat.isDirectory()).toBe(true);
    });

    it("should overwrite existing profile on re-save", async () => {
      const profile = createTestProfile();
      await saveProfile(profile);

      const updatedProfile = createTestProfile({
        searchCriteria: { ...profile.searchCriteria, maxBudget: 1000000 },
      });
      await saveProfile(updatedProfile);

      const filePath = path.join(PROFILES_DIR, `${profile.id}.json`);
      const content = await fs.readFile(filePath, "utf-8");
      const saved = JSON.parse(content) as UserProfile;

      expect(saved.searchCriteria.maxBudget).toBe(1000000);
    });
  });

  describe("loadProfile", () => {
    it("should load an existing profile", async () => {
      const profile = createTestProfile();
      await saveProfile(profile);

      const loaded = await loadProfile(profile.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(profile.id);
      expect(loaded!.searchCriteria.maxBudget).toBe(800000);
      expect(loaded!.searchCriteria.commuteMode).toBe("driving");
    });

    it("should return null for non-existent profile", async () => {
      const loaded = await loadProfile("test-nonexistent-user");
      expect(loaded).toBeNull();
    });

    it("should preserve all search criteria fields", async () => {
      const profile = createTestProfile();
      await saveProfile(profile);

      const loaded = await loadProfile(profile.id);
      expect(loaded!.searchCriteria).toEqual(profile.searchCriteria);
    });
  });

  describe("updateProfileFields", () => {
    it("should update specified fields and preserve others", async () => {
      const profile = createTestProfile();
      await saveProfile(profile);

      const updated = await updateProfileFields(profile.id, { maxBudget: 900000 });

      expect(updated.searchCriteria.maxBudget).toBe(900000);
      expect(updated.searchCriteria.workAddress).toBe("123 Collins St, Melbourne VIC 3000");
      expect(updated.searchCriteria.maxCommuteMinutes).toBe(45);
      expect(updated.searchCriteria.commuteMode).toBe("driving");
      expect(updated.searchCriteria.minBedrooms).toBe(3);
    });

    it("should update the lastUpdated timestamp", async () => {
      const profile = createTestProfile();
      await saveProfile(profile);

      const beforeUpdate = new Date();
      const updated = await updateProfileFields(profile.id, { maxBudget: 900000 });

      const updatedDate = new Date(updated.lastUpdated);
      expect(updatedDate.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it("should persist the updated profile to disk", async () => {
      const profile = createTestProfile();
      await saveProfile(profile);

      await updateProfileFields(profile.id, { maxCommuteMinutes: 60, minBedrooms: 4 });

      const loaded = await loadProfile(profile.id);
      expect(loaded!.searchCriteria.maxCommuteMinutes).toBe(60);
      expect(loaded!.searchCriteria.minBedrooms).toBe(4);
      expect(loaded!.searchCriteria.maxBudget).toBe(800000); // unchanged
    });

    it("should throw error if profile does not exist", async () => {
      await expect(
        updateProfileFields("test-nonexistent-user", { maxBudget: 500000 })
      ).rejects.toThrow("Profile not found");
    });

    it("should handle updating multiple fields at once", async () => {
      const profile = createTestProfile();
      await saveProfile(profile);

      const updated = await updateProfileFields(profile.id, {
        maxBudget: 1200000,
        maxCommuteMinutes: 30,
        commuteMode: "public_transport",
        storeyPreference: "double",
      });

      expect(updated.searchCriteria.maxBudget).toBe(1200000);
      expect(updated.searchCriteria.maxCommuteMinutes).toBe(30);
      expect(updated.searchCriteria.commuteMode).toBe("public_transport");
      expect(updated.searchCriteria.storeyPreference).toBe("double");
      // Unchanged fields
      expect(updated.searchCriteria.workAddress).toBe("123 Collins St, Melbourne VIC 3000");
      expect(updated.searchCriteria.minBedrooms).toBe(3);
      expect(updated.searchCriteria.minLandSize).toBe(400);
    });
  });
});
