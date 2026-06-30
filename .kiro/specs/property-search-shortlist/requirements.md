# Requirements Document

## Introduction

Property Search Shortlist is a tool that eliminates decision paralysis for first-time home buyers in Australia by computing a curated shortlist of properties matching all user-specified criteria. Instead of browsing 1000+ listings across multiple tools, users provide their budget, work address, and basic property preferences — the system returns only the properties that satisfy every constraint simultaneously.

The MVP focuses on three core filters: budget (price), commute time (to a specified work address), and basic property specifications (bedrooms, land size, storeys). The initial market is Melbourne and Sydney.

## Glossary

- **Shortlist_Engine**: The core system component that fetches property listings, applies user-defined filters, and produces a curated shortlist of matching properties.
- **User_Profile**: A stored set of search criteria provided by the user including budget, work address, commute preferences, and property specifications.
- **Listing_Source**: External property listing data providers (Domain API, REA) that supply current property listings for the target market.
- **Commute_Calculator**: The component responsible for computing travel time between a property location and the user's specified work address using transit or driving modes.
- **Property_Listing**: A single property record containing address, price, bedrooms, land size, storeys, and geographic coordinates.
- **Search_Criteria**: The complete set of filters a user specifies: maximum budget, maximum commute time, transport mode, minimum bedrooms, minimum land size, and storey preference.
- **Commute_Mode**: The transport method used for commute calculation — either "public_transport" or "car".
- **Storey_Preference**: The user's preference for property storeys — "single", "double", or "any".

## Requirements

### Requirement 1: User Search Criteria Input

**User Story:** As a first-time home buyer, I want to specify my budget, work address, and property preferences in a single step, so that I can quickly define what I'm looking for without navigating multiple forms.

#### Acceptance Criteria

1. THE Shortlist_Engine SHALL accept Search_Criteria containing: maximum budget (AUD, integer between 100,000 and 10,000,000 inclusive), work address (street address string), maximum commute time (integer between 5 and 120 minutes inclusive), Commute_Mode (one of: "driving", "public_transport", "cycling", "walking"), minimum bedrooms (integer between 1 and 6 inclusive), minimum land size (number between 0 and 2000 square metres inclusive), and Storey_Preference (one of: "single", "double", "any").
2. WHEN Search_Criteria is submitted with a maximum budget below $100,000 or above $10,000,000, THE Shortlist_Engine SHALL reject the request and return a validation error indicating the budget is outside the supported range.
3. WHEN Search_Criteria is submitted with a maximum commute time below 5 minutes or exceeding 120 minutes, THE Shortlist_Engine SHALL reject the request and return a validation error indicating the commute time is outside the supported range.
4. WHEN Search_Criteria is submitted with a work address that cannot be geocoded, THE Shortlist_Engine SHALL return a validation error indicating the address could not be resolved.
5. IF Search_Criteria is submitted with missing required fields (maximum budget, work address, maximum commute time, and Commute_Mode are required; minimum bedrooms, minimum land size, and Storey_Preference are optional), THEN THE Shortlist_Engine SHALL return a validation error listing each missing required field.
6. WHEN Search_Criteria passes all validations, THE Shortlist_Engine SHALL display a confirmation indicator within 2 seconds acknowledging the criteria were accepted.

### Requirement 2: Property Listing Retrieval

**User Story:** As a first-time home buyer, I want the system to fetch current property listings from the Australian market, so that my shortlist reflects properties actually available for sale right now.

#### Acceptance Criteria

