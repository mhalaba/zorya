import { useEffect, useId, useRef, useState } from "react";
import { useStore } from "../store";
import { openGmina } from "../place";

interface Hit {
  type: "gmina" | "powiat" | "address" | "street" | "city" | "osm";
  name: string;
  context: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number] | null;
  gmina: string | null;
  source: string;
}

const TYPE: Record<Hit["type"], string> = {
  gmina: "gmina",
  powiat: "powiat",
  address: "adres",
  street: "ulica",
  city: "miejscowość",
  osm: "miejsce",
};

function api(path: string) {
  return `${(useStore.getState().backendUrl || "").replace(/\/$/, "")}${path}`;
}

/** Small box around a point, for framing an address. */
const around = (lon: number, lat: number, d = 0.012): [number, number, number, number] => [lon - d * 1.6, lat - d, lon + d * 1.6, lat + d];

/**
 * Search box: gminy and powiaty while typing (our own index), the exact address on Enter (GUGiK, then OSM, through
 * our server). Choosing a result frames it, drops a pin and opens the gmina it lies in.
 */
export function MapSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [cur, setCur] = useState(-1);
  const listId = useId();
  const seq = useRef(0);

  // Type-ahead: names only, debounced.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const n = ++seq.current;
    const t = setTimeout(() => {
      fetch(api(`/api/search?q=${encodeURIComponent(term)}&mode=quick`))
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results: Hit[] }) => {
          if (n !== seq.current) return;
          setHits(d.results);
          setCur(-1);
          setNote(null);
        })
        .catch(() => undefined);
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  async function full() {
    const term = q.trim();
    if (term.length < 3) return;
    const n = ++seq.current;
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch(api(`/api/search?q=${encodeURIComponent(term)}&mode=full`));
      const d = r.ok ? ((await r.json()) as { results: Hit[]; errors: string[] }) : { results: [], errors: [r.status === 429 ? "za dużo wyszukiwań — spróbuj za minutę" : `błąd ${r.status}`] };
      if (n !== seq.current) return;
      setHits(d.results);
      setOpen(true);
      setCur(d.results.length ? 0 : -1);
      if (!d.results.length) setNote(d.errors.length ? `Nie znaleziono (${d.errors.join("; ")}).` : "Nie znaleziono. Wpisz: miejscowość, ulica numer.");
    } catch {
      setNote("Wyszukiwarka adresów jest teraz niedostępna.");
    } finally {
      setBusy(false);
    }
  }

  function choose(h: Hit) {
    const st = useStore.getState();
    setOpen(false);
    setQ(h.name);
    const point = h.type !== "gmina" && h.type !== "powiat";
    st.setSearchPin(point ? [h.lon, h.lat] : null);
    if (h.type === "powiat") {
      if (h.bbox) st.focusOn(h.bbox);
      void openGmina({ lat: h.lat, lon: h.lon });
      return;
    }
    void openGmina(h.gmina && !point ? { gmina: h.gmina } : { lat: h.lat, lon: h.lon }).then((ok) => {
      if (!ok) setNote("To miejsce leży poza Polską.");
    });
    st.focusOn(h.bbox ?? around(h.lon, h.lat, h.type === "address" ? 0.006 : 0.03));
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setNote("Ta przeglądarka nie udostępnia położenia.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const { latitude: lat, longitude: lon } = pos.coords;
        // Never sent anywhere but our own server's boundary look-up, rounded to ~100 m.
        const la = Math.round(lat * 1000) / 1000;
        const lo = Math.round(lon * 1000) / 1000;
        useStore.getState().setSearchPin([lo, la]);
        useStore.getState().focusOn(around(lo, la, 0.05));
        void openGmina({ lat: la, lon: lo }).then((ok) => !ok && setNote("Twoje położenie jest poza Polską."));
      },
      (err) => {
        setBusy(false);
        setNote(err.code === err.PERMISSION_DENIED ? "Brak zgody na położenie." : "Nie udało się ustalić położenia.");
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 }
    );
  }

  const showList = open && (hits.length > 0 || q.trim().length >= 3);

  return (
    <div className="map-search" role="search">
      <div className="ms-row">
        <input
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={cur >= 0 ? `${listId}-${cur}` : undefined}
          aria-label="Szukaj gminy, miejscowości lub adresu"
          placeholder="Gmina, miejscowość, adres…"
          value={q}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={120}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCur((c) => Math.min(hits.length - 1, c + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCur((c) => Math.max(-1, c - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (cur >= 0 && hits[cur]) choose(hits[cur]);
              else void full();
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
        <button type="button" className="ms-btn" onClick={locate} disabled={busy} title="Moje położenie" aria-label="Pokaż moją gminę (położenie)">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </div>
      {showList && (
        <ul className="ms-list" id={listId} role="listbox" aria-label="Wyniki">
          {hits.map((h, i) => (
            <li
              key={`${h.type}:${h.gmina ?? ""}:${h.lat}:${h.lon}:${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === cur}
              className={i === cur ? "on" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(h)}
            >
              <span className="ms-name">{h.name}</span>
              <span className="ms-ctx">
                {TYPE[h.type]} · {h.context}
              </span>
            </li>
          ))}
          {q.trim().length >= 3 && (
            <li className="ms-more" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => void full()}>
              {busy ? "Szukam adresu…" : `Szukaj dokładnego adresu „${q.trim()}” ↵`}
            </li>
          )}
          {note && <li className="ms-note">{note}</li>}
        </ul>
      )}
      {!showList && note && <div className="ms-note solo">{note}</div>}
    </div>
  );
}
