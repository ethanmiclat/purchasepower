import { memo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import topology from "world-atlas/countries-110m.json";
import COUNTRIES from "../data/countries.json";

// World choropleth of World Bank price levels (U.S. = 100), the global
// twin of USMap. Same coral ramp: pale = cheaper than the U.S., deep
// coral = pricier. world-atlas keys geometries by numeric ISO code with
// only a name, while our data is keyed by iso3, so we join numeric ->
// iso3 once at module load (exact name match, plus a small alias table
// for the names Natural Earth spells differently). Countries the World
// Bank has no price level for stay neutral grey ("no data").

const RAMP = [
  [0.0, [246, 238, 234]],
  [0.45, [242, 181, 165]],
  [0.8, [232, 85, 62]],
  [1.0, [155, 43, 24]],
];

const NO_DATA = "#e9e9ec";

// Natural Earth (world-atlas) name -> our iso3, for names that don't match
// the World Bank spelling exactly. Codes not present in our data simply
// stay grey, which is harmless.
const NAME_ALIASES = {
  "Bahamas": "BHS", "Bosnia and Herz.": "BIH", "Brunei": "BRN",
  "Central African Rep.": "CAF", "Congo": "COG", "Cuba": "CUB",
  "Côte d'Ivoire": "CIV", "Dem. Rep. Congo": "COD", "Dominican Rep.": "DOM",
  "Egypt": "EGY", "Eq. Guinea": "GNQ", "eSwatini": "SWZ", "Gambia": "GMB",
  "Iran": "IRN", "Kyrgyzstan": "KGZ", "Laos": "LAO", "Macedonia": "MKD",
  "New Caledonia": "NCL", "North Korea": "PRK", "Palestine": "PSE",
  "Puerto Rico": "PRI", "Russia": "RUS", "S. Sudan": "SSD", "Slovakia": "SVK",
  "Solomon Is.": "SLB", "Somalia": "SOM", "South Korea": "KOR",
  "Syria": "SYR", "Taiwan": "TWN", "Turkey": "TUR", "Turkmenistan": "TKM",
  "United States of America": "USA", "Venezuela": "VEN", "Vietnam": "VNM",
  "W. Sahara": "ESH", "Yemen": "YEM",
};

const byIso = Object.fromEntries(COUNTRIES.countries.map((c) => [c.iso3, c]));
const byName = Object.fromEntries(COUNTRIES.countries.map((c) => [c.name, c]));

// numeric ISO code (world-atlas geo.id) -> our country record
const NUM_TO_COUNTRY = (() => {
  const out = {};
  for (const geo of topology.objects.countries.geometries) {
    const nm = geo.properties.name;
    const iso = NAME_ALIASES[nm] ?? byName[nm]?.iso3;
    if (iso && byIso[iso]) out[geo.id] = byIso[iso];
  }
  return out;
})();

const values = COUNTRIES.countries.map((c) => c.rpp.all);
const MIN = Math.min(...values);
const MAX = Math.max(...values);

export function worldRampColor(v) {
  const t = Math.min(1, Math.max(0, (v - MIN) / (MAX - MIN)));
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const [t0, c0] = RAMP[i - 1];
      const [t1, c1] = RAMP[i];
      const f = (t - t0) / (t1 - t0);
      const mix = c0.map((c, j) => Math.round(c + (c1[j] - c) * f));
      return `rgb(${mix.join(",")})`;
    }
  }
  return `rgb(${RAMP.at(-1)[1].join(",")})`;
}

const SCALE = 130;
// Width in projected px of one full 360°-longitude wrap, at SCALE, under
// geoEquirectangular (x = lon_radians * scale). The geography is repeated at
// every multiple of WORLD_WIDTH from -2x to +2x, so dragging left or right
// slides into a repeating copy of the world instead of hitting a hard edge
// or running into blank space — a 5-world-wide strip is far more than a
// user will pan through in one sitting.
const WORLD_WIDTH = SCALE * 2 * Math.PI;
const COPY_OFFSETS = [-2, -1, 0, 1, 2].map((n) => n * WORLD_WIDTH);

