// Property Search — Frontend Logic

const form = document.getElementById("search-form");
const submitBtn = document.getElementById("submit-btn");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const resultsEl = document.getElementById("results");
const resultsListEl = document.getElementById("results-list");
const resultsMetaEl = document.getElementById("results-meta");
const relaxationEl = document.getElementById("relaxation");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Gather form data
  const formData = new FormData(form);
  const payload = {
    workAddress: formData.get("workAddress"),
    maxBudget: formData.get("maxBudget"),
    maxCommuteMinutes: formData.get("maxCommuteMinutes"),
    commuteMode: formData.get("commuteMode"),
    minBedrooms: formData.get("minBedrooms") || undefined,
    minLandSize: formData.get("minLandSize") || undefined,
    storeyPreference: formData.get("storeyPreference") || undefined,
  };

  // UI state: loading
  submitBtn.disabled = true;
  submitBtn.textContent = "Searching...";
  loadingEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
  resultsEl.classList.add("hidden");
  relaxationEl.classList.add("hidden");

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.success) {
      showError(data.error || "Search failed. Please check your inputs.");
      return;
    }

    displayResults(data);
  } catch (err) {
    showError("Unable to connect to server. Is it running?");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Search Properties";
    loadingEl.classList.add("hidden");
  }
});

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function displayResults(data) {
  const { shortlist, durationMs, timedOut } = data;
  const { properties, totalEvaluated, totalMatching, hasMore, suggestedRelaxation } = shortlist;

  // Meta info
  let meta = `${totalMatching} match${totalMatching !== 1 ? "es" : ""} from ${totalEvaluated} evaluated`;
  if (durationMs) {
    meta += ` · ${(durationMs / 1000).toFixed(1)}s`;
  }
  if (timedOut) {
    meta += " ⚠️ (partial — timed out)";
  }
  if (hasMore) {
    meta += ` · Showing top ${properties.length}`;
  }
  resultsMetaEl.textContent = meta;

  // Property cards
  resultsListEl.innerHTML = "";

  if (properties.length === 0) {
    resultsListEl.innerHTML = `<p style="color:#6b7280;text-align:center;padding:2rem;">No properties matched your criteria.</p>`;
  } else {
    for (const prop of properties) {
      resultsListEl.appendChild(createPropertyCard(prop));
    }
  }

  // Relaxation suggestion
  if (suggestedRelaxation) {
    relaxationEl.textContent = "💡 " + suggestedRelaxation;
    relaxationEl.classList.remove("hidden");
  } else {
    relaxationEl.classList.add("hidden");
  }

  resultsEl.classList.remove("hidden");
}

function createPropertyCard(prop) {
  const card = document.createElement("div");
  card.className = "property-card";

  const storeyLabel = prop.storeys === 1 ? "Single storey" : `${prop.storeys} storeys`;

  card.innerHTML = `
    <div class="card-header">
      <span class="address">${escapeHtml(prop.address)}</span>
      <span class="price">${escapeHtml(prop.priceText)}</span>
    </div>
    <div class="details">
      <span>🛏️ ${prop.bedrooms} bed${prop.bedrooms !== 1 ? "s" : ""}</span>
      <span>📐 ${prop.landSizeSqm} sqm</span>
      <span>🏗️ ${storeyLabel}</span>
    </div>
    <span class="commute-badge">🚗 ${prop.commuteMinutes} min commute</span>
    ${prop.listingUrl ? `<a class="listing-link" href="${escapeHtml(prop.listingUrl)}" target="_blank" rel="noopener">View listing →</a>` : ""}
  `;

  return card;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
