// NSW Sold Property Dashboard — client-side analytics with cross-filtering

let ALL = [];
let FILTERED = [];
let MONTHS = [];          // sorted distinct YYYY-MM across all data (slider domain)
let PRICE_MAX = 3000000;  // slider cap; top handle means "and above"
const PRICE_STEP = 25000;
let tableLimit = 50;
let streetFilter = null;  // { street, suburb } set via the streets chart
let streetMeta = [];      // index -> { street, suburb } for the streets chart
const charts = {};

const catColors = {
  House: "#2563eb", "Vacant Land": "#16a34a", Unit: "#d97706", Acreage: "#7c3aed",
};

// --- Formatters ---
const fmtMoney = (n) => (n == null ? "–" : "$" + Math.round(n).toLocaleString("en-AU"));
const fmtMoneyShort = (n) => {
  if (n == null) return "–";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + Math.round(n / 1e3) + "k";
  return "$" + Math.round(n);
};
const fmtPerSqm = (n) => (n == null ? "–" : "$" + Math.round(n).toLocaleString("en-AU"));
const fmtMonth = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return new Date(y, m - 1, 1).toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
};

// --- Stats helpers ---
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function percentile(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
function pricePerSqm(r) {
  if (r.purchasePrice && r.areaSqm && r.areaSqm > 0) return r.purchasePrice / r.areaSqm;
  return null;
}
const monthKey = (d) => (d ? d.slice(0, 7) : null);

// --- Load ---
async function load() {
  try {
    const res = await fetch("/api/sold-data");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to load data");
    }
    ALL = await res.json();
    MONTHS = [...new Set(ALL.map((r) => monthKey(r.contractDate)).filter(Boolean))].sort();
    const prices = ALL.map((r) => r.purchasePrice).filter((p) => p > 0);
    PRICE_MAX = Math.max(2000000, Math.ceil((percentile(prices, 99) || 2000000) / 100000) * 100000);

    initFilters();
    setupSliders();
    bindEvents();
    renderFaq();
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    applyFilters();
  } catch (e) {
    document.getElementById("loading-screen").innerHTML = `<p style="color:#dc2626">${e.message}</p>`;
  }
}

function initFilters() {
  const regions = [...new Set(ALL.map((r) => r.region))].sort();
  const suburbs = [...new Set(ALL.map((r) => r.suburb))].sort();
  const zones = [...new Set(ALL.map((r) => r.zoning).filter((z) => z && z.trim()))].sort();
  const rSel = document.getElementById("f-region");
  const sSel = document.getElementById("f-suburb");
  const zSel = document.getElementById("f-zoning");
  regions.forEach((r) => rSel.add(new Option(r, r)));
  suburbs.forEach((s) => sSel.add(new Option(s, s)));
  zones.forEach((z) => zSel.add(new Option(z, z)));
}

// --- Sliders (dual range) ---
function setupSliders() {
  const pMin = document.getElementById("price-min");
  const pMax = document.getElementById("price-max");
  pMin.min = pMax.min = 0;
  pMin.max = pMax.max = PRICE_MAX;
  pMin.step = pMax.step = PRICE_STEP;
  pMin.value = 0;
  pMax.value = PRICE_MAX;

  const dMin = document.getElementById("date-min");
  const dMax = document.getElementById("date-max");
  dMin.min = dMax.min = 0;
  dMin.max = dMax.max = Math.max(0, MONTHS.length - 1);
  dMin.step = dMax.step = 1;
  dMin.value = 0;
  dMax.value = MONTHS.length - 1;

  const onPrice = () => {
    let lo = +pMin.value, hi = +pMax.value;
    if (lo > hi) { if (this === pMin) lo = hi; else hi = lo; }
    if (lo > hi) [lo, hi] = [Math.min(lo, hi), Math.max(lo, hi)];
    pMin.value = Math.min(+pMin.value, +pMax.value);
    pMax.value = Math.max(+pMin.value, +pMax.value);
    updatePriceUI();
    applyFilters();
  };
  const onDate = () => {
    dMin.value = Math.min(+dMin.value, +dMax.value);
    dMax.value = Math.max(+dMin.value, +dMax.value);
    updateDateUI();
    applyFilters();
  };
  pMin.addEventListener("input", debounce(onPrice, 120));
  pMax.addEventListener("input", debounce(onPrice, 120));
  dMin.addEventListener("input", debounce(onDate, 120));
  dMax.addEventListener("input", debounce(onDate, 120));

  updatePriceUI();
  updateDateUI();
}

