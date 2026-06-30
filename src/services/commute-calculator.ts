/**
 * Commute Calculator — computes travel times from property locations to a
 * work address using the Google Maps Routes API `computeRouteMatrix`.
 *
 * Requirements: 4.1, 4.3, 4.4, 4.5
 */

import axios from "axios";
import type { GeoCoordinates, CommuteMode } from "../types/index.js";
import type { RoutesMatrixResponse } from "../types/api.js";

/** Result of a commute time calculation for a single property */
export interface CommuteResult {
  propertyId: string;
  durationMinutes: number | null; // null if route not found within timeout
  mode: CommuteMode;
}

const ROUTES_API_URL =
  "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
const BATCH_SIZE = 25;
const TIMEOUT_MS = 10_000;

/** AEST is UTC+10 */
const AEST_OFFSET_HOURS = 10;

/**
 * Maps our CommuteMode to the Google Routes API travel mode values.
 */
function toGoogleTravelMode(mode: CommuteMode): string {
  switch (mode) {
    case "driving":
      return "DRIVE";
    case "public_transport":
      return "TRANSIT";
    case "cycling":
      return "BICYCLE";
    case "walking":
      return "WALK";
  }
}

/**
 * Computes the next weekday 8:00 AM AEST departure time as an ISO string.
 *
 * If today is already a weekday and it's before 8 AM AEST, uses today.
 * Otherwise, finds the next weekday (Mon–Fri).
 */
export function getNextWeekdayDepartureTime(now?: Date): string {
  const current = now ?? new Date();

  // Create a date in AEST by calculating the AEST time from UTC
  const utcMs = current.getTime();
  const aestMs = utcMs + AEST_OFFSET_HOURS * 60 * 60 * 1000;
  const aestDate = new Date(aestMs);

  // Start with tomorrow in AEST to ensure a future departure
  let candidate = new Date(
    Date.UTC(
      aestDate.getUTCFullYear(),
      aestDate.getUTCMonth(),
      aestDate.getUTCDate() + 1,
      8 - AEST_OFFSET_HOURS, // 8 AM AEST = 22:00 UTC previous day (subtract offset)
      0,
      0
    )
  );

  // Adjust: 8 AM AEST in UTC is (8 - 10) = -2, i.e. 22:00 UTC the day before
  // So set to same day at 22:00 UTC day before
  candidate = new Date(
    Date.UTC(
      aestDate.getUTCFullYear(),
      aestDate.getUTCMonth(),
      aestDate.getUTCDate(),
      0,
      0,
      0
    )
  );

  // Set to 8:00 AM AEST — which is 22:00 UTC the previous day
  // Actually: 8:00 AEST = 8 - 10 = -2 hours UTC = 22:00 UTC previous day
  // Let's use a simpler approach: find next weekday, then set the time

  // Find the next weekday starting from tomorrow (AEST perspective)
  const tomorrow = new Date(aestDate);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  let dayCandidate = tomorrow;
  // getUTCDay: 0=Sun, 6=Sat
  while (dayCandidate.getUTCDay() === 0 || dayCandidate.getUTCDay() === 6) {
    dayCandidate.setUTCDate(dayCandidate.getUTCDate() + 1);
  }

  // Now build the departure time: that day at 8:00 AM AEST
  // 8:00 AM AEST = previous day 22:00 UTC
  const departureUtc = new Date(
    Date.UTC(
      dayCandidate.getUTCFullYear(),
      dayCandidate.getUTCMonth(),
      dayCandidate.getUTCDate() - 1,
      22,
      0,
      0
    )
  );

  return departureUtc.toISOString();
}

/**
 * Builds the request body for the Google Maps Routes API computeRouteMatrix.
 */
function buildRequestBody(
  origins: { id: string; coordinates: GeoCoordinates }[],
  destination: GeoCoordinates,
  mode: CommuteMode,
  departureTime: string
) {
  return {
    origins: origins.map((origin) => ({
      waypoint: {
        location: {
          latLng: {
            latitude: origin.coordinates.latitude,
            longitude: origin.coordinates.longitude,
          },
        },
      },
    })),
    destinations: [
      {
        waypoint: {
          location: {
            latLng: {
              latitude: destination.latitude,
              longitude: destination.longitude,
            },
          },
        },
      },
    ],
    travelMode: toGoogleTravelMode(mode),
    departureTime,
  };
}

/**
 * Parses a Google Routes API duration string (e.g., "1800s") into minutes.
 * Returns null if the string cannot be parsed.
 */
function parseDurationToMinutes(duration: string | undefined | null): number | null {
  if (!duration) return null;
  const match = duration.match(/^(\d+)s$/);
  if (!match) return null;
  return Math.round(parseInt(match[1], 10) / 60);
}

/**
 * Calculates commute times from multiple properties to a single destination.
 *
 * Uses Google Maps Routes API `computeRouteMatrix` for batch calculations.
 * - Batches origins in groups of 25 per request
 * - Sets departure time to next weekday 8:00 AM AEST
 * - 10-second timeout per route computation
 * - Returns null duration for failed/timed-out routes
 */
export async function calculateCommuteTimes(
  properties: { id: string; coordinates: GeoCoordinates }[],
  destination: GeoCoordinates,
  mode: CommuteMode
): Promise<CommuteResult[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    // Return null durations for all properties when API key is missing
    return properties.map((p) => ({
      propertyId: p.id,
      durationMinutes: null,
      mode,
    }));
  }

  if (properties.length === 0) {
    return [];
  }

  const departureTime = getNextWeekdayDepartureTime();
  const results: CommuteResult[] = [];

  // Process properties in batches of 25
  for (let i = 0; i < properties.length; i += BATCH_SIZE) {
    const batch = properties.slice(i, i + BATCH_SIZE);
    const batchResults = await processBatch(batch, destination, mode, departureTime, apiKey);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Processes a single batch of up to 25 property origins against the Routes API.
 */
async function processBatch(
  batch: { id: string; coordinates: GeoCoordinates }[],
  destination: GeoCoordinates,
  mode: CommuteMode,
  departureTime: string,
  apiKey: string
): Promise<CommuteResult[]> {
  const requestBody = buildRequestBody(batch, destination, mode, departureTime);

  try {
    const response = await axios.post<RoutesMatrixResponse[]>(
      ROUTES_API_URL,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "originIndex,destinationIndex,status,duration,condition",
        },
        timeout: TIMEOUT_MS,
      }
    );

    const matrixElements = response.data;

    // Map each origin in the batch to its commute result
    return batch.map((property, index) => {
      const element = matrixElements.find(
        (el) => el.originIndex === index && el.destinationIndex === 0
      );

      if (!element || element.status?.code !== 0) {
        return {
          propertyId: property.id,
          durationMinutes: null,
          mode,
        };
      }

      const minutes = parseDurationToMinutes(element.duration);
      return {
        propertyId: property.id,
        durationMinutes: minutes,
        mode,
      };
    });
  } catch {
    // On timeout or any error, return null durations for the entire batch
    return batch.map((property) => ({
      propertyId: property.id,
      durationMinutes: null,
      mode,
    }));
  }
}
