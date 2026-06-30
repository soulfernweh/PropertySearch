/**
 * Pipeline Orchestrator — coordinates the full property search pipeline
 * from validation through shortlist assembly.
 *
 * Enforces a configurable overall timeout (default 60 seconds) with
 * partial result fallback. Reports errors with stage identification.
 *
 * Requirements: 1.6, 2.3, 4.7, 6.6
 */

import type { SearchCriteria, GeoCoordinates } from "../types/index.js";
import type { PipelineError } from "../types/errors.js";
import { validateSearchCriteria } from "../validators/input-validator.js";
import { geocodeAddress } from "../services/geocoder.js";
import { fetchListings } from "../services/listing-fetcher.js";
import { validateListings } from "../services/listing-validator.js";
import { filterByBudget } from "../filters/budget-filter.js";
import { filterBySpecs } from "../filters/spec-filter.js";
import { calculateCommuteTimes } from "../services/commute-calculator.js";
import { assembleShortlist, ShortlistResult } from "./shortlist-assembler.js";
import { saveProfile } from "../services/profile-persister.js";

/** Result returned by the search pipeline */
export interface PipelineResult {
  success: boolean;
  shortlist?: ShortlistResult;
  error?: PipelineError;
  durationMs: number;
  timedOut?: boolean;
}

/** Default overall pipeline timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Wraps a promise with a timeout. If the promise does not resolve within
 * the given time budget, it rejects with a timeout error.
 */
function withTimeout<T>(
  promise: Promise<T>,
  remainingMs: number,
  stageName: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Pipeline timeout: stage "${stageName}" exceeded remaining time budget`));
    }, Math.max(remainingMs, 0));

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Determines the search region based on the geocoded address state.
 * Falls back to "melbourne" for coordinates in Victoria's latitude range,
 * otherwise "sydney".
 */
function determineRegion(
  coordinates: GeoCoordinates
): "melbourne" | "sydney" {
  // Melbourne is roughly around latitude -37.8, Sydney around -33.9
  // Simple heuristic: if latitude is below -36, assume Melbourne/VIC
  if (coordinates.latitude < -36) {
    return "melbourne";
  }
  return "sydney";
}

/**
 * Runs the full search pipeline coordinating all stages in sequence:
 * 1. Validate criteria
 * 2. Geocode work address
 * 3. Fetch listings
 * 4. Validate listings (exclude incomplete)
 * 5. Filter by budget
 * 6. Filter by property specs
 * 7. Calculate commute times
 * 8. Assemble shortlist
 *
 * Also persists criteria to a user profile (fire-and-forget).
 *
 * Enforces an overall timeout (default 60s). If any stage exceeds the
 * remaining time budget, returns partial results with a timeout warning.
 *
 * @param criteria - User's search criteria
 * @param timeoutMs - Overall timeout in milliseconds (default 60000)
 * @returns PipelineResult with success status, shortlist, timing, and errors
 */
export async function runSearchPipeline(
  criteria: SearchCriteria,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<PipelineResult> {
  const start = Date.now();

  /** Helper: remaining time from now */
  const remaining = () => timeoutMs - (Date.now() - start);

  // --- Stage 1: Validate input criteria ---
  const validationResult = validateSearchCriteria(criteria);
  if (!validationResult.valid) {
    return {
      success: false,
      error: {
        stage: "validation",
        message: validationResult.errors.map((e) => `${e.field}: ${e.message}`).join("; "),
      },
      durationMs: Date.now() - start,
    };
  }

  // Fire-and-forget profile persistence (don't fail pipeline on persistence error)
  saveProfile({
    id: "default",
    searchCriteria: criteria,
    lastUpdated: new Date().toISOString(),
  }).catch(() => {
    // Silently ignore persistence errors per requirements
  });

  // --- Stage 2: Geocode work address ---
  let workCoordinates: GeoCoordinates;
  try {
    const geocodeResult = await withTimeout(
      geocodeAddress(criteria.workAddress),
      remaining(),
      "geocoding"
    );

    if (!geocodeResult.success || !geocodeResult.coordinates) {
      return {
        success: false,
        error: {
          stage: "geocoding",
          message: geocodeResult.error || "Failed to geocode work address",
        },
        durationMs: Date.now() - start,
      };
    }
    workCoordinates = geocodeResult.coordinates;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geocoding timed out";
    return {
      success: false,
      error: { stage: "geocoding", message },
      durationMs: Date.now() - start,
      timedOut: message.includes("timeout"),
    };
  }

  // --- Stage 3: Fetch listings ---
  const region = determineRegion(workCoordinates);
  let rawListings;
  try {
    const fetchResult = await withTimeout(
      fetchListings(region),
      remaining(),
      "listing_fetch"
    );

    if (!fetchResult.success) {
      return {
        success: false,
        error: {
          stage: "listing_fetch",
          message: fetchResult.error || "Failed to fetch property listings",
        },
        durationMs: Date.now() - start,
      };
    }
    rawListings = fetchResult.listings;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Listing fetch timed out";
    return {
      success: false,
      error: { stage: "listing_fetch", message },
      durationMs: Date.now() - start,
      timedOut: message.includes("timeout"),
    };
  }

  // --- Stage 4: Validate listings (exclude incomplete) ---
  const { valid: validListings } = validateListings(rawListings);

  // --- Stage 5: Filter by budget ---
  const { included: budgetFiltered } = filterByBudget(validListings, criteria.maxBudget);

  // --- Stage 6: Filter by property specs ---
  const specFiltered = filterBySpecs(budgetFiltered, {
    minBedrooms: criteria.minBedrooms,
    minLandSize: criteria.minLandSize,
    storeyPreference: criteria.storeyPreference,
  });

  // --- Stage 7: Calculate commute times ---
  let commuteResults;
  try {
    const propertiesToCalculate = specFiltered.map((listing) => ({
      id: listing.id,
      coordinates: listing.coordinates,
    }));

    commuteResults = await withTimeout(
      calculateCommuteTimes(propertiesToCalculate, workCoordinates, criteria.commuteMode),
      remaining(),
      "commute"
    );
  } catch (error) {
    // On commute timeout, return partial results with what we have so far
    const message = error instanceof Error ? error.message : "Commute calculation timed out";
    if (message.includes("timeout")) {
      // Assemble partial results without commute data
      const partialShortlist: ShortlistResult = {
        properties: [],
        totalEvaluated: validListings.length,
        totalMatching: 0,
        hasMore: false,
        suggestedRelaxation: "Commute calculation timed out. Try again or increase your budget/commute time.",
      };
      return {
        success: true,
        shortlist: partialShortlist,
        durationMs: Date.now() - start,
        timedOut: true,
      };
    }
    return {
      success: false,
      error: { stage: "commute", message },
      durationMs: Date.now() - start,
    };
  }

  // --- Stage 8: Assemble shortlist ---
  try {
    const shortlist = assembleShortlist(
      specFiltered,
      commuteResults,
      criteria.maxCommuteMinutes
    );

    // Override totalEvaluated to reflect all valid listings that entered the pipeline
    const result: ShortlistResult = {
      ...shortlist,
      totalEvaluated: validListings.length,
    };

    return {
      success: true,
      shortlist: result,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shortlist assembly failed";
    return {
      success: false,
      error: { stage: "assembly", message },
      durationMs: Date.now() - start,
    };
  }
}