function updatePriceUI() {
  const pMin = +document.getElementById("price-min").value;
  const pMax = +document.getElementById("price-max").value;
  const loPct = (pMin / PRICE_MAX) * 100;
  const hiPct = (pMax / PRICE_MAX) * 100;
  const fill = document.getElementById("price-fill");
  fill.style.left = loPct + "%";
  fill.style.width = (hiPct - loPct) + "%";
  const hiLabel = pMax >= PRICE_MAX ? fmtMoneyShort(PRICE_MAX) + "+" : fmtMoneyShort(pMax);
  document.getElementById("price-readout").textContent = `${fmtMoneyShort(pMin)} – ${hiLabel}`;
}

function updateDateUI() {
  const i0 = +document.getElementById("date-min").value;
  const i1 = +document.getElementById("date-max").value;
  const n = Math.max(1, MONTHS.length - 1);
  const fill = document.getElementById("date-fill");
  fill.style.left = (i0 / n) * 100 + "%";
  fill.style.width = ((i1 - i0) / n) * 100 + "%";
  document.getElementById("date-readout").textContent =
    `${fmtMonth(MONTHS[i0])} – ${fmtMonth(MONTHS[i1])}`;
}

function getPriceRange() {
  const lo = +document.getElementById("price-min").value;
  const hi = +document.getElementById("price-max").value;
  return { min: lo, max: hi >= PRICE_MAX ? Infinity : hi };
}
function getDateRange() {
  const i0 = +document.getElementById("date-min").value;
  const i1 = +document.getElementById("date-max").value;
  return { min: MONTHS[i0], max: MONTHS[i1] };
}

// --- Events ---
function bindEvents() {
  ["f-category", "f-region", "f-suburb"].forEach((id) =>
    document.getElementById(id).addEventListener("change", () => {
      if (id === "f-region") rebuildSuburbOptions();
      if (id === "f-suburb") streetFilter = null; // changing suburb clears street pin
      applyFilters();
    })
  );
  document.getElementById("f-zoning").addEventListener("change", applyFilters);
  ["f-minland", "f-maxland"].forEach((id) =>
    document.getElementById(id).addEventListener("input", debounce(applyFilters, 300))
  );
  document.getElementById("f-neighbours").addEventListener("change", () => {
    rebuildSuburbOptions();
    applyFilters();
  });
  document.getElementById("f-reset").addEventListener("click", resetFilters);
  document.getElementById("t-sort").addEventListener("change", renderTable);
  document.getElementById("t-search").addEventListener("input", debounce(() => { tableLimit = 50; renderTable(); }, 250));
  document.getElementById("t-more").addEventListener("click", () => { tableLimit += 50; renderTable(); });

  const faqToggle = document.getElementById("faq-toggle");
  faqToggle.addEventListener("click", () => {
    const body = document.getElementById("faq-body");
    const open = body.classList.toggle("hidden");
    faqToggle.setAttribute("aria-expanded", String(!open));
  });
}

