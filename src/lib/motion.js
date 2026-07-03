import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Animates a number counting up to `value` on mount/changes.
// Falls back to instant text under prefers-reduced-motion.
export function useCountUp(value, format) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) {
      el.textContent = format(value);
      return;
    }
    const state = { v: Number(el.dataset.v ?? value * 0.9) };
    const tween = gsap.to(state, {
      v: value,
      duration: 0.7,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = format(state.v);
      },
    });
    el.dataset.v = value;
    return () => tween.kill();
  }, [value, format]);
  return ref;
}

// Grows horizontal bars (scaleX 0 -> 1) once when mounted.
export function useGrowBars(deps) {
  const scope = useRef(null);
  useEffect(() => {
    const root = scope.current;
    if (!root || reducedMotion()) return;
    const bars = root.querySelectorAll("[data-bar]");
    const tween = gsap.fromTo(
      bars,
      { scaleX: 0, transformOrigin: "left center" },
      { scaleX: 1, duration: 0.6, ease: "power3.out", stagger: 0.04 }
    );
    return () => tween.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return scope;
}
