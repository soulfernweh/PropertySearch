/**
 * Downloads weekly NSW Valuer General Property Sales Information (PSI) zip files.
 *
 * The PSI server (www.valuergeneral.nsw.gov.au) sits behind a WAF that blocks
 * Node's TLS fingerprint with HTTP 403. Windows' bundled `curl.exe` is not
 * blocked, so we shell out to it for the actual download.
 *
 * Weekly files are published every Monday at:
 *   https://www.valuergeneral.nsw.gov.au/__psi/weekly/YYYYMMDD.zip
 */

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const WEEKLY_BASE = "https://www.valuergeneral.nsw.gov.au/__psi/weekly/";
const YEARLY_BASE = "https://www.valuergeneral.nsw.gov.au/__psi/yearly/";
const REFERER = "https://valuation.property.nsw.gov.au/embed/propertySalesInformation";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Format a Date as YYYYMMDD. */
function yyyymmdd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Returns the list of Monday dates (as Date objects, UTC) within the
 * inclusive range [from, to].
 */
export function getMondaysInRange(from: Date, to: Date): Date[] {
  const mondays: Date[] = [];
  // Advance `from` to the next Monday (getUTCDay: 0=Sun, 1=Mon)
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
  const offset = (1 - cursor.getUTCDay() + 7) % 7;
  cursor.setUTCDate(cursor.getUTCDate() + offset);

  while (cursor <= to) {
    mondays.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return mondays;
}

export interface DownloadSummary {
  downloaded: string[];
  skipped: string[];   // already present
  missing: string[];   // not available on server (404/403)
}

/**
 * Download a single weekly file with curl. Returns true on success.
 * Uses `-f` so HTTP errors (missing files) fail instead of writing an error body.
 */
function curlDownload(url: string, filepath: string): boolean {
  try {
    execFileSync(
      "curl.exe",
      [
        "-sS",
        "-f",
        "-L",
        "--max-time",
        "120",
        "-H",
        `User-Agent: ${USER_AGENT}`,
        "-H",
        `Referer: ${REFERER}`,
        "-H",
        "Accept: */*",
        "-o",
        filepath,
        url,
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    // Validate it's a real zip (starts with PK)
    const fd = fs.openSync(filepath, "r");
    const buf = Buffer.alloc(2);
    fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
      fs.rmSync(filepath, { force: true });
      return false;
    }
    return true;
  } catch {
    fs.rmSync(filepath, { force: true });
    return false;
  }
}

/**
 * Download all weekly PSI zip files for the given date range into `destDir`.
 * Files already present are skipped. Missing server files are recorded.
 */
export function downloadWeeklyRange(
  from: Date,
  to: Date,
  destDir: string
): DownloadSummary {
  fs.mkdirSync(destDir, { recursive: true });

  const mondays = getMondaysInRange(from, to);
  const summary: DownloadSummary = { downloaded: [], skipped: [], missing: [] };

  for (const monday of mondays) {
    const name = `${yyyymmdd(monday)}.zip`;
    const filepath = path.join(destDir, name);

    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 0) {
      summary.skipped.push(name);
      continue;
    }

    const url = WEEKLY_BASE + name;
    process.stdout.write(`Downloading ${name} ... `);
    const ok = curlDownload(url, filepath);
    if (ok) {
      summary.downloaded.push(name);
      console.log("done");
    } else {
      summary.missing.push(name);
      console.log("not available");
    }
  }

  return summary;
}

/**
 * Download one or more annual PSI zip files (e.g. 2025.zip) into `destDir`.
 * Annual files hold a full calendar year of sales and are used to backfill
 * periods no longer covered by the online weekly files.
 */
export function downloadYearly(years: number[], destDir: string): DownloadSummary {
  fs.mkdirSync(destDir, { recursive: true });
  const summary: DownloadSummary = { downloaded: [], skipped: [], missing: [] };

  for (const year of years) {
    const name = `${year}.zip`;
    const filepath = path.join(destDir, name);

    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 0) {
      summary.skipped.push(name);
      continue;
    }

    const url = YEARLY_BASE + name;
    process.stdout.write(`Downloading annual ${name} (large file) ... `);
    const ok = curlDownload(url, filepath);
    if (ok) {
      summary.downloaded.push(name);
      console.log("done");
    } else {
      summary.missing.push(name);
      console.log("not available");
    }
  }

  return summary;
}
