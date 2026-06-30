/**
 * External API response types for the Property Search Shortlist system.
 */

// --- Domain API ---

/** Domain API listing response shape */
export interface DomainListingResponse {
  id: number;
  listing: {
    listingType: string;
    propertyDetails: {
      displayableAddress: string;
      suburb: string;
      state: string;
      bedrooms: number;
      landArea: number;
      buildingArea: number;
      features: string[];
      latitude: number;
      longitude: number;
    };
    priceDetails: {
      displayPrice: string;
      price: number | null;
    };
    dateListed: string;
    listingSlug: string;
  };
}

// --- Google Maps Routes API ---

/** Google Maps Routes API computeRouteMatrix response element */
export interface RoutesMatrixResponse {
  originIndex: number;
  destinationIndex: number;
  status: { code: number };
  duration: string;    // e.g., "1800s"
  condition: string;
}

// --- Google Maps Geocoding API ---

/** Google Maps Geocoding API response */
export interface GeocodingResponse {
  results: Array<{
    geometry: {
      location: { lat: number; lng: number };
    };
    formatted_address: string;
  }>;
  status: string;
}
