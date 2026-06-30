# Implementation Plan: Property Search Shortlist

## Overview

This plan implements a TypeScript/Node.js property search shortlist system that orchestrates listing retrieval, multi-criteria filtering (budget, commute, property specs), and shortlist generation for first-time home buyers in Melbourne and Sydney. The implementation follows the pipeline architecture defined in the design: validate → geocode → fetch → filter → commute → assemble → present.

## Tasks

- [x] 1. Set up project structure and core interfaces
  - [x] 1.1 Initialize TypeScript project with Vitest and fast-check
    - Initialize Node.js project with TypeScript configuration
    - Install dependencies: typescript, vitest, fast-check, node-fetch (or axios)
    - Configure tsconfig.json with strict mode enabled
    - Configure vitest.config.ts with test file patterns (`**/*.test.ts`, `**/*.property.test.ts`)
    - Create directory structure: `src/`, `src/types/`, `src/filters/`, `src/services/`, `src/pipeline/`
    - _Requirements: All_

  - [x] 1.2 Define core TypeScript interfaces and types
    - Create `src/types/index.ts` with all domain types: SearchCriteria, CommuteMode, StoreyPreference, GeoCoordinates, PropertyListing, RawListing, PriceFormat, ShortlistedProperty, UserProfile
    - Create `src/types/api.ts` with external API response types: DomainListingResponse, RoutesMatrixResponse, GeocodingResponse
    - Create `src/types/errors.ts` with error types: ValidationError, ValidationResult, PipelineError, ErrorResponse
    - _Requirements: 1.1, 2.4, 3.2, 6.2_

- [x] 2. Implement input validation
  - [x] 2.1 Implement SearchCriteria validator
    - Create `src/validators/input-validator.ts`
    - Implement `validateSearchCriteria()` function
    - Validate budget range (100,000–10,000,000), commute time range (5–120), bedrooms (1–6), land size (0–2000)
    - Validate required fields: maxBudget, workAddress, maxCommuteMinutes, commuteMode
    - Validate enum values for commuteMode and storeyPreference
    - Return structured ValidationResult with field-level errors
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 2.2 Write property test for input validation
    - **Property 1: Input validation accepts valid criteria and rejects invalid criteria**
    - Generate random valid SearchCriteria within all specified ranges; assert validation returns valid=true
    - Generate random SearchCriteria with at least one out-of-range or missing field; assert validation returns valid=false with appropriate errors
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5**

  - [x] 2.3 Write unit tests for input validation
    - Test boundary values: budget exactly at 100,000 and 10,000,000
    - Test commute time at 5 and 120
    - Test missing required fields individually and in combination
    - Test invalid enum values
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 3. Implement price parsing and budget filtering
  - [x] 3.1 Implement price parser
    - Create `src/filters/price-parser.ts`
    - Implement `parsePrice()` function handling formats: fixed ("$750,000"), range ("$650,000 - $700,000"), plus ("$700,000+"), offers_over ("Offers over $600,000"), and unparseable ("Contact Agent", "Auction")
    - Implement `getComparisonPrice()` function returning appropriate comparison value for each PriceFormat type
    - Handle edge cases: spaces, missing dollar signs, varied formatting
    - _Requirements: 3.2_

  - [x] 3.2 Write property test for price parsing round trip
    - **Property 3: Price parsing round trip**
    - Generate random PriceFormat values with amounts between 100,000 and 10,000,000
    - Format into Australian price strings, parse back, assert equivalence
    - Assert comparison price extraction rules: fixed→amount, range→upper, plus→minimum, offers_over→amount
    - **Validates: Requirements 3.2**

  - [x] 3.3 Implement budget filter
    - Create `src/filters/budget-filter.ts`
    - Implement `filterByBudget()` function comparing parsed prices against maxBudget
    - Separate results into included, excluded, and unparseable categories
    - Exclude listings with unparseable prices
    - _Requirements: 3.1, 3.3_

  - [x] 3.4 Write property test for budget filtering invariant
    - **Property 4: Budget filtering invariant**
    - Generate random PropertyListings with parseable prices and random budget values
    - Assert listing included iff comparison price ≤ maxBudget
    - Assert unparseable prices are always excluded
    - **Validates: Requirements 3.1, 3.3**

