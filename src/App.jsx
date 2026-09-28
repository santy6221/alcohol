import React, { useState, useEffect, useCallback } from "react";
import { Search, Shuffle, X, Loader2 } from "lucide-react";

/*
  COCKTAIL CODEX
  ---------------------------------------------------------
  Design plan
  Color:
    --bg        #1C140F  (dark walnut, the bar counter at night)
    --bg-panel  #241A13  (slightly raised wood panel)
    --paper     #F1E7D3  (the ticket / order slip)
    --ink       #2B2118  (text printed on the ticket)
    --copper    #C17A45  (accent — the copper of a bar tool)
    --gold      #D9B26B  (secondary accent — bottle glass highlight)
    --muted     #9C8975  (secondary text on dark)
  Type:
    Display  -> 'Playfair Display' (drink names, headline — bar-menu serif)
    Body     -> 'Inter' (descriptions, UI labels)
    Utility  -> 'IBM Plex Mono' (measurements/instructions — reads like a printed order ticket)
  Layout:
    Header (title + search + shuffle) -> grid of small "ticket" cards -> click opens a
    full order-ticket detail with a torn paper edge, ingredients set as a receipt list
    (measure right-aligned like a printed price column), instructions below.
  Signature:
    The detail view is a printed bar ticket, torn edge on top (CSS zigzag), with the
    drink's real idDrink from the API shown as "Ticket No." — a numbered marker that
    is genuine data, not decoration.
  ---------------------------------------------------------
*/

const API = "https://www.thecocktaildb.com/api/json/v1/1";
const TRANSLATE_API = "https://api.mymemory.translated.net/get";

// TheCocktailDB uses a fixed, enumerable set of categories/glasses/alcoholic
// values, so these map cleanly to Spanish without needing machine translation.
const CATEGORY_ES = {
  "Ordinary Drink": "Trago sencillo",
  Cocktail: "Cóctel",
  Shake: "Batido",
  "Other/Unknown": "Otro",
  Cocoa: "Cacao",
  Shot: "Shot",
  "Coffee / Tea": "Café / Té",
  "Homemade Liqueur": "Licor casero",
  "Punch / Party Drink": "Ponche",
  Beer: "Cerveza",
  "Soft Drink": "Bebida sin alcohol",
  "Soft Drink / Soda": "Refresco",
};

const GLASS_ES = {
  "Cocktail glass": "Copa de cóctel",
  "Old-fashioned glass": "Vaso old-fashioned",
  "Highball glass": "Vaso highball",
  "Collins glass": "Vaso collins",
  "Whiskey Glass": "Vaso de whisky",
  "Whiskey sour glass": "Copa de whisky sour",
  "Champagne flute": "Copa de champán",
  "Champagne Flute": "Copa de champán",
  "Wine Glass": "Copa de vino",
  "White wine glass": "Copa de vino blanco",
  "Margarita/Coupette glass": "Copa margarita",
  "Margarita glass": "Copa margarita",
  "Shot glass": "Vaso de shot",
  "Beer mug": "Jarra de cerveza",
  "Beer pilsner": "Vaso pilsner",
  "Beer Glass": "Vaso de cerveza",
  "Hurricane glass": "Vaso hurricane",
  "Pint glass": "Vaso pinta",
  "Punch bowl": "Ponchera",
  "Brandy snifter": "Copa de brandy",
  "Nick and Nora Glass": "Copa Nick & Nora",
  "Coffee mug": "Taza de café",
  "Irish coffee cup": "Taza de café irlandés",
  "Balloon Glass": "Copa balón",
  "Copper Mug": "Taza de cobre",
  "Pitcher": "Jarra",
  "Cordial glass": "Copa de licor",
  "Coupette glass": "Copa coupette",
  "Mason jar": "Frasco mason",
  "Pousse cafe glass": "Vaso pousse-café",
};

const ALCOHOLIC_ES = {
  Alcoholic: "Con alcohol",
  "Non alcoholic": "Sin alcohol",
  "Optional alcohol": "Alcohol opcional",
};

