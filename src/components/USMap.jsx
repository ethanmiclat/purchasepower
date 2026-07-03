import { memo, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import topology from "us-atlas/states-10m.json";
import STATES from "../data/states.json";

// Choropleth of BEA state-level all-items price parities. The coral ramp
// encodes price level: pale = cheaper than the U.S. average, deep coral =
// pricier. Interactive mode adds hover feedback + click-through.

const RAMP = [
  [0.0, [246, 238, 234]],
  [0.45, [242, 181, 165]],
  [0.8, [232, 85, 62]],
  [1.0, [155, 43, 24]],
];

const values = Object.values(STATES.states).map((s) => s.rpp.all);
const MIN = Math.min(...values);
const MAX = Math.max(...values);

export function rampColor(v) {
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

function USMap({ onStateClick, interactive = true, className = "" }) {
  const [hover, setHover] = useState(null);
  const stateByFips = STATES.states;

  const hovered = hover ? stateByFips[hover] : null;

  return (
    <div className={`relative ${className}`}>
      <ComposableMap
        projection="geoAlbersUsa"
        aria-label="United States map of state price levels"
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={topology}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const st = stateByFips[geo.id];
              if (!st) return null;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  tabIndex={interactive ? 0 : -1}
                  aria-label={`${st.name}: price level ${st.rpp.all.toFixed(1)}`}
                  onMouseEnter={() => interactive && setHover(geo.id)}
                  onMouseLeave={() => interactive && setHover(null)}
                  onFocus={() => interactive && setHover(geo.id)}
                  onBlur={() => interactive && setHover(null)}
                  onClick={() => interactive && onStateClick?.(st)}
                  onKeyDown={(e) => {
                    if (interactive && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onStateClick?.(st);
                    }
                  }}
                  style={{
                    default: {
                      fill: rampColor(st.rpp.all),
                      stroke: "#fbfbfd",
                      strokeWidth: 0.75,
                      outline: "none",
                      cursor: interactive ? "pointer" : "default",
                    },
                    hover: {
                      fill: interactive ? "#1d1d1f" : rampColor(st.rpp.all),
                      stroke: "#fbfbfd",
                      strokeWidth: 0.75,
                      outline: "none",
                      cursor: interactive ? "pointer" : "default",
                    },
                    pressed: { fill: "#1d1d1f", outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      {interactive && hovered && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-lg">
          {hovered.name}:{" "}
          {hovered.rpp.all >= 100
            ? `${(hovered.rpp.all - 100).toFixed(1)}% above`
            : `${(100 - hovered.rpp.all).toFixed(1)}% below`}{" "}
          U.S. average prices
        </div>
      )}
    </div>
  );
}

export function MapLegend() {
  return (
    <div className="flex items-center gap-3 text-[12px] text-ink-3">
      <span>cheaper</span>
      <div
        aria-hidden="true"
        className="h-2.5 w-36 rounded-full"
        style={{
          background: `linear-gradient(to right, ${rampColor(MIN)}, ${rampColor(
            (MIN + MAX) / 2
          )}, ${rampColor(MAX)})`,
        }}
      />
      <span>pricier</span>
    </div>
  );
}

export default memo(USMap);
