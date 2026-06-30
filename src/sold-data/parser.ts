/**
 * Parses NSW Valuer General PSI .DAT files out of weekly zip archives and
 * filters records to the target postcodes.
 *
 * Current data format (2001+): semicolon-delimited records, one record-type
 * per line. We care about "B" records (sale detail) and "C" records
 * (legal description, matched back to the B record by key).
 *
 * B record field layout (index : meaning):
 *   1 District code   2 Property ID    3 Sale counter   4 Download datetime
 *   5 Property name   6 Unit number    7 House number   8 Street name
 *   9 Locality       10 Post code     11 Area          12 Area type
 *  13 Contract date  14 Settlement    15 Purchase price 16 Zoning
 *  17 Nature of prop 18 Primary purpose 19 Strata lot   23 Dealing number
 */

import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import { TARGET_POSTCODES, resolveRegion, isTargetSuburb } from "./target-areas.js";

/** Land area (sqm) at or above which a House/Vacant-Land sale is treated as
 *  "Acreage" (≈1 acre = 4046.86 sqm). Acreage is separated because its very
 *  low $/sqm and high absolute price skew suburb-level medians. */
export const ACREAGE_THRESHOLD_SQM = 4000;

export interface SaleRecord {
  propertyId: string;
  councilDistrict: string;
  suburb: string;
  postcode: string;
  region: string;
  /** True if the suburb is one of the user's explicitly listed target suburbs;
   *  false for neighbouring suburbs that merely share a target postcode. */
  inTargetList: boolean;
  unitNumber: string;
  houseNumber: string;
  streetName: string;
  address: string;
  areaSqm: number | null;
  contractDate: string | null;   // ISO yyyy-mm-dd
  settlementDate: string | null; // ISO yyyy-mm-dd
  purchasePrice: number | null;
  zoning: string;
  natureOfProperty: string;
  primaryPurpose: string;
  /** Derived high-level category: House, Unit, Vacant Land, Acreage, or other. */
  propertyCategory: string;
  strataLotNumber: string;
  dealingNumber: string;
  legalDescription: string;
  sourceFile: string;
}

/** Parse a CCYYMMDD string into ISO yyyy-mm-dd, or null. */
function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Derive a high-level property category from the VG "nature of property" code,
 * primary purpose, strata/unit indicators, and land size.
 *
 *   - "Vacant Land": nature V or purpose mentions vacant (new blocks).
 *   - "Unit": a residence in a strata scheme (has a strata lot or unit number)
 *     — i.e. apartment / townhouse / villa.
 *   - "House": a standalone (Torrens-title) residence with its own land.
 *   - "Acreage": a House or Vacant-Land parcel at/above the acreage threshold
 *     (≈1 acre+). Separated because it skews suburb $/sqm and price medians.
 *   - otherwise the primary purpose (Commercial, Warehouse, ...) or "Other".
 */
function deriveCategory(
  natureOfProperty: string,
  primaryPurpose: string,
  strataLotNumber: string,
  unitNumber: string,
  areaSqm: number | null
): string {
  const nature = natureOfProperty.trim().toUpperCase();
  const purpose = primaryPurpose.trim();

  const isVacant = nature === "V" || /vacant/i.test(purpose);
  const isResidence = nature === "R";
  const isStrata =
    strataLotNumber.trim().length > 0 || unitNumber.trim().length > 0;

  // Large land parcels (House or Vacant Land) are reclassified as Acreage.
  const isLargeLand = areaSqm != null && areaSqm >= ACREAGE_THRESHOLD_SQM;

  if (isVacant) {
    return isLargeLand ? "Acreage" : "Vacant Land";
  }
  if (isResidence) {
    if (isStrata) return "Unit"; // strata has no individual land; never acreage
    return isLargeLand ? "Acreage" : "House";
  }
  if (purpose) return purpose;
  return "Other";
}

/** Extract all .DAT text contents from a zip (handles nested zips). */
function readDatFromZip(zipPath: string): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  const zip = new AdmZip(zipPath);
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const lower = entry.entryName.toLowerCase();
    if (lower.endsWith(".dat")) {
      out.push({ name: entry.entryName, text: entry.getData().toString("utf-8") });
    } else if (lower.endsWith(".zip")) {
      // Nested zip (older archive format)
      try {
        const inner = new AdmZip(entry.getData());
        for (const innerEntry of inner.getEntries()) {
          if (innerEntry.entryName.toLowerCase().endsWith(".dat")) {
            out.push({
              name: `${entry.entryName}/${innerEntry.entryName}`,
              text: innerEntry.getData().toString("utf-8"),
            });
          }
        }
      } catch {
        // ignore corrupt nested zip
      }
    }
  }
  return out;
}

