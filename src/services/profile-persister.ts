import { promises as fs } from "node:fs";
import path from "node:path";
import type { UserProfile, SearchCriteria } from "../types/index.js";

/**
 * Directory where profile JSON files are stored.
 * Relative to project root: data/profiles/
 */
const PROFILES_DIR = path.resolve(process.cwd(), "data", "profiles");

/**
 * Ensures the profiles directory exists, creating it recursively if needed.
 */
async function ensureProfilesDir(): Promise<void> {
  await fs.mkdir(PROFILES_DIR, { recursive: true });
}

/**
 * Returns the file path for a given user's profile.
 */
function getProfilePath(userId: string): string {
  return path.join(PROFILES_DIR, `${userId}.json`);
}

/**
 * Saves a user profile to local JSON file storage.
 * Sets the lastUpdated timestamp to the current ISO time.
 *
 * @throws Error with descriptive message if the write fails.
 */
export async function saveProfile(profile: UserProfile): Promise<void> {
  await ensureProfilesDir();

  const profileToSave: UserProfile = {
    ...profile,
    lastUpdated: new Date().toISOString(),
  };

  const filePath = getProfilePath(profile.id);

  try {
    await fs.writeFile(filePath, JSON.stringify(profileToSave, null, 2), "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to save profile for user "${profile.id}": ${message}`);
  }
}

/**
 * Loads a user profile from local JSON file storage.
 * Returns null if the profile does not exist.
 *
 * @throws Error with descriptive message if reading fails for reasons other than file-not-found.
 */
export async function loadProfile(userId: string): Promise<UserProfile | null> {
  const filePath = getProfilePath(userId);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as UserProfile;
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return null;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load profile for user "${userId}": ${message}`);
  }
}

/**
 * Updates specific fields within a user's search criteria.
 * Loads the existing profile, merges the partial fields into searchCriteria,
 * and saves the updated profile with a new lastUpdated timestamp.
 *
 * @throws Error if the profile does not exist or if read/write fails.
 */
export async function updateProfileFields(
  userId: string,
  fields: Partial<SearchCriteria>
): Promise<UserProfile> {
  const existing = await loadProfile(userId);

  if (existing === null) {
    throw new Error(`Profile not found for user "${userId}". Cannot update a non-existent profile.`);
  }

  const updatedProfile: UserProfile = {
    ...existing,
    searchCriteria: {
      ...existing.searchCriteria,
      ...fields,
    },
    lastUpdated: new Date().toISOString(),
  };

  const filePath = getProfilePath(userId);

  try {
    await fs.writeFile(filePath, JSON.stringify(updatedProfile, null, 2), "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to update profile for user "${userId}": ${message}`);
  }

  return updatedProfile;
}

/**
 * Type guard for Node.js file-not-found errors (ENOENT).
 */
function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "ENOENT"
  );
}