function WorldMap({ onCountryClick, interactive = true, className = "" }) {
  const [hover, setHover] = useState(null); // geo.id
  const hovered = hover ? NUM_TO_COUNTRY[hover] : null;

  const renderCountries = (geographies) =>
    geographies.map((geo) => {
      const c = NUM_TO_COUNTRY[geo.id];
      const fill = c ? worldRampColor(c.rpp.all) : NO_DATA;
      const clickable = interactive && Boolean(c);
      return (
        <Geography
          key={geo.rsmKey}
          geography={geo}
          tabIndex={clickable ? 0 : -1}
          aria-label={
            c
              ? `${c.name}: price level ${c.rpp.all.toFixed(1)}`
              : `${geo.properties.name}: no data`
          }
          onMouseEnter={() => clickable && setHover(geo.id)}
          onMouseLeave={() => clickable && setHover(null)}
          onFocus={() => clickable && setHover(geo.id)}
          onBlur={() => clickable && setHover(null)}
          onClick={() => clickable && onCountryClick?.(c)}
          onKeyDown={(e) => {
            if (clickable && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onCountryClick?.(c);
            }
          }}
          style={{
            default: {
              fill,
              stroke: "#fbfbfd",
              strokeWidth: 0.4,
              outline: "none",
              cursor: clickable ? "pointer" : "default",
            },
            hover: {
              fill: clickable ? "#1d1d1f" : fill,
              stroke: "#fbfbfd",
              strokeWidth: 0.4,
              outline: "none",
              cursor: clickable ? "pointer" : "default",
            },
            pressed: { fill: "#1d1d1f", outline: "none" },
          }}
        />
      );
    });

  return (
    <div className={`relative ${className}`}>
      {/* Fixed window: the map is drawn at natural proportions and
          overflows horizontally, so it is clipped here and revealed by
          dragging left/right. */}
      <div className="overflow-hidden rounded-[18px]">
        <ComposableMap
          projection="geoEquirectangular"
          projectionConfig={{ scale: SCALE }}
          width={800}
          height={420}
          aria-label="World map of country price levels; drag to pan, wraps around left and right"
          style={{
            width: "100%",
            height: "auto",
            cursor: interactive ? "grab" : "default",
          }}
        >
          <ZoomableGroup
            center={[10, 15]}
            zoom={1.25}
            minZoom={1}
            maxZoom={6}
            translateExtent={[
              [COPY_OFFSETS[0] - 150, -60],
              [COPY_OFFSETS.at(-1) + 950, 480],
            ]}
          >
            <Geographies geography={topology}>
              {({ geographies }) => (
                <>
                  {COPY_OFFSETS.map((dx) => (
                    <g key={dx} transform={`translate(${dx}, 0)`}>
                      {renderCountries(geographies)}
                    </g>
                  ))}
                </>
              )}
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>
      {interactive && (
        <p className="mt-2 text-center text-[11.5px] text-ink-4">
          Drag to pan · scroll to zoom
        </p>
      )}
      {interactive && hovered && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-lg">
          {hovered.name}:{" "}
          {hovered.rpp.all >= 100
            ? `${(hovered.rpp.all - 100).toFixed(1)}% above`
            : `${(100 - hovered.rpp.all).toFixed(1)}% below`}{" "}
          U.S. prices
        </div>
      )}
    </div>
  );
}

export function WorldLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-[12px] text-ink-3">
      <span>cheaper</span>
      <div
        aria-hidden="true"
        className="h-2.5 w-36 rounded-full"
        style={{
          background: `linear-gradient(to right, ${worldRampColor(
            MIN
          )}, ${worldRampColor((MIN + MAX) / 2)}, ${worldRampColor(MAX)})`,
        }}
      />
      <span>pricier</span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-[3px]"
          style={{ background: NO_DATA }}
        />
        no data
      </span>
    </div>
  );
}

export default memo(WorldMap);
