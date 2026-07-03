import { NavLink } from "react-router-dom";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/compare", label: "Compare" },
  { to: "/explore", label: "Explore" },
  { to: "/methodology", label: "Methodology" },
];

export default function NavBar() {
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 z-20 border-b border-line/80 bg-canvas/85 backdrop-blur-md"
    >
      <div className="mx-auto flex h-[60px] max-w-[1080px] items-center justify-between px-5 sm:px-8">
        <NavLink to="/" className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-ink text-[15px] font-bold text-white"
          >
            $
          </span>
          <span className="hidden text-[15px] font-bold tracking-[-0.01em] text-ink sm:inline">
            Purchasing Power
          </span>
        </NavLink>
        <div className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors sm:text-[13.5px] ${
                  isActive
                    ? "bg-ink text-white"
                    : "text-ink-2 hover:bg-field hover:text-ink"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
