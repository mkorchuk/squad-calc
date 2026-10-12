# SquadCalc

A stripped-down mortar/target planner for Squad.

## Features

- All Squad maps, selectable from the top-right dropdown.
- Two weapons, selectable from the dropdown next to the map one: the standard **Mortar** and
  the **Hell Cannon**.
- Place the **weapon** (blue) and **targets** (red) by clicking the map. Markers are draggable.
- Each target shows **bearing**, **distance**, and firing **elevation** in the unit the weapon's
  sight reads (mil for the Mortar, degrees for the Hell Cannon). Elevation accounts for
  **terrain altitude** (heightmap-based); popups show each mark's altitude.
- **Sessions** in the left sidebar — each keeps its own map, weapon and marks, persisted in the browser
  (`localStorage`). Each session can be **saved to a `.json` file** and **imported** back later
  (or shared with someone else) via the sidebar buttons.

## Getting started

```bash
npm install
npm run fetch-maps   # one-time: downloads map imagery into public/maps/
npm run dev
```

Open the printed URL (default http://localhost:5173).

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — typecheck + production build
- `npm run fetch-maps` — download the map basemaps and heightmaps

## Tech

React + TypeScript + Vite, Leaflet (`CRS.Simple`) via react-leaflet, zustand for state.

## Architecture (for extending)

- `src/data/maps.ts` — map list + real in-game dimensions (meters).
- `src/data/weapons.ts` — ballistics constants per weapon (add more to `WEAPONS` here).
- `src/lib/ballistics.ts` — pure distance/bearing/elevation math.
- `src/lib/mapBounds.ts` — places the map image in a meter-based coordinate space.
- `src/store/` — zustand store + types (sessions, marks, placement mode).
- `src/components/` — layout, map view + markers, sidebar, map selector.

The map overlay is placed so 1 Leaflet unit = 1 in-game meter, letting the ballistics
functions work directly on marker coordinates. Terrain altitude comes from a bundled
500×500 heightmap per map (`src/lib/heightmap.ts`), sampled the same way the game does so
the firing elevation matches.

## Credits

Map imagery and ballistics data derive from the game (© OWI). Bundled here for personal use.