function rebuildSuburbOptions() {
  const region = document.getElementById("f-region").value;
  const includeNeighbours = document.getElementById("f-neighbours").checked;
  const sSel = document.getElementById("f-suburb");
  const current = sSel.value;
  let pool = region ? ALL.filter((r) => r.region === region) : ALL;
  if (!includeNeighbours) pool = pool.filter((r) => r.inTargetList);
  const suburbs = [...new Set(pool.map((r) => r.suburb))].sort();
  sSel.innerHTML = '<option value="">All suburbs</option>';
  suburbs.forEach((s) => sSel.add(new Option(s, s)));
  sSel.value = suburbs.includes(current) ? current : "";
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function resetFilters() {
  document.getElementById("f-category").value = "House,Vacant Land";
  document.getElementById("f-region").value = "";
  document.getElementById("f-zoning").value = "";
  document.getElementById("f-neighbours").checked = true;
  rebuildSuburbOptions();
  document.getElementById("f-suburb").value = "";
  document.getElementById("f-minland").value = "";
  document.getElementById("f-maxland").value = "";
  document.getElementById("price-min").value = 0;
  document.getElementById("price-max").value = PRICE_MAX;
  document.getElementById("date-min").value = 0;
  document.getElementById("date-max").value = MONTHS.length - 1;
  streetFilter = null;
  updatePriceUI();
  updateDateUI();
  applyFilters();
}

// --- Filtering ---
function applyFilters() {
  const cat = document.getElementById("f-category").value;
  const region = document.getElementById("f-region").value;
  const suburb = document.getElementById("f-suburb").value;
  const zoning = document.getElementById("f-zoning").value;
  const minL = parseFloat(document.getElementById("f-minland").value) || 0;
  const maxL = parseFloat(document.getElementById("f-maxland").value) || Infinity;
  const includeNeighbours = document.getElementById("f-neighbours").checked;
  const { min: minP, max: maxP } = getPriceRange();
  const { min: minMonth, max: maxMonth } = getDateRange();
  const cats = cat === "__all" ? null : new Set(cat.split(","));

  FILTERED = ALL.filter((r) => {
    if (cats && !cats.has(r.propertyCategory)) return false;
    if (!includeNeighbours && !r.inTargetList) return false;
    if (region && r.region !== region) return false;
    if (suburb && r.suburb !== suburb) return false;
    if (zoning && r.zoning !== zoning) return false;
    if (streetFilter && (r.streetName !== streetFilter.street || r.suburb !== streetFilter.suburb)) return false;
    const price = r.purchasePrice || 0;
    if (price < minP || price > maxP) return false;
    const mk = monthKey(r.contractDate);
    if (mk == null || mk < minMonth || mk > maxMonth) return false;
    const land = r.areaSqm;
    if (minL > 0 && (land == null || land < minL)) return false;
    if (maxL < Infinity && land != null && land > maxL) return false;
    return true;
  });

  tableLimit = 50;
  renderChips();
  renderKpis();
  renderCharts();
  renderTable();
}

// --- Active filter chips ---
function chip(label, onClear) {
  const el = document.createElement("span");
  el.className = "chip";
  el.innerHTML = `<span>${label}</span>`;
  const btn = document.createElement("button");
  btn.textContent = "✕";
  btn.onclick = onClear;
  el.appendChild(btn);
  return el;
}

function renderChips() {
  const box = document.getElementById("active-chips");
  box.innerHTML = "";
  const chips = [];

  const region = document.getElementById("f-region").value;
  const zoning = document.getElementById("f-zoning").value;
  const suburb = document.getElementById("f-suburb").value;
  if (region) chips.push(chip("Region: " + region, () => { document.getElementById("f-region").value = ""; rebuildSuburbOptions(); applyFilters(); }));
  if (zoning) chips.push(chip("Zone: " + zoning, () => { document.getElementById("f-zoning").value = ""; applyFilters(); }));
  if (suburb) chips.push(chip("Suburb: " + suburb, () => { document.getElementById("f-suburb").value = ""; applyFilters(); }));
  if (streetFilter) chips.push(chip("Street: " + streetFilter.street + " (" + streetFilter.suburb + ")", () => { streetFilter = null; applyFilters(); }));

  const pr = getPriceRange();
  if (pr.min > 0 || pr.max !== Infinity) {
    const lbl = "Price: " + fmtMoneyShort(pr.min) + " – " + (pr.max === Infinity ? fmtMoneyShort(PRICE_MAX) + "+" : fmtMoneyShort(pr.max));
    chips.push(chip(lbl, () => {
      document.getElementById("price-min").value = 0;
      document.getElementById("price-max").value = PRICE_MAX;
      updatePriceUI(); applyFilters();
    }));
  }
  const i0 = +document.getElementById("date-min").value;
  const i1 = +document.getElementById("date-max").value;
  if (i0 > 0 || i1 < MONTHS.length - 1) {
    chips.push(chip("Date: " + fmtMonth(MONTHS[i0]) + " – " + fmtMonth(MONTHS[i1]), () => {
      document.getElementById("date-min").value = 0;
      document.getElementById("date-max").value = MONTHS.length - 1;
      updateDateUI(); applyFilters();
    }));
  }

  if (chips.length === 0) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  chips.forEach((c) => box.appendChild(c));
  const clearAll = document.createElement("button");
  clearAll.className = "chips-clear";
  clearAll.textContent = "Clear all filters";
  clearAll.onclick = resetFilters;
  box.appendChild(clearAll);
}

// --- KPIs ---
function renderKpis() {
  const prices = FILTERED.map((r) => r.purchasePrice).filter((p) => p > 0);
  const persqm = FILTERED.map(pricePerSqm).filter((v) => v != null);
  const lands = FILTERED.map((r) => r.areaSqm).filter((v) => v != null && v > 0);
  document.getElementById("kpi-count").textContent = FILTERED.length.toLocaleString("en-AU");
  document.getElementById("kpi-median").textContent = fmtMoney(median(prices));
  document.getElementById("kpi-persqm").textContent = persqm.length ? fmtPerSqm(median(persqm)) : "–";
  const ml = median(lands);
  document.getElementById("kpi-land").textContent = ml != null ? Math.round(ml).toLocaleString("en-AU") + " m²" : "–";
}

// --- Charts ---
function groupMedian(records, keyFn, valFn) {
  const buckets = new Map();
  for (const r of records) {
    const k = keyFn(r);
    if (k == null) continue;
    const v = valFn(r);
    if (v == null) continue;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(v);
  }
  const out = [];
  for (const [k, vals] of buckets) out.push({ key: k, median: median(vals), count: vals.length });
  return out;
}

function makeChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), config);
}