/**
 * Parse the lines of one or more .DAT files into filtered SaleRecords.
 * Only records whose postcode is in TARGET_POSTCODES are returned.
 */
function parseLines(
  lines: string[],
  sourceFile: string,
  legalDescByKey: Map<string, string>
): SaleRecord[] {
  const records: SaleRecord[] = [];

  for (const line of lines) {
    if (!line.startsWith("B;")) continue;
    const p = line.split(";").map((x) => x.trim());
    if (p.length < 19) continue;

    const postcode = p[10];
    if (!TARGET_POSTCODES.has(postcode)) continue;

    const suburb = toTitleCase(p[9]);
    const unitNumber = p[6];
    const houseNumber = p[7];
    const streetName = toTitleCase(p[8]);
    const addressParts = [
      unitNumber ? `${unitNumber}/` : "",
      houseNumber,
      streetName,
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const address = `${addressParts}, ${suburb} NSW ${postcode}`.trim();

    const area = parseFloat(p[11]);
    const areaType = p[12];
    const areaSqm =
      Number.isFinite(area) ? (areaType === "H" ? area * 10000 : area) : null;

    const price = parseInt(p[15], 10);
    const key = `${p[1]}|${p[2]}|${p[3]}`;

    records.push({
      propertyId: p[2],
      councilDistrict: p[1],
      suburb,
      postcode,
      region: resolveRegion(p[9], postcode),
      inTargetList: isTargetSuburb(p[9]),
      unitNumber,
      houseNumber,
      streetName,
      address,
      areaSqm,
      contractDate: parseDate(p[13]),
      settlementDate: parseDate(p[14]),
      purchasePrice: Number.isFinite(price) ? price : null,
      zoning: p[16] ?? "",
      natureOfProperty: p[17] ?? "",
      primaryPurpose: toTitleCase(p[18] ?? ""),
      propertyCategory: deriveCategory(
        p[17] ?? "",
        toTitleCase(p[18] ?? ""),
        p[19] ?? "",
        unitNumber,
        areaSqm
      ),
      strataLotNumber: p[19] ?? "",
      dealingNumber: p[23] ?? "",
      legalDescription: legalDescByKey.get(key) ?? "",
      sourceFile,
    });
  }

  return records;
}

/** Build a map of legal descriptions from C records, keyed by district|propId|saleCounter. */
function collectLegalDescriptions(lines: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const line of lines) {
    if (!line.startsWith("C;")) continue;
    const p = line.split(";").map((x) => x.trim());
    if (p.length >= 6) {
      m.set(`${p[1]}|${p[2]}|${p[3]}`, p[5]);
    }
  }
  return m;
}

/**
 * Parse every zip in `dataDir` and return SaleRecords filtered to the target
 * postcodes. Optionally filter by a minimum contract date (ISO yyyy-mm-dd).
 */
export function parseSoldData(
  dataDir: string,
  minContractDate?: string,
  maxContractDate?: string
): SaleRecord[] {
  const zipFiles = fs
    .readdirSync(dataDir)
    .filter((f) => f.toLowerCase().endsWith(".zip"))
    .sort();

  const all: SaleRecord[] = [];

  for (const file of zipFiles) {
    const zipPath = path.join(dataDir, file);
    let dats: { name: string; text: string }[];
    try {
      dats = readDatFromZip(zipPath);
    } catch {
      console.warn(`Skipping unreadable zip: ${file}`);
      continue;
    }

    for (const dat of dats) {
      const lines = dat.text.split(/\r?\n/);
      const legalMap = collectLegalDescriptions(lines);
      const records = parseLines(lines, file, legalMap);
      all.push(...records);
    }
  }

  // De-duplicate by propertyId|saleCounter-ish key (dealing number + price + date)
  const seen = new Set<string>();
  const deduped: SaleRecord[] = [];
  for (const r of all) {
    const key = `${r.propertyId}|${r.dealingNumber}|${r.contractDate}|${r.purchasePrice}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  let result = deduped;
  if (minContractDate) {
    result = result.filter(
      (r) => r.contractDate !== null && r.contractDate >= minContractDate
    );
  }
  if (maxContractDate) {
    result = result.filter(
      (r) => r.contractDate !== null && r.contractDate <= maxContractDate
    );
  }

  // Sort by contract date descending (most recent first)
  result.sort((a, b) => (b.contractDate ?? "").localeCompare(a.contractDate ?? ""));

  return result;
}