1. WHEN a valid Search_Criteria is submitted, THE Shortlist_Engine SHALL retrieve Property_Listings from at least one Listing_Source covering the Melbourne or Sydney metropolitan area, returning no more than 500 listings per request.
2. WHEN retrieving Property_Listings, THE Shortlist_Engine SHALL retrieve only properties listed as "for sale" (excluding sold, withdrawn, or off-market listings) and listed or updated within the last 48 hours.
3. IF the Listing_Source is unavailable or returns an error, THEN THE Shortlist_Engine SHALL return a service unavailability error to the user within 30 seconds of the original request.
4. WHEN Property_Listings are retrieved, THE Shortlist_Engine SHALL include for each listing: address, listed price or price guide, number of bedrooms, land size, number of storeys, and geographic coordinates (latitude and longitude).
5. IF a retrieved Property_Listing is missing any of the required fields (listed price or price guide, number of bedrooms, land size, number of storeys, or geographic coordinates), THEN THE Shortlist_Engine SHALL exclude that listing from the results returned to the user.

### Requirement 3: Budget Filtering

**User Story:** As a first-time home buyer, I want to see only properties within my budget, so that I don't waste time evaluating homes I cannot afford.

#### Acceptance Criteria

1. WHEN filtering Property_Listings, THE Shortlist_Engine SHALL exclude any Property_Listing with a listed price strictly exceeding the user's maximum budget, and SHALL include any Property_Listing with a listed price equal to or below the user's maximum budget.
2. WHEN a Property_Listing displays a price range (e.g., "$650,000 - $700,000"), THE Shortlist_Engine SHALL use the upper bound of the range for budget comparison. WHEN a Property_Listing displays a "plus" format (e.g., "$700,000+"), THE Shortlist_Engine SHALL use the stated amount as the minimum price for budget comparison and SHALL exclude the listing if that minimum amount exceeds the user's maximum budget. WHEN a Property_Listing displays an "offers over" format (e.g., "Offers over $600,000"), THE Shortlist_Engine SHALL use the stated amount for budget comparison.
3. WHEN a Property_Listing has no listed price ("Contact Agent") or a price that cannot be parsed into a numeric value, THE Shortlist_Engine SHALL exclude the Property_Listing from the shortlist.
4. IF the user has not set a maximum budget, THEN THE Shortlist_Engine SHALL not apply budget filtering and SHALL include all Property_Listings regardless of price.

### Requirement 4: Commute Time Filtering

**User Story:** As a first-time home buyer, I want to see only properties within my acceptable commute time to work, so that I can ensure a manageable daily travel commitment.

#### Acceptance Criteria

1. WHEN filtering Property_Listings, THE Shortlist_Engine SHALL compute commute time from each Property_Listing's geographic coordinates to the user's work address using the specified Commute_Mode, where Commute_Mode is one of: "driving", "public_transport", "cycling", or "walking".
2. IF the computed commute time for a Property_Listing exceeds the user's maximum commute time (configurable between 5 and 120 minutes inclusive), THEN THE Shortlist_Engine SHALL exclude that Property_Listing from the shortlist.
3. THE Commute_Calculator SHALL compute commute times using the worst-case travel duration for a weekday morning departure between 7:00 AM and 9:00 AM AEST.
4. IF the Commute_Calculator cannot determine a route for a Property_Listing within 10 seconds, THEN THE Shortlist_Engine SHALL exclude that Property_Listing from the shortlist.
5. WHEN Commute_Mode is "public_transport", THE Commute_Calculator SHALL include walking time to and from transit stops (up to a maximum of 15 minutes walking per leg) in the total commute time.
6. IF the user's work address cannot be resolved to geographic coordinates, THEN THE Shortlist_Engine SHALL not proceed with filtering and SHALL return an error indication specifying that the work address is invalid.
7. IF the external routing service is unavailable for all route computations, THEN THE Shortlist_Engine SHALL not proceed with filtering and SHALL return an error indication specifying that commute calculation is temporarily unavailable.

### Requirement 5: Property Specification Filtering

**User Story:** As a first-time home buyer, I want to filter properties by bedrooms, land size, and storeys, so that only homes meeting my household's physical space requirements appear in my shortlist.

#### Acceptance Criteria