function translateCategory(v) {
  return v ? CATEGORY_ES[v] || v : v;
}
function translateGlass(v) {
  return v ? GLASS_ES[v] || v : v;
}
function translateAlcoholic(v) {
  return v ? ALCOHOLIC_ES[v] || v : v;
}

// Free, keyless translation for the free-form text (instructions/ingredient
// names) that isn't part of a fixed enumerable set.
async function translateText(text) {
  if (!text || !text.trim()) return text;
  const url = `${TRANSLATE_API}?q=${encodeURIComponent(text)}&langpair=en|es`;
  const res = await fetch(url);
  const data = await res.json();
  const translated = data && data.responseData && data.responseData.translatedText;
  if (!translated || /MYMEMORY WARNING/i.test(translated)) return text;
  return translated;
}

async function translateDrink(drink) {
  const ingredients = extractIngredients(drink);
  const joined = ingredients.map((it) => it.ing).join(" ~~ ");
  const [instructions, ingredientsJoined] = await Promise.all([
    translateText(drink.strInstructions),
    joined ? translateText(joined) : Promise.resolve(""),
  ]);
  const parts = ingredientsJoined
    ? ingredientsJoined.split("~~").map((s) => s.trim())
    : [];
  const ingredientNames =
    parts.length === ingredients.length ? parts : ingredients.map((it) => it.ing);
  return {
    instructions,
    ingredients: ingredients.map((it, i) => ({ ...it, ing: ingredientNames[i] })),
  };
}

// filter.php (used for the default listing and category browsing) only
// returns idDrink/strDrink/strDrinkThumb — no category/glass/alcoholic info.
// We fetch the full record for each so the card can show more than one property.
function hydrateDrinks(list) {
  return Promise.all(
    list.map((d) =>
      d.strCategory
        ? Promise.resolve(d)
        : fetch(`${API}/lookup.php?i=${d.idDrink}`)
            .then((r) => r.json())
            .then((res) => (res.drinks && res.drinks[0]) || d)
            .catch(() => d)
    )
  );
}

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function extractIngredients(drink) {
  const items = [];
  for (let i = 1; i <= 15; i++) {
    const ing = drink[`strIngredient${i}`];
    const measure = drink[`strMeasure${i}`];
    if (ing && ing.trim()) {
      items.push({ ing: ing.trim(), measure: measure ? measure.trim() : "" });
    }
  }
  return items;
}

