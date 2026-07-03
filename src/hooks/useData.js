import { useEffect, useState } from "react";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

// Loads the pre-built static datasets. wages.json rides along in the same
// request wave; both are small enough (~200 KB total) to load up front.
export function useData() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson("/data/metros.json"),
      fetchJson("/data/wages.json"),
      fetchJson("/data/ces.json"),
    ])
      .then(([metros, wages, ces]) => {
        if (!cancelled) setState({ status: "ready", metros, wages, ces });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
