/**
 * Orchestrates the NSW sold-property data pull:
 *   1. Download the last ~12 months of weekly PSI zips
 *   2. Parse + filter to target postcodes and contract dates
 *   3. Export CSV + JSON
 *
 * Run with: npm run sold-data
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { downloadWeeklyRange, downloadYearly } from "./downloader.js";
import { parseSoldData, type SaleRecord } from "./parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const RAW_DIR = path.join(PROJECT_ROOT, "data", "psi-weekly");
const OUT_DIR = path.join(PROJECT_ROOT, "data", "sold");

/** CSV-escape a value. */
function csvCell(v: string | number | boolean | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(records: SaleRecord[]): string {
  const headers = [
    "contractDate",
    "settlementDate",
    "purchasePrice",
    "address",
    "suburb",
    "postcode",
    "region",
    "inTargetList",
    "areaSqm",
    "zoning",
    "propertyCategory",
    "primaryPurpose",
    "natureOfProperty",
    "propertyId",
    "dealingNumber",
    "legalDescription",
    "sourceFile",
  ];
  const rows = records.map((r) =>
    [
      r.contractDate,
      r.settlementDate,
      r.purchasePrice,
      r.address,
      r.suburb,
      r.postcode,
      r.region,
      r.inTargetList,
      r.areaSqm,
      r.zoning,
      r.propertyCategory,
      r.primaryPurpose,
      r.natureOfProperty,
      r.propertyId,
      r.dealingNumber,
      r.legalDescription,
      r.sourceFile,
    ]
      .map(csvCell)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

function main(): void {
  const now = new Date();
  // Last 12 months, minus a 2-week buffer since weekly files lag slightly.
  const to = now;
  const from = new Date(
    Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate())
  );
  const minContractDate = from.toISOString().slice(0, 10);
  const maxContractDate = to.toISOString().slice(0, 10);

  console.log("=== NSW Sold Property Data Pull ===");
  console.log(`Range: ${from.toISOString().slice(0, 10)} -> ${to.toISOString().slice(0, 10)}`);
  console.log(`Raw download dir: ${RAW_DIR}`);
  console.log("");

  // 1. Download
  console.log("Step 1/3: Downloading PSI files...");
  // Weekly files cover the current year; older weeklies are removed from the
  // server, so annual files backfill the rest of the 12-month window.
  const summary = downloadWeeklyRange(from, to, RAW_DIR);
  console.log(
    `  Weekly: downloaded ${summary.downloaded.length}, cached ${summary.skipped.length}, missing ${summary.missing.length}.`
  );
  // Annual files for each year from the window start up to (but not including)
  // the current year — these are full-year archives that fill the gap left by
  // expired weekly files.
  const backfillYears: number[] = [];
  for (let y = from.getUTCFullYear(); y < to.getUTCFullYear(); y++) {
    backfillYears.push(y);
  }
  if (backfillYears.length > 0) {
    const ySummary = downloadYearly(backfillYears, RAW_DIR);
    console.log(
      `  Annual: downloaded ${ySummary.downloaded.length}, cached ${ySummary.skipped.length}, missing ${ySummary.missing.length}.`
    );
  }
  console.log("");

  // 2. Parse + filter
  console.log("Step 2/3: Parsing and filtering to target postcodes...");
  const records = parseSoldData(RAW_DIR, minContractDate, maxContractDate);
  console.log(`  ${records.length} matching sale records found.`);
  console.log("");

  // 3. Export
  console.log("Step 3/3: Writing output...");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const csvPath = path.join(OUT_DIR, "nsw-sold-last-12-months.csv");
  const jsonPath = path.join(OUT_DIR, "nsw-sold-last-12-months.json");
  fs.writeFileSync(csvPath, toCsv(records), "utf-8");
  fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2), "utf-8");
  console.log(`  CSV:  ${csvPath}`);
  console.log(`  JSON: ${jsonPath}`);
  console.log("");

  // Quick summary by region
  const byRegion = new Map<string, number>();
  for (const r of records) {
    byRegion.set(r.region, (byRegion.get(r.region) ?? 0) + 1);
  }
  console.log("Records by region:");
  for (const [region, count] of [...byRegion.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${region}: ${count}`);
  }
  console.log("");
  console.log("Done.");
}

main();
