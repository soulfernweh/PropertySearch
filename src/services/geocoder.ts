/**
 * Geocoding service — converts street addresses to geographic coordinates
 * using the Google Maps Geocoding API.
 */

import axios from "axios";
import type { GeoCoordinates } from "../types/index.js";
import type { GeocodingResponse } from "../types/api.js";

/** Result of a geocoding operation */
export interface GeocodeResult {
  success: boolean;
  coordinates?: GeoCoordinates;
  formattedAddress?: string;
  error?: string;
}

const GEOCODING_API_URL =
  "https://maps.googleapis.com/maps/api/geocode/json";
const TIMEOUT_MS = 10_000;

/**
 * Geocode a street address into geographic coordinates.
 *
 * Calls the Google Maps Geocoding API with a 10-second timeout.
 * Returns coordinates and the formatted address on success,
 * or an error description on failure.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "GOOGLE_MAPS_API_KEY environment variable is not set",
    };
  }

  if (!address || address.trim().length === 0) {
    return {
      success: false,
      error: "Address must be a non-empty string",
    };
  }

  try {
    const response = await axios.get<GeocodingResponse>(GEOCODING_API_URL, {
      params: {
        address: address.trim(),
        key: apiKey,
      },
      timeout: TIMEOUT_MS,
    });

    const { data } = response;

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      return {
        success: false,
        error: `Geocoding failed: ${data.status || "no results returned"}`,
      };
    }

    const firstResult = data.results[0];
    const { lat, lng } = firstResult.geometry.location;

    return {
      success: true,
      coordinates: {
        latitude: lat,
        longitude: lng,
      },
      formattedAddress: firstResult.formatted_address,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return {
          success: false,
          error: "Geocoding request timed out after 10 seconds",
        };
      }
      return {
        success: false,
        error: `Geocoding request failed: ${error.message}`,
      };
    }

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      error: `Geocoding request failed: ${message}`,
    };
  }
}