function renderCharts() {
  const months = MONTHS;
  const cats = [...new Set(FILTERED.map((r) => r.propertyCategory))];

  // Price trend
  makeChart("chart-trend", {
    type: "line",
    data: {
      labels: months.map(fmtMonth),
      datasets: cats.map((c) => {
        const recs = FILTERED.filter((r) => r.propertyCategory === c);
        const map = new Map(groupMedian(recs, (r) => monthKey(r.contractDate), (r) => r.purchasePrice).map((b) => [b.key, b.median]));
        return { label: c, data: months.map((m) => map.get(m) ?? null), borderColor: catColors[c] || "#64748b", backgroundColor: "transparent", tension: 0.25, spanGaps: true };
      }),
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { ticks: { callback: (v) => fmtMoneyShort(v) } } } },
  });

  // $/sqm trend
  makeChart("chart-persqm-trend", {
    type: "line",
    data: {
      labels: months.map(fmtMonth),
      datasets: cats.map((c) => {
        const recs = FILTERED.filter((r) => r.propertyCategory === c);
        const map = new Map(groupMedian(recs, (r) => monthKey(r.contractDate), pricePerSqm).map((b) => [b.key, b.median]));
        return { label: c, data: months.map((m) => (map.has(m) ? Math.round(map.get(m)) : null)), borderColor: catColors[c] || "#64748b", backgroundColor: "transparent", tension: 0.25, spanGaps: true };
      }),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtPerSqm(c.raw)}/m²` } } },
      scales: { y: { ticks: { callback: (v) => fmtPerSqm(v) } } },
    },
  });

  // Volume by month — clickable
  makeChart("chart-volume", {
    type: "bar",
    data: { labels: months.map(fmtMonth), datasets: [{ label: "Sales", data: months.map((m) => FILTERED.filter((r) => monthKey(r.contractDate) === m).length), backgroundColor: "#60a5fa" }] },
    options: {
      responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      onClick: (e, els) => { if (els.length) { const idx = els[0].index; pinMonth(idx); } },
    },
  });

  // Top streets — clickable
  const streetGroups = new Map();
  for (const r of FILTERED) {
    if (!r.streetName) continue;
    const key = r.streetName + "||" + r.suburb;
    if (!streetGroups.has(key)) streetGroups.set(key, { street: r.streetName, suburb: r.suburb, count: 0 });
    streetGroups.get(key).count++;
  }
  const suburbSelected = !!document.getElementById("f-suburb").value;
  const topStreets = [...streetGroups.values()].sort((a, b) => b.count - a.count).slice(0, 15);
  streetMeta = topStreets;
  makeChart("chart-streets", {
    type: "bar",
    data: {
      labels: topStreets.map((s) => suburbSelected ? s.street : `${s.street} (${s.suburb})`),
      datasets: [{ label: "Sales", data: topStreets.map((s) => s.count), backgroundColor: "#f472b6" }],
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.raw + " sales" } } },
      scales: { x: { ticks: { precision: 0 } } },
      onClick: (e, els) => { if (els.length) pinStreet(els[0].index); },
    },
  });

  // Median $/sqm by suburb — clickable
  const persqmBySuburb = groupMedian(FILTERED, (r) => r.suburb, pricePerSqm).filter((b) => b.count >= 5).sort((a, b) => b.median - a.median).slice(0, 20);
  makeChart("chart-persqm", {
    type: "bar",
    data: { labels: persqmBySuburb.map((b) => b.key), datasets: [{ label: "$/m²", data: persqmBySuburb.map((b) => Math.round(b.median)), backgroundColor: "#34d399" }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmtPerSqm(c.raw) + "/m²" } } },
      scales: { x: { ticks: { callback: (v) => fmtPerSqm(v) } } },
      onClick: (e, els) => { if (els.length) pinSuburb(persqmBySuburb[els[0].index].key); },
    },
  });

  // Median price by suburb — clickable
  const priceBySuburb = groupMedian(FILTERED, (r) => r.suburb, (r) => r.purchasePrice).filter((b) => b.count >= 5).sort((a, b) => b.median - a.median).slice(0, 20);
  makeChart("chart-price", {
    type: "bar",
    data: { labels: priceBySuburb.map((b) => b.key), datasets: [{ label: "Median price", data: priceBySuburb.map((b) => Math.round(b.median)), backgroundColor: "#818cf8" }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmtMoney(c.raw) } } },
      scales: { x: { ticks: { callback: (v) => fmtMoneyShort(v) } } },
      onClick: (e, els) => { if (els.length) pinSuburb(priceBySuburb[els[0].index].key); },
    },
  });
}

// --- Cross-filter pin actions ---
function pinSuburb(suburb) {
  const sSel = document.getElementById("f-suburb");
  if (![...sSel.options].some((o) => o.value === suburb)) sSel.add(new Option(suburb, suburb));
  sSel.value = sSel.value === suburb ? "" : suburb; // toggle
  streetFilter = null;
  applyFilters();
}
function pinMonth(idx) {
  const dMin = document.getElementById("date-min");
  const dMax = document.getElementById("date-max");
  // toggle: if already pinned to just this month, clear
  if (+dMin.value === idx && +dMax.value === idx) {
    dMin.value = 0; dMax.value = MONTHS.length - 1;
  } else {
    dMin.value = idx; dMax.value = idx;
  }
  updateDateUI();
  applyFilters();
}
function pinStreet(idx) {
  const m = streetMeta[idx];
  if (!m) return;
  if (streetFilter && streetFilter.street === m.street && streetFilter.suburb === m.suburb) {
    streetFilter = null;
  } else {
    streetFilter = { street: m.street, suburb: m.suburb };
  }
  applyFilters();
}

// --- Table ---
function renderTable() {
  const sort = document.getElementById("t-sort").value;
  const q = document.getElementById("t-search").value.trim().toLowerCase();
  let rows = q ? FILTERED.filter((r) => r.address.toLowerCase().includes(q)) : FILTERED.slice();

  const sorters = {
    contractDate: (a, b) => (b.contractDate || "").localeCompare(a.contractDate || ""),
    priceDesc: (a, b) => (b.purchasePrice || 0) - (a.purchasePrice || 0),
    priceAsc: (a, b) => (a.purchasePrice || 0) - (b.purchasePrice || 0),
    persqmDesc: (a, b) => (pricePerSqm(b) || 0) - (pricePerSqm(a) || 0),
    persqmAsc: (a, b) => (pricePerSqm(a) || Infinity) - (pricePerSqm(b) || Infinity),
    landDesc: (a, b) => (b.areaSqm || 0) - (a.areaSqm || 0),
  };
  rows.sort(sorters[sort]);

  const total = rows.length;
  rows = rows.slice(0, tableLimit);
  const tbody = document.querySelector("#sales-table tbody");
  tbody.innerHTML = rows.map((r) => {
    const pps = pricePerSqm(r);
    const catClass = "cat-" + r.propertyCategory.replace(/\s+/g, "");
    return `<tr>
      <td>${r.contractDate || "–"}</td>
      <td>${escapeHtml(r.address)}</td>
      <td>${escapeHtml(r.suburb)}</td>
      <td><span class="cat-badge ${catClass}">${r.propertyCategory}</span></td>
      <td class="num">${fmtMoney(r.purchasePrice)}</td>
      <td class="num">${r.areaSqm != null ? Math.round(r.areaSqm).toLocaleString("en-AU") : "–"}</td>
      <td class="num">${pps != null ? fmtPerSqm(pps) : "–"}</td>
      <td>${escapeHtml(r.zoning || "–")}</td>
    </tr>`;
  }).join("");

  document.getElementById("table-count").textContent =
    `(${Math.min(tableLimit, total).toLocaleString("en-AU")} of ${total.toLocaleString("en-AU")})`;
  document.getElementById("t-more").disabled = tableLimit >= total;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : str;
  return d.innerHTML;
}

// --- Zoning FAQ ---
const ZONE_FAQ = [
  ["R1", "General Residential — a mix of housing types and densities."],
  ["R2", "Low Density Residential — mainly detached houses. Most standard suburban blocks."],
  ["R3", "Medium Density Residential — townhouses, villas, low-rise units."],
  ["R4", "High Density Residential — apartment buildings."],
  ["R5", "Large Lot Residential — semi-rural / acreage-style residential lots."],
  ["RU1", "Primary Production — agriculture and rural industry."],
  ["RU2", "Rural Landscape — rural land where landscape character is protected."],
  ["RU4", "Primary Production Small Lots — small-scale rural / rural-residential."],
  ["RU5", "Village — the centre of a rural village."],
  ["RU6", "Transition — buffer between rural and other land uses."],
  ["E1", "Local Centre — small shops/services (2022 employment-zone code)."],
  ["E2", "Commercial Centre — town/city centre commercial core."],
  ["E3", "Productivity Support — light industrial / business support."],
  ["E4", "General Industrial — manufacturing and warehousing."],
  ["E5", "Heavy Industrial — heavy manufacturing."],
  ["B1", "Neighbourhood Centre — small local retail (legacy business zone)."],
  ["B3", "Commercial Core — major commercial centre (legacy)."],
  ["B4", "Mixed Use — shops, offices and housing combined (legacy)."],
  ["B5", "Business Development — large-format retail / showrooms (legacy)."],
  ["IN1", "General Industrial (legacy industrial zone)."],
  ["IN2", "Light Industrial (legacy industrial zone)."],
  ["MU / MU1", "Mixed Use — residential combined with commercial."],
  ["RE1", "Public Recreation — parks and public open space."],
  ["RE2", "Private Recreation — privately owned recreation (golf, clubs)."],
  ["C2", "Environmental Conservation — high-value natural areas."],
  ["C3", "Environmental Management — land with special ecological value."],
  ["C4", "Environmental Living — low-impact housing in sensitive areas."],
  ["SP1", "Special Activities — specific uses like ports, education."],
  ["SP2", "Infrastructure — roads, utilities, public facilities."],
  ["SP3", "Tourist — tourist and visitor facilities."],
  ["UD / UR", "Urban Development / Urban — growth-area release zones (precinct plans)."],
  ["ENT", "Enterprise — growth-area employment/enterprise land (precinct plans)."],
  ["ENZ / AGB", "Growth-area environment / agribusiness precinct zones — verify in the precinct plan."],
];

function renderFaq() {
  const body = document.getElementById("faq-body");
  const grid = ZONE_FAQ.map(([code, desc]) =>
    `<div class="faq-zone"><code>${code}</code>${desc}</div>`).join("");
  body.innerHTML = `
    <p>NSW land is classified under the <strong>Standard Instrument Local Environmental Plan (LEP)</strong>. The zone controls what can be built on a block — it's one of the biggest drivers of land value. For a buyer, "R2 Low Density" (standard house blocks) and "R5 Large Lot" (acreage) are the most common residential zones in these growth corridors.</p>
    <h4>Common zone codes</h4>
    <div class="faq-zone-grid">${grid}</div>
    <p class="faq-note">NSW reformed employment zones in 2022 (B-zones progressively became E-zones); some councils still display legacy codes. Growth-area precinct zones (UD, UR, ENT, ENZ, AGB) come from State precinct plans rather than the standard LEP — always confirm the exact zoning and controls for a specific property on the NSW Planning Portal.</p>`;
}

load();
