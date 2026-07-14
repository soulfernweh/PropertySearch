// Generates the slim docs/data.json for GitHub Pages from the full dataset.
const fs = require("fs");
const src = "data/sold/nsw-sold-last-12-months.json";
const dest = "docs/data.json";

if (!fs.existsSync(src)) {
  console.log("Source not found:", src);
  process.exit(1);
}

const d = JSON.parse(fs.readFileSync(src, "utf8"));
const slim = d.map((r) => ({
  cd: r.contractDate,
  p: r.purchasePrice,
  a: r.areaSqm,
  sub: r.suburb,
  st: r.streetName,
  addr: r.address,
  pc: r.postcode,
  reg: r.region,
  cat: r.propertyCategory,
  z: r.zoning,
  tgt: r.inTargetList,
}));

fs.writeFileSync(dest, JSON.stringify(slim));
console.log("Records:", slim.length, "| Size:", Math.round(fs.statSync(dest).size / 1024), "KB");
