/**
 * Shortlist Assembler — combines filtered listings with commute times,
 * applies commute filtering, sorts, caps results, and produces the final shortlist.
 *
 * Requirements: 6.1, 6.3, 6.4, 6.5, 6.7
 */

import type { PropertyListing, ShortlistedProperty } from "../types/index.js";
import type { CommuteResult } from "../services/commute-calculator.js";
import { parsePrice, getComparisonPrice } from "../filters/price-parser.js";

/** The result of assembling a shortlist from filtered listings and commute data */
export interface ShortlistResult {
  properties: ShortlistedProperty[];
  totalEvaluated: number;
  totalMatching: number;
  hasMore: boolean;
  suggestedRelaxation?: string;
}

const DEFAULT_MAX_RESULTS = 20;

/**
 * Assembles the final shortlist by combining filtered listings with commute times.
 *
 * Steps:
 * 1. totalEvaluated = listings.length
 * 2. Match each listing with its commute result by id
 * 3. Exclude listings with null commute duration
 * 4. Exclude listings with commute duration > maxCommuteMinutes
 * 5. Parse price and extract comparison price (0 if unparseable)
 * 6. Sort by commuteMinutes ascending, then priceAud ascending for ties
 * 7. totalMatching = count of all matching listings (before cap)
 * 8. Cap at maxResults (default 20)
 * 9. hasMore = totalMatching > maxResults
 * 10. If totalMatching === 0, generate suggestedRelaxation hint
 */
export function assembleShortlist(
  listings: PropertyListing[],
  commuteTimes: CommuteResult[],
  maxCommuteMinutes: number,
  maxResults: number = DEFAULT_MAX_RESULTS
): ShortlistResult {
  const totalEvaluated = listings.length;

  // Build a lookup map for commute results by property id
  const commuteMap = new Map<string, CommuteResult>();
  for (const result of commuteTimes) {
    commuteMap.set(result.propertyId, result);
  }

  // Filter and transform listings into shortlisted properties
  const matching: ShortlistedProperty[] = [];

  for (const listing of listings) {
    const commuteResult = commuteMap.get(listing.id);

    // Exclude listings without a commute result or with null duration
    if (!commuteResult || commuteResult.durationMinutes === null) {
      continue;
    }

    // Exclude listings exceeding max commute time
    if (commuteResult.durationMinutes > maxCommuteMinutes) {
      continue;
    }

    // Parse price — use 0 if unparseable
    const parsed = parsePrice(listing.priceText);
    const comparisonPrice = getComparisonPrice(parsed);
    const priceAud = comparisonPrice ?? 0;

    matching.push({
      id: listing.id,
      address: listing.address,
      priceText: listing.priceText,
      priceAud,
      bedrooms: listing.bedrooms,
      landSizeSqm: listing.landSizeSqm,
      storeys: listing.storeys,
      commuteMinutes: commuteResult.durationMinutes,
      listingUrl: listing.listingUrl,
    });
  }

  // Sort by commute time ascending, then price ascending for ties
  matching.sort((a, b) => {
    if (a.commuteMinutes !== b.commuteMinutes) {
      return a.commuteMinutes - b.commuteMinutes;
    }
    return a.priceAud - b.priceAud;
  });

  const totalMatching = matching.length;
  const hasMore = totalMatching > maxResults;
  const properties = matching.slice(0, maxResults);

  // Generate relaxation hint when no results match
  const suggestedRelaxation =
    totalMatching === 0
      ? "Try increasing your maximum commute time or budget"
      : undefined;

  return {
    properties,
    totalEvaluated,
    totalMatching,
    hasMore,
    suggestedRelaxation,
  };
}
