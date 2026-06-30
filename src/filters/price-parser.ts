/**
 * Price parser for Australian property listing price strings.
 *
 * Handles common formats:
 * - Fixed: "$750,000"
 * - Range: "$650,000 - $700,000"
 * - Plus: "$700,000+"
 * - Offers over: "Offers over $600,000"
 * - Unparseable: "Contact Agent", "Auction", etc.
 */

import type { PriceFormat } from "../types/index.js";

/**
 * Extracts a numeric dollar amount from a string fragment.
 * Handles formats like "$750,000", "750,000", "$1,200,000", "750000".
 */
function extractAmount(text: string): number | null {
  // Remove dollar sign and any surrounding whitespace
  const cleaned = text.replace(/\$/g, "").replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Parses an Australian property price string into a structured PriceFormat.
 *
 * Supported formats:
 * - "$750,000" → { type: "fixed", amount: 750000 }
 * - "$650,000 - $700,000" → { type: "range", lower: 650000, upper: 700000 }
 * - "$700,000+" → { type: "plus", minimum: 700000 }
 * - "Offers over $600,000" → { type: "offers_over", amount: 600000 }
 * - "Contact Agent" / "Auction" → { type: "unparseable" }
 */
export function parsePrice(priceText: string): PriceFormat {
  const trimmed = priceText.trim();

  if (!trimmed) {
    return { type: "unparseable" };
  }

  // Check for "offers over" pattern (case-insensitive)
  const offersOverMatch = trimmed.match(/offers?\s+over\s+\$?([\d,]+)/i);
  if (offersOverMatch) {
    const amount = extractAmount(offersOverMatch[1]);
    if (amount !== null) {
      return { type: "offers_over", amount };
    }
    return { type: "unparseable" };
  }

  // Check for range pattern: "$X - $Y" or "$X-$Y"
  const rangeMatch = trimmed.match(/\$?([\d,]+)\s*-\s*\$?([\d,]+)/);
  if (rangeMatch) {
    const lower = extractAmount(rangeMatch[1]);
    const upper = extractAmount(rangeMatch[2]);
    if (lower !== null && upper !== null) {
      return { type: "range", lower, upper };
    }
    return { type: "unparseable" };
  }

  // Check for plus pattern: "$X+" or "$X +"
  const plusMatch = trimmed.match(/\$?([\d,]+)\s*\+/);
  if (plusMatch) {
    const minimum = extractAmount(plusMatch[1]);
    if (minimum !== null) {
      return { type: "plus", minimum };
    }
    return { type: "unparseable" };
  }

  // Check for fixed price: "$X" or just a number with commas
  const fixedMatch = trimmed.match(/^\$?([\d,]+)$/);
  if (fixedMatch) {
    const amount = extractAmount(fixedMatch[1]);
    if (amount !== null) {
      return { type: "fixed", amount };
    }
    return { type: "unparseable" };
  }

  return { type: "unparseable" };
}

/**
 * Returns the appropriate comparison price for budget filtering.
 *
 * Rules:
 * - fixed → amount
 * - range → upper bound
 * - plus → minimum (listing excluded if minimum > budget)
 * - offers_over → stated amount
 * - unparseable → null (listing excluded from shortlist)
 */
export function getComparisonPrice(parsed: PriceFormat): number | null {
  switch (parsed.type) {
    case "fixed":
      return parsed.amount;
    case "range":
      return parsed.upper;
    case "plus":
      return parsed.minimum;
    case "offers_over":
      return parsed.amount;
    case "unparseable":
      return null;
  }
}