1. WHEN filtering Property_Listings, THE Shortlist_Engine SHALL exclude any Property_Listing with fewer bedrooms than the user's specified minimum, where the minimum bedroom value is an integer between 1 and 6 inclusive.
2. WHEN filtering Property_Listings, THE Shortlist_Engine SHALL exclude any Property_Listing with a land size in square metres smaller than the user's specified minimum land size, where the minimum land size value is a number between 0 and 2000 inclusive.
3. WHEN Storey_Preference is "single", THE Shortlist_Engine SHALL exclude Property_Listings with more than one storey.
4. WHEN Storey_Preference is "double", THE Shortlist_Engine SHALL exclude Property_Listings with fewer than two storeys.
5. WHEN Storey_Preference is "any", THE Shortlist_Engine SHALL include Property_Listings regardless of storey count.
6. IF a Property_Listing is missing bedroom count, land size, or storey count data, THEN THE Shortlist_Engine SHALL exclude that Property_Listing from the shortlist.
7. IF the user has not specified a minimum for a given filter dimension (bedrooms or land size) or has not set a Storey_Preference, THEN THE Shortlist_Engine SHALL apply no exclusion for that dimension, including all Property_Listings for that dimension.

### Requirement 6: Shortlist Generation and Presentation

**User Story:** As a first-time home buyer, I want to receive a concise shortlist of properties that match ALL my criteria, so that I can focus my limited weekend inspection time on genuinely viable options.

#### Acceptance Criteria

1. WHEN all filters have been applied, THE Shortlist_Engine SHALL return the set of Property_Listings that satisfy every criterion in the user's Search_Criteria simultaneously, up to a maximum of 20 properties.
2. THE Shortlist_Engine SHALL present each shortlisted Property_Listing with: address, listed price (AUD), number of bedrooms, land size (square metres), storey count, and computed commute time (minutes).
3. THE Shortlist_Engine SHALL sort the shortlist by computed commute time in ascending order, with ties broken by listed price in ascending order.
4. WHEN the shortlist contains zero properties, THE Shortlist_Engine SHALL inform the user that no properties match all criteria and identify at least one specific filter that, if relaxed, would increase results.
5. THE Shortlist_Engine SHALL display the total number of properties evaluated and the number of properties in the final shortlist.
6. THE Shortlist_Engine SHALL complete the full search-and-filter pipeline and return results within 60 seconds of receiving valid Search_Criteria.
7. IF the number of matching properties exceeds 20, THEN THE Shortlist_Engine SHALL return the top 20 results according to the sort order defined in criterion 3 and indicate to the user that additional matches exist beyond the displayed set.

### Requirement 7: Search Criteria Persistence

**User Story:** As a first-time home buyer, I want my search criteria to be saved so that I can re-run the search later without re-entering all my preferences.

#### Acceptance Criteria

1. WHEN a user submits valid Search_Criteria, THE Shortlist_Engine SHALL persist the Search_Criteria in the User_Profile and display a confirmation indicator within 2 seconds acknowledging the save was successful.
2. WHEN a user navigates to the search page after authenticating in a new session, THE Shortlist_Engine SHALL pre-populate the search form with the most recently saved Search_Criteria from the User_Profile.
3. WHEN a user modifies one or more fields within a saved Search_Criteria and submits the update, THE Shortlist_Engine SHALL persist only the changed fields while retaining all other previously saved field values.
4. IF the Shortlist_Engine fails to persist Search_Criteria due to a storage or network error, THEN THE Shortlist_Engine SHALL display an error indication to the user stating the save did not succeed and SHALL retain the entered criteria in the current session so the user can retry without re-entering data.

---

## Future Considerations (Phase 2+)

The following enrichments are planned for subsequent phases and are NOT in scope for MVP:

- School ratings within a configurable radius
- Daycare proximity filtering
- Gas vs electric cooktop preference
- Solar panel presence
- Pool presence
- Road frontage classification
- Previous sale history and flip detection (via Valuer General data)
- Multi-city expansion beyond Melbourne/Sydney
