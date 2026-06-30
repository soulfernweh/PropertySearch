import { describe, it, expect } from "vitest";
import { presentResults } from "./result-presenter.js";
import type { PipelineResult } from "./orchestrator.js";
import type { ShortlistedProperty } from "../types/index.js";
import type { ShortlistResult } from "./shortlist-assembler.js";

function makeProperty(overrides: Partial<ShortlistedProperty> = {}): ShortlistedProperty {
  return {
    id: "prop-1",
    address: "10 Smith St, Richmond VIC 3121",
    priceText: "$750,000",
    priceAud: 750000,
    bedrooms: 3,
    landSizeSqm: 450,
    storeys: 2,
    commuteMinutes: 25,
    ...overrides,
  };
}

function makeShortlist(overrides: Partial<ShortlistResult> = {}): ShortlistResult {
  return {
    properties: [makeProperty()],
    totalEvaluated: 100,
    totalMatching: 1,
    hasMore: false,
    ...overrides,
  };
}

describe("presentResults", () => {
  it("formats an error result with stage info", () => {
    const result: PipelineResult = {
      success: false,
      error: { stage: "geocoding", message: "Address could not be resolved" },
      durationMs: 500,
    };

    const output = presentResults(result);
    expect(output).toBe("Error [geocoding]: Address could not be resolved");
  });

  it("formats an error result without error details", () => {
    const result: PipelineResult = {
      success: false,
      durationMs: 200,
    };

    const output = presentResults(result);
    expect(output).toBe("Error: Search pipeline failed");
  });

  it("displays timeout warning for partial results", () => {
    const result: PipelineResult = {
      success: true,
      shortlist: makeShortlist(),
      durationMs: 60000,
      timedOut: true,
    };

    const output = presentResults(result);
    expect(output).toContain("⚠ Warning: Search timed out. Results may be incomplete.");
  });

  it("displays header with evaluated and matched counts", () => {
    const result: PipelineResult = {
      success: true,
      shortlist: makeShortlist({ totalEvaluated: 250, totalMatching: 5 }),
      durationMs: 5000,
    };

    const output = presentResults(result);
    expect(output).toContain("Evaluated 250 properties, found 5 matches");
  });

  it("formats property details: address, price, bedrooms, land size, storeys, commute", () => {
    const property = makeProperty({
      address: "5 Collins St, Melbourne VIC 3000",
      priceAud: 1200000,
      bedrooms: 4,
      landSizeSqm: 600,
      storeys: 2,
      commuteMinutes: 15,
    });

    const result: PipelineResult = {
      success: true,
      shortlist: makeShortlist({ properties: [property], totalMatching: 1 }),
      durationMs: 3000,
    };

    const output = presentResults(result);
    expect(output).toContain("5 Collins St, Melbourne VIC 3000");
    expect(output).toContain("$1,200,000");
    expect(output).toContain("Bedrooms: 4");
    expect(output).toContain("Land: 600 sqm");
    expect(output).toContain("Storeys: 2");
    expect(output).toContain("Commute: 15 min");
  });

  it("handles zero results with relaxation suggestion", () => {
    const result: PipelineResult = {
      success: true,
      shortlist: makeShortlist({
        properties: [],
        totalMatching: 0,
        suggestedRelaxation: "Try increasing your maximum commute time or budget",
      }),
      durationMs: 4000,
    };

    const output = presentResults(result);
    expect(output).toContain("No properties match all your criteria.");
    expect(output).toContain("Suggestion: Try increasing your maximum commute time or budget");
  });

  it("handles zero results without relaxation suggestion", () => {
    const result: PipelineResult = {
      success: true,
      shortlist: makeShortlist({
        properties: [],
        totalMatching: 0,
        suggestedRelaxation: undefined,
      }),
      durationMs: 4000,
    };

    const output = presentResults(result);
    expect(output).toContain("No properties match all your criteria.");
    expect(output).not.toContain("Suggestion:");
  });

  it("shows overflow indicator when hasMore is true", () => {
    const result: PipelineResult = {
      success: true,
      shortlist: makeShortlist({ totalMatching: 35, hasMore: true }),
      durationMs: 5000,
    };

    const output = presentResults(result);
    expect(output).toContain("Showing top 20 of 35 matches");
  });

  it("does not show overflow indicator when hasMore is false", () => {
    const result: PipelineResult = {
      success: true,
      shortlist: makeShortlist({ totalMatching: 5, hasMore: false }),
      durationMs: 5000,
    };

    const output = presentResults(result);
    expect(output).not.toContain("Showing top");
  });

  it("displays multiple properties with numbering", () => {
    const properties = [
      makeProperty({ address: "1 Alpha St", commuteMinutes: 10 }),
      makeProperty({ address: "2 Beta St", commuteMinutes: 20 }),
    ];

    const result: PipelineResult = {
      success: true,
      shortlist: makeShortlist({ properties, totalMatching: 2 }),
      durationMs: 3000,
    };

    const output = presentResults(result);
    expect(output).toContain("1. 1 Alpha St");
    expect(output).toContain("2. 2 Beta St");
  });
});
