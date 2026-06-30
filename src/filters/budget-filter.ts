/**
 * Budget filter for property listings.
 *
 * Compares parsed listing prices against a user's maximum budget,
 * separating results into included, excluded, and unparseable categories.
 */

import type { PropertyListing } from "../types/index.js";
import { parsePrice, getComparisonPrice } from "./price-parser.js";

/** Result of budget filtering, categorizing listings into three groups */
export interface BudgetFilterResult {
  /** Listings with comparison price <= maxBudget */
  included: PropertyListing[];
  /** Listings with comparison price > maxBudget */
  excluded: PropertyListing[];
  /** Listings whose price could not be parsed into a numeric value */
  unparseable: PropertyListing[];
}

/**
 * Filters property listings by comparing parsed prices against maxBudget.
 *
 * For each listing:
 * 1. Parses priceText using parsePrice()
 * 2. Gets comparison price using getComparisonPrice()
 * 3. If comparison price is null (unparseable), categorizes as unparseable
 * 4. If comparison price <= maxBudget, categorizes as included
 * 5. If comparison price > maxBudget, categorizes as excluded
 *
 * @param listings - Array of property listings to filter
 * @param maxBudget - Maximum budget in AUD
 * @returns BudgetFilterResult with included, excluded, and unparseable arrays
 */
export function filterByBudget(
  listings: PropertyListing[],
  maxBudget: number
): BudgetFilterResult {
  const included: PropertyListing[] = [];
  const excluded: PropertyListing[] = [];
  const unparseable: PropertyListing[] = [];

  for (const listing of listings) {
    const parsed = parsePrice(listing.priceText);
    const comparisonPrice = getComparisonPrice(parsed);

    if (comparisonPrice === null) {
      unparseable.push(listing);
    } else if (comparisonPrice <= maxBudget) {
      included.push(listing);
    } else {
      excluded.push(listing);
    }
  }

  return { included, excluded, unparseable };
}
