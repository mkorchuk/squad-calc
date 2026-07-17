# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This app (internally "SquadCalc Lite" in code/package name) is a stripped-down mortar/target planner inspired by [SquadCalc](https://github.com/sh4rkman/SquadCalc), rebuilt from scratch with only the essentials: map selection, mortar/target placement with a firing solution readout (including heightmap-based elevation), and browser-persisted sessions. It intentionally omits SquadCalc's weapon picker, factions, and servers browser.

## Commands

```bash
npm install
npm run fetch-maps   # one-time: downloads basemap.webp for all 25 maps into public/maps/ (gitignored)
npm run dev           # Vite dev server, http://localhost:5173
npm run build          # tsc -b (typecheck) && vite build
npm run preview        # serve the production build locally
```

There is no lint or test script configured. `npm run build` is the only correctness gate (typecheck + bundling); run it after any change.

## Architecture

**Stack:** React 18 + TypeScript + Vite, Leaflet via `react-leaflet` with `CRS.Simple` (flat, non-geographic coordinates), zustand (+`persist`) for state.

### The core trick: 1 Leaflet unit = 1 in-game meter

Each map's image overlay is placed via `boundsFor()`/`latLngBoundsFor()` in [src/lib/mapBounds.ts](src/lib/mapBounds.ts) as `[[0,0], [-sizeY, sizeX]]`, where `sizeX`/`sizeY` are the map's real in-game dimensions in meters (from [src/data/maps.ts](src/data/maps.ts)). This means a marker's Leaflet `{lat, lng}` *is* its position in game meters (lng = east meters, lat = -(south meters)), so [src/lib/ballistics.ts](src/lib/ballistics.ts) can do distance/bearing/elevation math directly on marker coordinates with no separate scale factor. This differs from upstream SquadCalc, which uses a `pixelSize`/`mapToGameScale` indirection — don't reintroduce that unless there's a reason to.

### Altitude / heightmaps

