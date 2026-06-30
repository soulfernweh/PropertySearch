/**
 * Result Presenter — formats PipelineResult for terminal/console display.
 *
 * Handles:
 * - Error formatting with stage info
 * - Timeout warning for partial results
 * - Shortlisted property display (address, price, bedrooms, land size, storeys, commute time)
 * - Summary counts (evaluated, shortlisted)
 * - Zero-result messaging with relaxation suggestions
 * - Overflow indicator when hasMore is true
 *
 * Requirements: 6.2, 6.4, 6.5
 */

import type { PipelineResult } from "./orchestrator.js";
import type { ShortlistedProperty } from "../types/index.js";
import type { ShortlistResult } from "./shortlist-assembler.js";

/**
 * Formats a dollar amount as AUD with thousand separators.
 * Example: 750000 → "$750,000"
 */
function formatPrice(amount: number): string {
  return `$${amount.toLocaleString("en-AU")}`;
}

/**
 * Formats a single shortlisted property as a readable line.
 */
function formatProperty(property: ShortlistedProperty, index: number): string {
  const parts = [
    `${index + 1}. ${property.address}`,
    `   Price: ${formatPrice(property.priceAud)}`,
    `   Bedrooms: ${property.bedrooms} | Land: ${property.landSizeSqm} sqm | Storeys: ${property.storeys}`,
    `   Commute: ${property.commuteMinutes} min`,
  ];
  return parts.join("\n");
}

/**
 * Formats the full PipelineResult for display on a terminal/console.
 *
 * @param pipelineResult - The result from runSearchPipeline
 * @returns A formatted string suitable for console output
 */
export function presentResults(pipelineResult: PipelineResult): string {
  const lines: string[] = [];

  // Handle pipeline failure
  if (!pipelineResult.success) {
    const error = pipelineResult.error;
    if (error) {
      lines.push(`Error [${error.stage}]: ${error.message}`);
    } else {
      lines.push("Error: Search pipeline failed");
    }
    return lines.join("\n");
  }

  // Handle timeout warning
  if (pipelineResult.timedOut) {
    lines.push("⚠ Warning: Search timed out. Results may be incomplete.");
    lines.push("");
  }

  const shortlist = pipelineResult.shortlist as ShortlistResult;

  // Header with counts
  lines.push(
    `Evaluated ${shortlist.totalEvaluated} properties, found ${shortlist.totalMatching} matches`
  );
  lines.push("");

  // Zero-result case
  if (shortlist.properties.length === 0) {
    lines.push("No properties match all your criteria.");
    if (shortlist.suggestedRelaxation) {
      lines.push(`Suggestion: ${shortlist.suggestedRelaxation}`);
    }
    return lines.join("\n");
  }

  // Overflow indicator
  if (shortlist.hasMore) {
    lines.push(`Showing top 20 of ${shortlist.totalMatching} matches`);
    lines.push("");
  }

  // Property listing
  for (let i = 0; i < shortlist.properties.length; i++) {
    lines.push(formatProperty(shortlist.properties[i], i));
    if (i < shortlist.properties.length - 1) {
      lines.push("");
    }
  }

  return lines.join("\n");
}
