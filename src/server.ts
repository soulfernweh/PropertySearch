/**
 * Express web server — serves the property search UI and API.
 */

import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { runSearchPipeline } from "./pipeline/orchestrator.js";
import type { SearchCriteria } from "./types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// --- Sold-property data endpoint (cached in memory) ---
const SOLD_DATA_PATH = path.join(
  __dirname,
  "..",
  "data",
  "sold",
  "nsw-sold-last-12-months.json"
);
let soldDataCache: string | null = null;

app.get("/api/sold-data", (_req, res) => {
  try {
    if (soldDataCache === null) {
      if (!fs.existsSync(SOLD_DATA_PATH)) {
        res.status(404).json({
          error:
            "Sold data not found. Run `npm run sold-data` to generate it first.",
        });
        return;
      }
      soldDataCache = fs.readFileSync(SOLD_DATA_PATH, "utf-8");
    }
    res.type("application/json").send(soldDataCache);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load data";
    res.status(500).json({ error: message });
  }
});

// API endpoint — run the property search pipeline
app.post("/api/search", async (req, res) => {
  try {
    const body = req.body;

    const criteria: SearchCriteria = {
      maxBudget: Number(body.maxBudget),
      workAddress: body.workAddress,
      maxCommuteMinutes: Number(body.maxCommuteMinutes),
      commuteMode: body.commuteMode,
      minBedrooms: body.minBedrooms ? Number(body.minBedrooms) : undefined,
      minLandSize: body.minLandSize ? Number(body.minLandSize) : undefined,
      storeyPreference: body.storeyPreference || undefined,
    };

    const result = await runSearchPipeline(criteria);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error?.message || "Search failed",
        stage: result.error?.stage,
        durationMs: result.durationMs,
      });
      return;
    }

    res.json({
      success: true,
      shortlist: result.shortlist,
      durationMs: result.durationMs,
      timedOut: result.timedOut || false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ success: false, error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Property Search running at http://localhost:${PORT}`);
});
