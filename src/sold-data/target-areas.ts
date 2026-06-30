/**
 * Target suburbs / postcodes / regions for the NSW sold-property data pull.
 * Provided by the user — focused on Greater/Western/South-Western Sydney
 * growth areas.
 */

export interface TargetArea {
  suburb: string;
  postcode: string;
  region: string;
}

export const TARGET_AREAS: TargetArea[] = [
  { suburb: "Riverstone", postcode: "2765", region: "North West Growth Area" },
  { suburb: "Grantham Farm", postcode: "2765", region: "North West Growth Area" },
  { suburb: "Marsden Park", postcode: "2765", region: "North West Growth Area" },
  { suburb: "Melonba", postcode: "2765", region: "North West Growth Area" },
  { suburb: "Vineyard", postcode: "2765", region: "North West Growth Area" },
  { suburb: "Box Hill", postcode: "2765", region: "North West Growth Area" },
  { suburb: "Gables", postcode: "2765", region: "North West Growth Area" },
  { suburb: "Schofields", postcode: "2762", region: "North West Growth Area" },
  { suburb: "Quakers Hill", postcode: "2763", region: "North West Growth Area" },
  { suburb: "Pitt Town", postcode: "2756", region: "Hawkesbury" },
  { suburb: "Parramatta", postcode: "2150", region: "Greater Western Sydney" },
  { suburb: "Seven Hills", postcode: "2147", region: "Greater Western Sydney" },
  { suburb: "Toongabbie", postcode: "2146", region: "Greater Western Sydney" },
  { suburb: "Wentworthville", postcode: "2145", region: "Greater Western Sydney" },
  { suburb: "Westmead", postcode: "2145", region: "Greater Western Sydney" },
  { suburb: "Blacktown", postcode: "2148", region: "Greater Western Sydney" },
  { suburb: "Penrith", postcode: "2750", region: "Western Sydney" },
  { suburb: "Emu Plains", postcode: "2750", region: "Western Sydney" },
  { suburb: "Kingswood", postcode: "2747", region: "Western Sydney" },
  { suburb: "Werrington", postcode: "2747", region: "Western Sydney" },
  { suburb: "Jordan Springs", postcode: "2747", region: "Western Sydney" },
  { suburb: "Glenmore Park", postcode: "2745", region: "Western Sydney" },
  { suburb: "St Marys", postcode: "2760", region: "Western Sydney" },
  { suburb: "Colyton", postcode: "2760", region: "Western Sydney" },
  { suburb: "Ropes Crossing", postcode: "2760", region: "Western Sydney" },
  { suburb: "Mount Druitt", postcode: "2770", region: "Western Sydney" },
  { suburb: "Rooty Hill", postcode: "2766", region: "Western Sydney" },
  { suburb: "St Clair", postcode: "2759", region: "Western Sydney" },
  { suburb: "Liverpool", postcode: "2170", region: "South Western Sydney" },
  { suburb: "Casula", postcode: "2170", region: "South Western Sydney" },
  { suburb: "Edmondson Park", postcode: "2174", region: "South Western Sydney" },
  { suburb: "Austral", postcode: "2179", region: "South Western Sydney" },
  { suburb: "Leppington", postcode: "2179", region: "South Western Sydney" },
  { suburb: "Bringelly", postcode: "2556", region: "South Western Sydney" },
  { suburb: "Fairfield", postcode: "2165", region: "South Western Sydney" },
  { suburb: "Cabramatta", postcode: "2166", region: "South Western Sydney" },
  { suburb: "Bankstown", postcode: "2200", region: "South Western Sydney" },
  { suburb: "Ingleburn", postcode: "2565", region: "South Western Sydney" },
  { suburb: "Minto", postcode: "2566", region: "South Western Sydney" },
  { suburb: "Glenfield", postcode: "2167", region: "South Western Sydney" },
  { suburb: "Campbelltown", postcode: "2560", region: "South Western Sydney" },
  { suburb: "Camden", postcode: "2570", region: "South Western Sydney" },
  { suburb: "Oran Park", postcode: "2570", region: "South Western Sydney" },
  { suburb: "Narellan", postcode: "2567", region: "South Western Sydney" },
  { suburb: "Gregory Hills", postcode: "2557", region: "South Western Sydney" },
  { suburb: "Gledswood Hills", postcode: "2557", region: "South Western Sydney" },
];

/** Set of all target postcodes (used for fast filtering). */
export const TARGET_POSTCODES: Set<string> = new Set(
  TARGET_AREAS.map((a) => a.postcode)
);

/** Map of UPPERCASE suburb name -> region (data localities are uppercase). */
export const SUBURB_TO_REGION: Map<string, string> = new Map(
  TARGET_AREAS.map((a) => [a.suburb.toUpperCase(), a.region])
);

/** Set of UPPERCASE target suburb names (the user's explicit list). */
export const TARGET_SUBURB_SET: Set<string> = new Set(
  TARGET_AREAS.map((a) => a.suburb.toUpperCase())
);

/** True if a locality is one of the user's explicitly listed target suburbs. */
export function isTargetSuburb(locality: string): boolean {
  return TARGET_SUBURB_SET.has(locality.toUpperCase().trim());
}

/** Map of postcode -> region (first listed region for that postcode). */
export const POSTCODE_TO_REGION: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const a of TARGET_AREAS) {
    if (!m.has(a.postcode)) m.set(a.postcode, a.region);
  }
  return m;
})();

/**
 * Resolve a region for a record using its locality first, then postcode.
 */
export function resolveRegion(locality: string, postcode: string): string {
  const bySuburb = SUBURB_TO_REGION.get(locality.toUpperCase().trim());
  if (bySuburb) return bySuburb;
  return POSTCODE_TO_REGION.get(postcode) ?? "Unknown";
}
