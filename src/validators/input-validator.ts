/**
 * Input validation for SearchCriteria.
 * Validates required fields, value ranges, and enum values.
 */

import type { SearchCriteria, CommuteMode, StoreyPreference } from "../types/index.js";
import type { ValidationResult, ValidationError } from "../types/errors.js";

/** Valid commute mode values */
const VALID_COMMUTE_MODES: CommuteMode[] = ["driving", "public_transport", "cycling", "walking"];

/** Valid storey preference values */
const VALID_STOREY_PREFERENCES: StoreyPreference[] = ["single", "double", "any"];

/** Budget constraints (AUD) */
const MIN_BUDGET = 100_000;
const MAX_BUDGET = 10_000_000;

/** Commute time constraints (minutes) */
const MIN_COMMUTE_MINUTES = 5;
const MAX_COMMUTE_MINUTES = 120;

/** Bedroom constraints */
const MIN_BEDROOMS = 1;
const MAX_BEDROOMS = 6;

/** Land size constraints (square metres) */
const MIN_LAND_SIZE = 0;
const MAX_LAND_SIZE = 2000;

/**
 * Validates user-provided SearchCriteria against all constraints.
 *
 * Required fields: maxBudget, workAddress, maxCommuteMinutes, commuteMode
 * Optional fields (validated only if present): minBedrooms, minLandSize, storeyPreference
 *
 * @param criteria - Partial SearchCriteria to validate
 * @returns ValidationResult with valid flag and field-level errors
 */
export function validateSearchCriteria(criteria: Partial<SearchCriteria>): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate required fields presence
  if (criteria.maxBudget === undefined || criteria.maxBudget === null) {
    errors.push({ field: "maxBudget", message: "maxBudget is required" });
  }

  if (criteria.workAddress === undefined || criteria.workAddress === null || criteria.workAddress === "") {
    errors.push({ field: "workAddress", message: "workAddress is required" });
  }

  if (criteria.maxCommuteMinutes === undefined || criteria.maxCommuteMinutes === null) {
    errors.push({ field: "maxCommuteMinutes", message: "maxCommuteMinutes is required" });
  }

  if (criteria.commuteMode === undefined || criteria.commuteMode === null) {
    errors.push({ field: "commuteMode", message: "commuteMode is required" });
  }

  // Validate value ranges (only if field is present)
  if (criteria.maxBudget !== undefined && criteria.maxBudget !== null) {
    if (typeof criteria.maxBudget !== "number" || !Number.isFinite(criteria.maxBudget)) {
      errors.push({ field: "maxBudget", message: "maxBudget must be a valid number" });
    } else if (criteria.maxBudget < MIN_BUDGET || criteria.maxBudget > MAX_BUDGET) {
      errors.push({
        field: "maxBudget",
        message: `maxBudget must be between ${MIN_BUDGET} and ${MAX_BUDGET} inclusive`,
      });
    }
  }

  if (criteria.maxCommuteMinutes !== undefined && criteria.maxCommuteMinutes !== null) {
    if (typeof criteria.maxCommuteMinutes !== "number" || !Number.isFinite(criteria.maxCommuteMinutes)) {
      errors.push({ field: "maxCommuteMinutes", message: "maxCommuteMinutes must be a valid number" });
    } else if (criteria.maxCommuteMinutes < MIN_COMMUTE_MINUTES || criteria.maxCommuteMinutes > MAX_COMMUTE_MINUTES) {
      errors.push({
        field: "maxCommuteMinutes",
        message: `maxCommuteMinutes must be between ${MIN_COMMUTE_MINUTES} and ${MAX_COMMUTE_MINUTES} inclusive`,
      });
    }
  }

  // Validate enum values
  if (criteria.commuteMode !== undefined && criteria.commuteMode !== null) {
    if (!VALID_COMMUTE_MODES.includes(criteria.commuteMode as CommuteMode)) {
      errors.push({
        field: "commuteMode",
        message: `commuteMode must be one of: ${VALID_COMMUTE_MODES.join(", ")}`,
      });
    }
  }

  // Validate optional fields (only if present)
  if (criteria.minBedrooms !== undefined && criteria.minBedrooms !== null) {
    if (typeof criteria.minBedrooms !== "number" || !Number.isFinite(criteria.minBedrooms)) {
      errors.push({ field: "minBedrooms", message: "minBedrooms must be a valid number" });
    } else if (criteria.minBedrooms < MIN_BEDROOMS || criteria.minBedrooms > MAX_BEDROOMS) {
      errors.push({
        field: "minBedrooms",
        message: `minBedrooms must be between ${MIN_BEDROOMS} and ${MAX_BEDROOMS} inclusive`,
      });
    }
  }

  if (criteria.minLandSize !== undefined && criteria.minLandSize !== null) {
    if (typeof criteria.minLandSize !== "number" || !Number.isFinite(criteria.minLandSize)) {
      errors.push({ field: "minLandSize", message: "minLandSize must be a valid number" });
    } else if (criteria.minLandSize < MIN_LAND_SIZE || criteria.minLandSize > MAX_LAND_SIZE) {
      errors.push({
        field: "minLandSize",
        message: `minLandSize must be between ${MIN_LAND_SIZE} and ${MAX_LAND_SIZE} inclusive`,
      });
    }
  }

  if (criteria.storeyPreference !== undefined && criteria.storeyPreference !== null) {
    if (!VALID_STOREY_PREFERENCES.includes(criteria.storeyPreference as StoreyPreference)) {
      errors.push({
        field: "storeyPreference",
        message: `storeyPreference must be one of: ${VALID_STOREY_PREFERENCES.join(", ")}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