- [x] 4. Implement property specification filtering
  - [x] 4.1 Implement property spec filter
    - Create `src/filters/spec-filter.ts`
    - Implement `filterBySpecs()` function applying minBedrooms, minLandSize, and storeyPreference filters
    - Handle optional criteria: no exclusion when filter dimension is undefined
    - Handle storey logic: "single" excludes >1 storey, "double" excludes <2 storeys, "any" includes all
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7_

  - [x] 4.2 Write property test for property specification filtering
    - **Property 5: Property specification filtering**
    - Generate random PropertyListings and random SpecFilterCriteria combinations
    - Assert inclusion iff all active filter conditions are met simultaneously
    - Test with all combinations of defined/undefined optional fields
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.7**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement external service integrations
  - [x] 6.1 Implement geocoding service
    - Create `src/services/geocoder.ts`
    - Implement `geocodeAddress()` function calling Google Maps Geocoding API
    - Handle success/failure responses, return GeoCoordinates or error
    - Implement 10-second timeout
    - _Requirements: 1.4, 4.6_

  - [x] 6.2 Implement listing fetcher
    - Create `src/services/listing-fetcher.ts`
    - Implement `fetchListings()` function calling Domain API
    - Filter to "for_sale" status only
    - Map DomainListingResponse to RawListing type
    - Implement 30-second timeout
    - Cap results at 500 listings
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 6.3 Implement listing completeness validator
    - Create `src/services/listing-validator.ts`
    - Implement function to validate RawListings have all required fields (price, bedrooms, land size, storeys, coordinates)
    - Convert valid RawListings to PropertyListing type, exclude incomplete ones
    - _Requirements: 2.4, 2.5, 5.6_

  - [x] 6.4 Write property test for listing completeness filter
    - **Property 2: Listing completeness filter excludes incomplete listings**
    - Generate random RawListings with various null/missing field combinations
    - Assert listing included iff ALL required fields are present and non-null
    - Assert listing excluded if ANY required field is null or missing
    - **Validates: Requirements 2.4, 2.5, 5.6**

  - [x] 6.5 Implement commute calculator
    - Create `src/services/commute-calculator.ts`
    - Implement `calculateCommuteTimes()` function calling Google Maps Routes API `computeRouteMatrix`
    - Batch origins in groups of 25 per request
    - Set departure time to next weekday 8:00 AM AEST
    - Implement 10-second timeout per route computation
    - Return null duration for failed/timed-out routes
    - _Requirements: 4.1, 4.3, 4.4, 4.5_

  - [x] 6.6 Write property test for commute time filtering invariant
    - **Property 6: Commute time filtering invariant**
    - Generate random CommuteResults with various durations and random maxCommuteMinutes
    - Assert listing included iff duration ≤ maxCommuteMinutes
    - Assert listings with null duration are always excluded
    - **Validates: Requirements 4.2, 4.4**

- [x] 7. Implement shortlist assembly and presentation
  - [x] 7.1 Implement shortlist assembler
    - Create `src/pipeline/shortlist-assembler.ts`
    - Implement `assembleShortlist()` function combining filtered listings with commute times
    - Filter by maxCommuteMinutes
    - Sort by commute time ascending, then price ascending for ties
    - Cap results at 20
    - Compute hasMore flag and totalMatching/totalEvaluated counts
    - Generate suggestedRelaxation hint when zero results
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.7_

  - [x] 7.2 Write property test for shortlist sort invariant
    - **Property 7: Shortlist sort invariant**
    - Generate random arrays of ShortlistedProperty
    - Assert for every adjacent pair: commute[i] < commute[i+1] OR (commute[i] == commute[i+1] AND price[i] ≤ price[i+1])
    - **Validates: Requirements 6.3**

  - [x] 7.3 Write property test for shortlist cap and count accuracy
    - **Property 8: Shortlist cap and count accuracy**
    - Generate random sets of N matching properties (0 ≤ N ≤ 100)
    - Assert result contains min(N, 20) properties
    - Assert hasMore is true iff N > 20
    - Assert totalMatching equals N
    - **Validates: Requirements 6.1, 6.5, 6.7**

- [x] 8. Implement profile persistence
  - [x] 8.1 Implement profile persister
    - Create `src/services/profile-persister.ts`
    - Implement `saveProfile()`, `loadProfile()`, `updateProfileFields()` functions
    - Use local JSON file storage (MVP)
    - Handle file read/write errors gracefully
    - Store lastUpdated timestamp on each save
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 8.2 Write property test for profile persistence round trip
    - **Property 9: Profile persistence round trip**
    - Generate random valid SearchCriteria
    - Save to profile, load back, assert all field values are identical
    - **Validates: Requirements 7.2**

  - [x] 8.3 Write property test for profile partial update
    - **Property 10: Profile partial update preserves unchanged fields**
    - Generate random saved UserProfile and random non-empty subset of fields to update
    - Perform partial update, assert updated fields have new values, unchanged fields retain original values
    - **Validates: Requirements 7.3**

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement pipeline orchestrator and wire components
  - [x] 10.1 Implement pipeline orchestrator
    - Create `src/pipeline/orchestrator.ts`
    - Implement `runSearchPipeline()` function coordinating all stages in sequence
    - Enforce 60-second overall timeout with partial result fallback
    - Track pipeline duration in durationMs
    - Report errors with stage identification
    - Wire stages: validate → geocode → fetch → validate listings → budget filter → spec filter → commute → assemble
    - _Requirements: 1.6, 2.3, 4.7, 6.6_

  - [x] 10.2 Implement result presenter
    - Create `src/pipeline/result-presenter.ts`
    - Format ShortlistResult for display: address, price, bedrooms, land size, storeys, commute time
    - Display total evaluated and total shortlisted counts
    - Handle zero-result case with relaxation suggestion
    - Handle timeout warning for partial results
    - _Requirements: 6.2, 6.4, 6.5_

  - [x] 10.3 Write integration tests for full pipeline
    - Test full pipeline end-to-end with all external services mocked
    - Test pipeline timeout enforcement (simulate slow commute API)
    - Test graceful handling of listing API unavailability
    - Test zero-result scenario produces relaxation suggestion
    - _Requirements: 2.3, 4.7, 6.4, 6.6_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- External service calls (Domain API, Google Maps) should be mocked in all tests
- The pipeline ordering is designed to minimize expensive API calls: cheap local filters run before commute calculation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1", "4.1", "6.1", "6.2", "8.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.2", "3.3", "4.2", "6.3", "6.5", "8.2", "8.3"] },
    { "id": 4, "tasks": ["3.4", "6.4", "6.6", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3"] },
    { "id": 6, "tasks": ["10.1"] },
    { "id": 7, "tasks": ["10.2"] },
    { "id": 8, "tasks": ["10.3"] }
  ]
}
```