export default function CocktailCodex() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 400);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [drinks, setDrinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [translations, setTranslations] = useState({}); // idDrink -> { instructions, ingredients }
  const [translating, setTranslating] = useState(false);
  const [lang, setLang] = useState("es"); // "es" | "en" — applies to the whole catalog

  // Load category list once
  useEffect(() => {
    fetch(`${API}/list.php?c=list`)
      .then((r) => r.json())
      .then((d) => setCategories((d.drinks || []).map((c) => c.strCategory)))
      .catch(() => {});
  }, []);

  const loadDefault = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(`${API}/filter.php?c=Cocktail`)
      .then((r) => r.json())
      .then((d) => (d.drinks || []).slice(0, 12))
      .then(hydrateDrinks)
      .then(setDrinks)
      .catch(() => setError("No se pudo cargar el catálogo. Intenta de nuevo."))
      .finally(() => setLoading(false));
  }, []);

  // Initial load
  useEffect(() => {
    loadDefault();
  }, [loadDefault]);

  // Search / category effect
  useEffect(() => {
    if (!debouncedQuery && !category) {
      loadDefault();
      return;
    }
    setLoading(true);
    setError("");
    const url = debouncedQuery
      ? `${API}/search.php?s=${encodeURIComponent(debouncedQuery)}`
      : `${API}/filter.php?c=${encodeURIComponent(category)}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => (d.drinks || []).slice(0, 20))
      .then((list) => (debouncedQuery ? list : hydrateDrinks(list)))
      .then(setDrinks)
      .catch(() => setError("No se pudo buscar. Intenta de nuevo."))
      .finally(() => setLoading(false));
  }, [debouncedQuery, category, loadDefault]);

  const openDrink = (idOrDrink) => {
    const id = typeof idOrDrink === "string" ? idOrDrink : idOrDrink.idDrink;
    // If the object already has full recipe data (from search/random), use it directly
    if (typeof idOrDrink !== "string" && idOrDrink.strInstructions) {
      setSelected(idOrDrink);
      fetchTranslation(idOrDrink);
      return;
    }
    setSelectedLoading(true);
    fetch(`${API}/lookup.php?i=${id}`)
      .then((r) => r.json())
      .then((d) => {
        const drink = d.drinks && d.drinks[0];
        setSelected(drink);
        if (drink) fetchTranslation(drink);
      })
      .catch(() => setError("No se pudo cargar la receta."))
      .finally(() => setSelectedLoading(false));
  };

  const fetchTranslation = (drink) => {
    if (!drink || translations[drink.idDrink]) return;
    setTranslating(true);
    translateDrink(drink)
      .then((t) =>
        setTranslations((prev) => ({ ...prev, [drink.idDrink]: t }))
      )
      .catch(() => {})
      .finally(() => setTranslating(false));
  };

  const shuffle = () => {
    setQuery("");
    setCategory("");
    setLoading(true);
    setError("");
    fetch(`${API}/random.php`)
      .then((r) => r.json())
      .then((d) => setDrinks(d.drinks || []))
      .catch(() => setError("No se pudo obtener una bebida al azar."))
      .finally(() => setLoading(false));
  };

  return (
    <div className="codex-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .codex-root {
          --bg: #1C140F;
          --bg-panel: #241A13;
          --paper: #F1E7D3;
          --ink: #2B2118;
          --copper: #C17A45;
          --gold: #D9B26B;
          --muted: #9C8975;
          --border: #3A2C21;

          background: var(--bg);
          color: var(--paper);
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          padding: 40px 24px 80px;
          box-sizing: border-box;
        }
        .codex-root * { box-sizing: border-box; }

        .codex-header {
          max-width: 980px;
          margin: 0 auto 48px;
          text-align: center;
        }
        .codex-eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          letter-spacing: 0.18em;
          font-size: 11px;
          color: var(--gold);
          text-transform: uppercase;
          margin-bottom: 22px;
        }
        .codex-title {
          font-family: 'Playfair Display', serif;
          font-weight: 800;
          font-size: clamp(34px, 6vw, 56px);
          margin: 0 0 22px;
          color: var(--paper);
          letter-spacing: -0.01em;
          line-height: 1.1;
        }
        .codex-title em {
          color: var(--copper);
          font-style: italic;
        }
        .codex-sub {
          color: var(--muted);
          font-size: 15px;
          max-width: 520px;
          margin: 0 auto;
          line-height: 1.6;
        }

        .codex-controls {
          max-width: 760px;
          width: 100%;
          margin: 28px auto 0;
          display: grid;
          grid-template-columns: minmax(0, 1.8fr) minmax(190px, 1.2fr) minmax(175px, 1.2fr) auto;
          gap: 10px;
          align-items: stretch;
        }
        .codex-search {
          position: relative;
          min-width: 0;
        }
        .codex-search input {
          width: 100%;
          background: var(--bg-panel);
          border: 1px solid var(--border);
          color: var(--paper);
          padding: 12px 14px 12px 40px;
          border-radius: 6px;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .codex-search input:focus {
          border-color: var(--copper);
        }
        .codex-search input::placeholder { color: var(--muted); }
        .codex-search svg {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
          width: 16px;
          height: 16px;
        }
        .codex-select {
          width: 100%;
          background: var(--bg-panel);
          border: 1px solid var(--border);
          color: var(--paper);
          padding: 12px 14px;
          border-radius: 6px;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          outline: none;
          cursor: pointer;
        }
        .codex-shuffle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          background: var(--copper);
          color: var(--bg);
          border: none;
          padding: 12px 18px;
          border-radius: 6px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: filter 0.15s ease, transform 0.1s ease;
          white-space: nowrap;
        }
        .codex-shuffle:hover { filter: brightness(1.1); }
        .codex-shuffle:active { transform: scale(0.97); }
        .codex-shuffle svg { width: 15px; height: 15px; }

        .codex-lang-toggle-header {
          display: flex;
          gap: 4px;
          background: var(--bg-panel);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 3px;
        }
        .codex-lang-toggle-header button {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          letter-spacing: 0.05em;
          padding: 7px 12px;
          border-radius: 4px;
          border: none;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .codex-lang-toggle-header button.is-active {
          background: var(--copper);
          color: var(--bg);
        }

        .codex-status {
          text-align: center;
          color: var(--muted);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          margin: 40px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .codex-status svg { animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .codex-error {
          text-align: center;
          color: #E0917A;
          font-size: 13px;
          margin: 24px 0;
        }

        .codex-grid {
          max-width: 1220px;
          margin: 44px auto 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
          gap: 18px;
        }

        @media (max-width: 700px) {
          .codex-root {
            padding: 20px 12px 44px;
          }
          .codex-header {
            margin-bottom: 20px;
          }
          .codex-eyebrow {
            letter-spacing: 0.12em;
            font-size: 9px;
            margin-bottom: 14px;
          }
          .codex-title {
            font-size: clamp(30px, 11vw, 42px);
            margin-bottom: 14px;
          }
          .codex-sub {
            font-size: 13px;
            line-height: 1.5;
            padding: 0 6px;
          }
          .codex-controls {
            grid-template-columns: 1fr;
            max-width: 100%;
            gap: 8px;
            margin-top: 18px;
          }
          .codex-search,
          .codex-select,
          .codex-shuffle,
          .codex-lang-toggle-header {
            width: 100%;
          }
          .codex-search input,
          .codex-select,
          .codex-shuffle,
          .codex-lang-toggle-header button {
            min-height: 44px;
          }
          .codex-shuffle {
            justify-content: center;
            font-size: 13px;
          }
          .codex-lang-toggle-header {
            padding: 4px;
          }
          .codex-lang-toggle-header button {
            flex: 1;
            padding: 8px 10px;
          }
          .codex-grid {
            grid-template-columns: 1fr;
            gap: 12px;
            margin-top: 22px;
          }
          .codex-card {
            display: grid;
            grid-template-columns: 110px 1fr;
            min-height: 110px;
          }
          .codex-card img {
            width: 110px;
            min-width: 110px;
            height: 100%;
            min-height: 110px;
            border-right: 1px solid var(--border);
            border-bottom: none;
          }
          .codex-card-body {
            padding: 10px 12px;
            gap: 6px;
          }
          .codex-card-name {
            font-size: 18px;
          }
          .codex-card-tag {
            white-space: normal;
            letter-spacing: 0.04em;
          }
          .codex-overlay {
            padding: 12px 8px;
          }
          .codex-ticket {
            max-width: 100%;
          }
          .codex-ticket-inner {
            padding: 8px 16px 24px;
          }
          .codex-ticket-name {
            font-size: 22px;
          }
          .codex-ticket-meta {
            font-size: 10px;
          }
        }

        .codex-card {
          background: var(--bg-panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          text-align: left;
          padding: 0;
          transition: border-color 0.15s ease, transform 0.15s ease;
          display: flex;
          flex-direction: row;
          align-items: stretch;
        }
        .codex-card:hover {
          border-color: var(--copper);
          transform: translateY(-2px);
        }
        .codex-card img {
          width: 128px;
          min-width: 128px;
          min-height: 132px;
          align-self: stretch;
          object-fit: cover;
          display: block;
          border-right: 1px solid var(--border);
        }
        .codex-card-body {
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }
        .codex-card-name {
          font-family: 'Playfair Display', serif;
          font-weight: 700;
          font-size: 17px;
          color: var(--paper);
          margin: 0;
          line-height: 1.25;
        }
        .codex-card-tags {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .codex-card-tag {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--gold);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .codex-card-tag.is-muted {
          color: var(--muted);
        }

        /* ---------- Detail ticket overlay ---------- */
        .codex-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 7, 4, 0.72);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 48px 16px;
          overflow-y: auto;
          z-index: 50;
        }
        .codex-ticket {
          background: var(--paper);
          color: var(--ink);
          width: 100%;
          max-width: 440px;
          border-radius: 2px;
          position: relative;
          box-shadow: 0 30px 60px rgba(0,0,0,0.45);
          animation: rise 0.25s ease;
        }
        @keyframes rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .codex-ticket-torn {
          height: 14px;
          width: 100%;
          background:
            linear-gradient(135deg, var(--paper) 50%, transparent 50%) 0 0,
            linear-gradient(45deg, var(--paper) 50%, transparent 50%) 0 0;
          background-size: 14px 14px;
          background-repeat: repeat-x;
          transform: translateY(-14px);
        }
        .codex-ticket-inner {
          padding: 8px 30px 34px;
        }
        .codex-ticket-close {
          position: absolute;
          top: 10px;
          right: 14px;
          background: none;
          border: none;
          color: var(--ink);
          opacity: 0.55;
          cursor: pointer;
          padding: 4px;
        }
        .codex-ticket-close:hover { opacity: 1; }
        .codex-ticket-close svg { width: 18px; height: 18px; }

        .codex-ticket-no {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.1em;
          color: var(--copper);
          text-align: center;
          margin-bottom: 6px;
        }
        .codex-ticket-img {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          object-fit: cover;
          display: block;
          margin: 0 auto 16px;
          border: 3px solid var(--paper);
          outline: 1px solid var(--border);
        }
        .codex-ticket-name {
          font-family: 'Playfair Display', serif;
          font-weight: 800;
          font-size: 26px;
          text-align: center;
          margin: 0 0 4px;
          line-height: 1.15;
        }
        .codex-ticket-meta {
          text-align: center;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          color: #6B5C48;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 14px;
        }
        .codex-lang-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-bottom: 20px;
        }
        .codex-lang-toggle button {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.06em;
          padding: 4px 12px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: transparent;
          color: #6B5C48;
          cursor: pointer;
        }
        .codex-lang-toggle button.is-active {
          background: var(--copper);
          border-color: var(--copper);
          color: var(--paper);
        }
        .codex-lang-loading {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          color: #8A7A63;
          margin-left: 4px;
        }
        .codex-lang-loading svg {
          animation: spin 0.9s linear infinite;
        }
        .codex-divider {
          border: none;
          border-top: 1px dashed var(--border);
          margin: 18px 0;
        }
        .codex-section-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--copper);
          margin-bottom: 10px;
        }
        .codex-ing-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13.5px;
          padding: 5px 0;
          border-bottom: 1px dotted #D8CBB2;
        }
        .codex-ing-row span:first-child { color: var(--ink); }
        .codex-ing-row span:last-child { color: #6B5C48; text-align: right; }

        .codex-instructions {
          font-size: 13.5px;
          line-height: 1.7;
          color: #40311F;
          font-family: 'Inter', sans-serif;
        }

        .codex-empty {
          text-align: center;
          color: var(--muted);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          margin: 60px 0;
        }
      `}</style>

      <header className="codex-header">
        <div className="codex-eyebrow">TheCocktailDB · Archivo</div>
        <h1 className="codex-title">
          Códice del <em>Cóctel</em>
        </h1>
        <p className="codex-sub">
          Un catálogo de recetas clásicas y modernas. Busca por nombre, filtra
          por categoría, o deja que el bartender elija por ti.
        </p>

        <div className="codex-controls">
          <div className="codex-search">
            <Search />
            <input
              type="text"
              placeholder={
                lang === "es"
                  ? "Busca un trago"
                  : "Search a drink"
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCategory("");
              }}
            />
          </div>
          <select
            className="codex-select"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setQuery("");
            }}
          >
            <option value="">
              {lang === "es" ? "Todas las categorías" : "All categories"}
            </option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {lang === "es" ? translateCategory(c) : c}
              </option>
            ))}
          </select>
          <button className="codex-shuffle" onClick={shuffle}>
            <Shuffle />
            {lang === "es" ? "Elección del barman" : "Bartender's choice"}
          </button>
          <div className="codex-lang-toggle-header">
            <button
              className={lang === "es" ? "is-active" : ""}
              onClick={() => setLang("es")}
            >
              ES
            </button>
            <button
              className={lang === "en" ? "is-active" : ""}
              onClick={() => setLang("en")}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {loading && (
        <div className="codex-status">
          <Loader2 size={15} /> Sirviendo el catálogo...
        </div>
      )}
      {!loading && error && <div className="codex-error">{error}</div>}
      {!loading && !error && drinks.length === 0 && (
        <div className="codex-empty">
          Ningún trago coincide con esa búsqueda. Prueba con otro nombre.
        </div>
      )}

      {!loading && !error && drinks.length > 0 && (
        <div className="codex-grid">
          {drinks.map((d) => (
            <button
              key={d.idDrink}
              className="codex-card"
              onClick={() => openDrink(d)}
            >
              <img
                src={`${d.strDrinkThumb}/preview`}
                alt={d.strDrink}
                loading="lazy"
              />
              <div className="codex-card-body">
                <p className="codex-card-name">{d.strDrink}</p>
                <div className="codex-card-tags">
                  {(d.strAlcoholic || d.strCategory) && (
                    <span className="codex-card-tag">
                      {lang === "es"
                        ? translateAlcoholic(d.strAlcoholic) ||
                          translateCategory(d.strCategory)
                        : d.strAlcoholic || d.strCategory}
                    </span>
                  )}
                  {d.strCategory && (
                    <span className="codex-card-tag is-muted">
                      {lang === "es" ? translateCategory(d.strCategory) : d.strCategory}
                    </span>
                  )}
                  {d.strGlass && (
                    <span className="codex-card-tag is-muted">
                      {lang === "es" ? translateGlass(d.strGlass) : d.strGlass}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {(selected || selectedLoading) && (
        <div
          className="codex-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div className="codex-ticket">
            <div className="codex-ticket-torn" />
            <div className="codex-ticket-inner">
              <button
                className="codex-ticket-close"
                onClick={() => setSelected(null)}
                aria-label="Cerrar receta"
              >
                <X />
              </button>

              {selectedLoading && !selected ? (
                <div
                  className="codex-status"
                  style={{ color: "#6B5C48", margin: "60px 0" }}
                >
                  <Loader2 size={15} /> Preparando la receta...
                </div>
              ) : (
                selected &&
                (() => {
                  const t = translations[selected.idDrink];
                  const useEs = lang === "es" && t;
                  const ingredients = useEs
                    ? t.ingredients
                    : extractIngredients(selected);
                  const instructions = useEs
                    ? t.instructions
                    : selected.strInstructions;
                  const meta =
                    lang === "es"
                      ? `${translateCategory(selected.strCategory)} · ${translateGlass(
                          selected.strGlass
                        )} · ${translateAlcoholic(selected.strAlcoholic)}`
                      : `${selected.strCategory} · ${selected.strGlass} · ${selected.strAlcoholic}`;
                  return (
                    <>
                      <div className="codex-ticket-no">
                        Ticket No. {selected.idDrink}
                      </div>
                      <img
                        className="codex-ticket-img"
                        src={selected.strDrinkThumb}
                        alt={selected.strDrink}
                      />
                      <h2 className="codex-ticket-name">{selected.strDrink}</h2>
                      <div className="codex-ticket-meta">
                        {meta}
                        {lang === "es" && translating && !t && (
                          <span className="codex-lang-loading">
                            <Loader2 size={12} /> traduciendo...
                          </span>
                        )}
                      </div>

                      <hr className="codex-divider" />

                      <div className="codex-section-label">
                        {lang === "es" ? "Ingredientes" : "Ingredients"}
                      </div>
                      {ingredients.map((item, i) => (
                        <div className="codex-ing-row" key={i}>
                          <span>{item.ing}</span>
                          <span>
                            {item.measure || (lang === "es" ? "al gusto" : "to taste")}
                          </span>
                        </div>
                      ))}

                      <hr className="codex-divider" />

                      <div className="codex-section-label">
                        {lang === "es" ? "Preparación" : "Instructions"}
                      </div>
                      <p className="codex-instructions">{instructions}</p>
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}