/**
 * Quick data-freshness check.
 *
 * Reports the newest sold-data we have locally and checks the NSW PSI server
 * for any newer weekly files that we haven't downloaded yet.
 *
 * Run with: npm run check-data
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { weeklyUrl, toYyyymmdd, remoteFileExists } from "./downloader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const RAW_DIR = path.join(PROJECT_ROOT, "data", "psi-weekly");
const JSON_PATH = path.join(PROJECT_ROOT, "data", "sold", "nsw-sold-last-12-months.json");

/** Parse a YYYYMMDD string into a UTC Date. */
function parseYyyymmdd(s: string): Date {
  return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
}

function newestLocalWeekly(): string | null {
  if (!fs.existsSync(RAW_DIR)) return null;
  const weeks = fs
    .readdirSync(RAW_DIR)
    .filter((f) => /^\d{8}\.zip$/.test(f))
    .map((f) => f.slice(0, 8))
    .sort();
  return weeks.length ? weeks[weeks.length - 1] : null;
}

function latestContractDate(): string | null {
  if (!fs.existsSync(JSON_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8")) as { contractDate: string | null }[];
    const dates = data.map((r) => r.contractDate).filter(Boolean).sort() as string[];
    return dates.length ? dates[dates.length - 1] : null;
  } catch {
    return null;
  }
}

function main(): void {
  console.log("=== NSW Sold Data — freshness check ===\n");

  const newest = newestLocalWeekly();
  const latestSale = latestContractDate();

  if (!newest) {
    console.log("No local weekly data found. Run `npm run sold-data` to fetch it.");
    return;
  }

  console.log(`Newest weekly file downloaded: ${newest}.zip`);
  if (latestSale) console.log(`Latest sale contract date:     ${latestSale}`);
  console.log("");

  // Check the server for newer Mondays, from newest+7 up to today.
  const today = new Date();
  const cursor = parseYyyymmdd(newest);
  cursor.setUTCDate(cursor.getUTCDate() + 7);

  const available: string[] = [];
  let checked = 0;
  while (cursor <= today) {
    checked++;
    const stamp = toYyyymmdd(cursor);
    const exists = remoteFileExists(weeklyUrl(stamp));
    console.log(`  ${stamp}.zip -> ${exists ? "AVAILABLE" : "not yet published"}`);
    if (exists) available.push(`${stamp}.zip`);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  console.log("");
  if (checked === 0) {
    console.log("No new weekly slots since the last download — local data is current.");
  } else if (available.length > 0) {
    console.log(`${available.length} newer file(s) available: ${available.join(", ")}`);
    console.log("Run `npm run sold-data` to pull them in.");
  } else {
    console.log("No newer weekly files on the server yet — local data is current.");
  }
}

main();