Firing elevation accounts for terrain height difference ("Deducing Altitude", matching SquadCalc). Each map has a 500×500 grid of terrain heights in meters, bundled at `public/maps/<id>.height.json` by `npm run fetch-maps` (from SquadCalc's `heightmap.json`). [src/lib/heightmap.ts](src/lib/heightmap.ts) loads/caches a grid and `sampleHeight()` reads it; a coordinate in meters maps to a cell by `500 / mapSizeMeters` and out-of-bounds returns 0 — the exact sampling SquadCalc uses, so altitudes match. [src/hooks/useHeightmap.ts](src/hooks/useHeightmap.ts) loads the active map's grid (ignoring stale loads on map switch). `TargetMarker` computes `heightDiff = height(target) − height(mortar)` and passes it to `getElevation`. If a map has no heightmap the fetch 404s, `sampleHeight` returns 0, and elevation falls back to flat terrain.

### Data flow

- [src/data/maps.ts](src/data/maps.ts) — static list of all 25 Squad maps (id, name, image path, size in meters, derived from SquadCalc's SDK corner data). `getMap(id)` looks one up.
- [src/data/weapons.ts](src/data/weapons.ts) — ballistics constants (`STANDARD_MORTAR`: velocity, gravity, min distance, height offset). Add more `Weapon` entries here if a weapon picker is ever added; nothing else needs to change since `ballistics.ts` takes a `Weapon` argument.
- [src/lib/ballistics.ts](src/lib/ballistics.ts) — pure functions: `getDistance`, `getBearing` (0-360°, north=0), `getElevation` (returns `{ deg, mil, inRange }`), `getMaxRange`. No React/Leaflet dependencies; safe to unit test directly.
- [src/store/useAppStore.ts](src/store/useAppStore.ts) — single zustand store, persisted to `localStorage` under key `squadcalc-lite`. Holds `sessions[]`, `activeSessionId`, `placementMode` ("mortar" | "target"). All session mutations go through `updateActive()`, which immutably updates only the currently active session. Switching a session's map (`setMapId`) clears its mortar/targets, since coordinates are map-relative and stale on a different map.
- [src/store/types.ts](src/store/types.ts) — `Session`, `MortarMark`, `TargetMark`, `PlacementMode`.

### Components

- [src/components/Layout.tsx](src/components/Layout.tsx) — top-level shell: sidebar + map area.
- [src/components/MapSelector.tsx](src/components/MapSelector.tsx) — top-right map `<select>`; confirms before switching if the active session has marks (they'll be cleared).
- [src/components/sidebar/](src/components/sidebar/) — `SessionList` + `SessionItem` (rename inline, delete, select, add, save-to-file, import-from-file). The rename `<input>` is deliberately narrow (`.session-item__name`, fixed width) so most of the row hits the outer `onClick` (select session) rather than the input; only clicking the input itself enters rename mode.
- [src/lib/sessionFile.ts](src/lib/sessionFile.ts) — session ⇄ JSON file round-trip (`downloadSession`, `readSessionFile`/`parseSessionFile`). File format is `{ format: "squadcalc-session", version, name, mapId, mortar, targets }`; validated on import (unknown `mapId` falls back to the default map, malformed points are dropped) and imported as a brand-new session with fresh ids via `importSession` in the store.
- [src/components/map/MapView.tsx](src/components/map/MapView.tsx) — the `MapContainer`; renders the image overlay, grid, and markers for the active session. `MapController` (inner component) handles click-to-place (mortar or target depending on `placementMode`) and re-fits bounds when the map changes.
- [src/components/map/MapGrid.tsx](src/components/map/MapGrid.tsx) — draws the Squad keypad grid (300m major lines + 100m sub-lines, A/B/C... column and 1/2/3... row labels) for whichever map is active, matching SquadCalc's `squadGrid.js` scheme. Rendered into a dedicated Leaflet `Pane` (`zIndex: 450`) so it sits above the map image (400) but below markers (600).
- [src/components/map/MortarMarker.tsx](src/components/map/MortarMarker.tsx) / [TargetMarker.tsx](src/components/map/TargetMarker.tsx) — draggable markers. Target markers compute their firing solution live (including during drag, via a `drag` event handler that patches the label DOM directly for performance) and show mil/bearing on the map plus a fuller popup with distance/elevation. Right-click removes a marker (mortar or target) via `contextmenu` handlers; `L.DomEvent.preventDefault` suppresses the native context menu.
- [src/components/map/markerIcons.ts](src/components/map/markerIcons.ts) — builds the Leaflet `DivIcon`s for both marker types (mortar pin with an inline SVG glyph; target ring + floating mil/bearing label).
- [src/styles/theme.css](src/styles/theme.css) — single global stylesheet (grey/dark-blue theme), including Leaflet control overrides (zoom control is disabled; cursor is a crosshair over the map).

### Live streaming (spectator links)

A host can broadcast the active session live to a read-only spectator link via **Firebase Realtime Database** (project `squadcalc`, instance `squadcalc-default-rtdb`, us-central1). The `firebase` web SDK config lives in [src/lib/firebase.ts](src/lib/firebase.ts) (apiKey is public, not a secret; access is governed by RTDB rules). RTDB rules are in [database.rules.json](database.rules.json) — each `rooms/$roomId` is **publicly read+write** (MVP; no auth). `npm run deploy` is hosting-only, so rules must be pushed separately with `firebase deploy --only database`.

- [src/lib/stream.ts](src/lib/stream.ts) — `publishStream` (host overwrites `rooms/{roomId}` with `{ mapId, mortar, targets, shapes, updatedAt }`), `subscribeStream` (viewer `onValue`; empty arrays come back absent from RTDB, so targets/shapes default to `[]`), `removeStream` (explicit Stop), `removeRoomOnDisconnect` (`onDisconnect().remove()` so a closed/reloaded host tab clears the room and spectators see "stream ended"). Build the synced object explicitly — RTDB rejects the whole write on any `undefined`.
- [src/store/useStreamStore.ts](src/store/useStreamStore.ts) — tiny **non-persisted** zustand store holding `roomId` (a reload ends the stream rather than resurrecting a dead room). Kept out of `useAppStore` so persistence isn't affected.
- [src/hooks/useStreamPublisher.ts](src/hooks/useStreamPublisher.ts) — host-side; called from `Layout`. Republishes on every active-session change while streaming; registers `onDisconnect` cleanup once per room.
- [src/components/StreamButton.tsx](src/components/StreamButton.tsx) — the toolbar "Stream" button. First click starts a stream and shows a `position: fixed` "Tap to copy link" popup (10s auto-hide) with a Stop action; link is `${origin}/?watch=${roomId}`. Clipboard write can fail in unfocused/insecure contexts — it's caught and the popup stays open.
- [src/components/watch/WatchView.tsx](src/components/watch/WatchView.tsx) — the spectator view. [App.tsx](src/App.tsx) renders it instead of `Layout` when `?watch=<roomId>` is present. Subscribes to the room and renders a non-interactive map (reusing `markerIcons`, `ShapeLayer`, `MapGrid`, `ballistics`, `useHeightmap`) — no sidebar/toolbar, no placement. Recomputes each target's mil/bearing from the streamed mortar+heightmap. Shows "Connecting…" until first snapshot and "stream isn't live" when the room is gone.

### Map imagery

Basemap `.webp` images and `heightmap.json` files are fetched from `https://squadcalc.app/api/img/maps/<id>/` by [scripts/fetch-maps.mjs](scripts/fetch-maps.mjs) into `public/maps/` as `<id>.webp` and `<id>.height.json` (both gitignored, © OWI/SquadCalc — see README credits). Heights are rounded to 0.1m to roughly halve file size. Run `npm run fetch-maps` after a fresh clone or `npm install`; the dev server will otherwise show broken map images and fall back to flat-terrain elevation.
