import { useId, useMemo, useRef, useState } from "react";

const MAX_RESULTS = 8;

export default function CityCombobox({
  label,
  metros,
  value,
  onChange,
  placeholder = "Search 386 metro areas",
  noun = "metro",
  hideLabel = false,
}) {
  const [query, setQuery] = useState(null); // null -> show selected name
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const baseId = useId();
  const inputRef = useRef(null);

  const text = query ?? (value ? value.name : "");

  const results = useMemo(() => {
    const q = (query ?? "").trim().toLowerCase();
    if (!q) return metros.slice(0, MAX_RESULTS);
    const starts = [];
    const contains = [];
    for (const m of metros) {
      const name = m.name.toLowerCase();
      if (name.startsWith(q)) starts.push(m);
      else if (name.includes(q)) contains.push(m);
    }
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [metros, query]);

  function select(metro) {
    onChange(metro);
    setQuery(null);
    setOpen(false);
  }

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function onKeyDown(e) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      setActive(0);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      setActive((a) => Math.min(a + 1, results.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActive((a) => Math.max(a - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (results[active]) select(results[active]);
      e.preventDefault();
    } else if (e.key === "Escape") {
      close();
      e.preventDefault();
    } else if (e.key === "Tab") {
      close();
    }
  }

  return (
    <div className="relative">
      <label
        htmlFor={`${baseId}-input`}
        className={
          hideLabel
            ? "sr-only"
            : "mb-2 block text-[13px] font-semibold text-ink-2"
        }
      >
        {label}
      </label>
      <input
        ref={inputRef}
        id={`${baseId}-input`}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${baseId}-listbox`}
        aria-activedescendant={
          open && results[active] ? `${baseId}-opt-${results[active].id}` : undefined
        }
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className="w-full rounded-[14px] border-[1.5px] border-transparent bg-field px-4 py-3 text-[15px] font-medium text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-ink"
        value={text}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={(e) => {
          setOpen(true);
          setActive(0);
          e.target.select();
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          id={`${baseId}-listbox`}
          role="listbox"
          aria-label={label}
          className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-[14px] bg-card p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_rgba(0,0,0,0.14)]"
        >
          {results.length === 0 && (
            <li className="px-3 py-2.5 text-[14px] text-ink-3" role="presentation">
              No {noun} matches "{query}"
            </li>
          )}
          {results.map((m, i) => (
            <li
              key={m.id}
              id={`${baseId}-opt-${m.id}`}
              role="option"
              aria-selected={value?.id === m.id}
              className={`cursor-pointer rounded-[10px] px-3 py-2.5 text-[14px] font-medium ${
                i === active ? "bg-field text-ink" : "text-ink-2"
              }`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus; select on click
                select(m);
              }}
            >
              {m.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
