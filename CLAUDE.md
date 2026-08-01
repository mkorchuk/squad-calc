# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Keeping this file current

Update this file as part of any change that makes it wrong or incomplete — a new feature, a new store field, a new component/module, a changed command, or a non-obvious gotcha worth knowing next time. Do it in the same turn as the change, without being asked, and mention it in the summary. Skip it only for changes fully described by what's already here (a bug fix inside an existing component, a style tweak). Don't turn it into a changelog: edit the section the change belongs to, and keep the "why" that isn't obvious from the code.

## What this is

This app (internally "SquadCalc Lite" in code/package name) is a stripped-down mortar/target planner for Squad, with only the essentials: map selection, mortar/target placement with a firing solution readout (including heightmap-based elevation), and browser-persisted sessions. It intentionally omits extras like a weapon picker, factions, and a servers browser.

## Commands

```bash
npm test             # vitest, one pass (npm run test:watch to leave it running)
npm run fetch-maps   # one-time: downloads the basemap + heightmap for all 25 maps into public/maps/ (gitignored)
npm run verify-maps  # checks every map this app knows about is actually present on the mirror
npm run deploy       # fetch-maps + build + firebase deploy --only hosting,database (https://squadcalc.web.app)
```

No lint script. `npm run build` (typecheck + bundling) and `npm test` are the correctness gates; run both after any change.

### Tests

Vitest, colocated as `src/lib/*.test.ts`, no config of its own — it picks up `vite.config.ts`, runs in the default node environment, and `tsconfig`'s `include: ["src"]` means `npm run build` typechecks the tests too.

Only the **pure** modules are covered — [ballistics.ts](src/lib/ballistics.ts), [targetFill.ts](src/lib/targetFill.ts), [shapeHit.ts](src/lib/shapeHit.ts) — because they're the parts with real logic and no React/Leaflet/DOM to stand up. Nothing else in the repo is machine-tested; a green `npm test` says nothing about the UI.

Two things worth knowing before editing them:

- `ballistics.test.ts` checks firing solutions against an **independent** trajectory simulation (`landingDistance`), not against hardcoded expected angles — so it catches a wrong solution rather than just a changed one. It deliberately asserts the *high-angle* branch (elevation falls as range grows, always >45°); the low-angle solution also lands on target and would pass a naive round-trip check.
- `shapeHit.test.ts` fakes the map with `mapAtScale(px-per-metre)` instead of standing up a real Leaflet map. That's what lets it assert the property that matters: the hit tolerance is in **screen pixels**, so the same ground offset hits when zoomed out and misses when zoomed in.

### Bundle shape

`vite.config.ts` splits `react` and `leaflet` into their own chunks (matched on module id — the by-package-name form leaves react's real `react/cjs/*` code in whichever chunk imports it first). Firebase is **not** in that list on purpose: [src/lib/firebase.ts](src/lib/firebase.ts) imports the SDK dynamically, so rollup emits it as a chunk only streaming ever fetches. Initial JS is ~112KB gzip; the deferred firebase chunks are another ~57KB. A stray top-level `import … from "firebase/database"` anywhere in `src/` silently undoes that for every visitor — if the eager `index-*.js` chunk grows by ~200KB, that's what happened.

### Before starting the dev server

`npm run dev` hands the work to the user for manual testing, so it's the point of no return for review. Before running it — or before telling the user to try something in the browser — do all of this:

1. Run `npm run build` and `npm test`. A typecheck failure means the dev server would only show a stale or broken bundle.
2. `git diff` the change and read it back against what the user actually asked for, not against what you set out to build. Watch specifically for: requirements dropped partway through a multi-step change, extra behaviour invented along the way, and edits left half-applied after a change of approach.
3. Trace each new or changed piece of state through every place that touches it. This repo's real bugs have all been *omissions* rather than broken logic — a session field cleared in one place but not another, saved but never restored — and a typecheck can't catch a missing case.
4. Say plainly what you verified and what you didn't. "Builds, tests pass and the code matches the request; I haven't exercised the UI" is the honest answer for almost every change here — the test suite covers three pure modules and nothing else.

Never report a feature as working on the strength of a green build alone.

## Architecture

**Stack note:** Leaflet runs with `CRS.Simple` (flat, non-geographic coordinates); zustand state is wrapped in `persist`.

### The core trick: 1 Leaflet unit = 1 in-game meter

Each map's image overlay is placed via `boundsFor()`/`latLngBoundsFor()` in [src/lib/mapBounds.ts](src/lib/mapBounds.ts) as `[[0,0], [-sizeY, sizeX]]`, where `sizeX`/`sizeY` are the map's real in-game dimensions in meters (from [src/data/maps.ts](src/data/maps.ts)). This means a marker's Leaflet `{lat, lng}` *is* its position in game meters (lng = east meters, lat = -(south meters)), so [src/lib/ballistics.ts](src/lib/ballistics.ts) can do distance/bearing/elevation math directly on marker coordinates with no separate scale factor. Don't reintroduce a `pixelSize`/`mapToGameScale` indirection unless there's a reason to.

### Altitude / heightmaps

Firing elevation accounts for terrain height difference. Each map has a 500×500 grid of terrain heights in meters, bundled at `public/maps/<id>.height.json` by `npm run fetch-maps`. [src/lib/heightmap.ts](src/lib/heightmap.ts) loads/caches a grid and `sampleHeight()` reads it; a coordinate in meters maps to a cell by `500 / mapSizeMeters` and out-of-bounds returns 0 — the same sampling the game uses, so altitudes match. [src/hooks/useHeightmap.ts](src/hooks/useHeightmap.ts) loads the active map's grid (ignoring stale loads on map switch). `TargetMarker` computes `heightDiff = height(target) − height(mortar)` and passes it to `getElevation`. If a map has no heightmap the fetch 404s, `sampleHeight` returns 0, and elevation falls back to flat terrain.

### Data flow

- [src/data/maps.ts](src/data/maps.ts) — static list of all 25 Squad maps (id, name, image path, size in meters, derived from the SDK minimap corner data). `getMap(id)` looks one up.
- [src/data/weapons.ts](src/data/weapons.ts) — ballistics constants (`STANDARD_MORTAR`: velocity, gravity, min distance, height offset). Add more `Weapon` entries here if a weapon picker is ever added; nothing else needs to change since `ballistics.ts` takes a `Weapon` argument.
- [src/lib/ballistics.ts](src/lib/ballistics.ts) — pure firing-solution math. Bearings are 0-360° with north=0. No React/Leaflet dependencies; safe to unit test directly.
- [src/store/useAppStore.ts](src/store/useAppStore.ts) — single zustand store, persisted to `localStorage` under key `squadcalc-lite` via [src/store/persistStorage.ts](src/store/persistStorage.ts), which coalesces writes to one per 300ms (`persist` re-serialises *every* session on *every* state change, so an un-throttled slider drag was a full store write per frame) and flushes on `pagehide`/tab-hide so nothing is lost on close. Holds `sessions[]`, `activeSessionId`, `placementMode` ("mortar" | "target"), plus display/placement settings that aren't part of a session's saved data: `targetTool`, `spacing`, `gridOpacity`, `labelScale`, `showSpread`, `sidebarVisible`, `shapeColor`. All session mutations go through `updateActive()`, which immutably updates only the currently active session. Switching a session's map (`setMapId`) clears its mortar, targets **and shapes**, since all of those are map-relative and stale on a different map.

### Components

- [src/components/MapSelector.tsx](src/components/MapSelector.tsx) — top-right map `<select>`; confirms before switching if the active session has marks (they'll be cleared). "Marks" means mortar **and** targets **and** shapes — anything `setMapId` clears has to be counted here or it's destroyed without a warning.
- [src/components/sidebar/](src/components/sidebar/) — `SessionList` + `SessionItem` (rename inline, delete, select, add, save-to-file, import-from-file). The rename `<input>` is deliberately narrow (`.session-item__name`, fixed width) so most of the row hits the outer `onClick` (select session) rather than the input; only clicking the input itself enters rename mode.
- [src/components/sidebar/ToolPanel.tsx](src/components/sidebar/ToolPanel.tsx) — target tool picker, Spacing field, Spread-radius toggle, and the display sliders: **Map grid → Opacity** and **Target labels → Font size**. The font-size slider drives `labelScale` (`MIN_LABEL_SCALE` 0.5 … `MAX_LABEL_SCALE` 1); 100% is both the default and the maximum, so labels only ever shrink from their base size. `MapView` mirrors it onto the `--label-scale` CSS custom property on the document root, which `.target-marker__mil` / `__bearing` / the label's `top` offset multiply into their `calc()` sizes. It goes on the root, **not** on `MapContainer`'s `style` prop — react-leaflet reads that prop only at mount, so later changes silently do nothing. `useAppStore`'s `onRehydrateStorage` re-clamps `labelScale`, since a persisted value can predate a narrower range.
- [src/lib/sessionFile.ts](src/lib/sessionFile.ts) — session ⇄ JSON file round-trip (`downloadSession`, `readSessionFile`/`parseSessionFile`). File format is `{ format: "squadcalc-session", version, name, mapId, mortar, targets, shapes }`; validated on import (unknown `mapId` falls back to the default map, malformed points and shapes are dropped, an absent `shapes` array means a pre-shapes file rather than an error, and a missing/non-hex shape `color` is dropped rather than failing the shape) and imported as a brand-new session with fresh ids via `importSession` in the store. Shapes are written **without** their ids — the store mints new ones, same as targets.
- [src/components/map/MapView.tsx](src/components/map/MapView.tsx) — the `MapContainer`; renders the image overlay, grid, and markers for the active session. `MapController` (inner component) handles click-to-place (mortar or target depending on `placementMode`) and re-fits bounds when the map changes.
- [src/components/map/MapGrid.tsx](src/components/map/MapGrid.tsx) — draws the Squad keypad grid (300m major lines + 100m sub-lines, A/B/C... column and 1/2/3... row labels) for whichever map is active, matching the in-game grid scheme. Rendered into a dedicated Leaflet `Pane` (`zIndex: 450`) so it sits above the map image (400) but below markers (600). The fine tier is **unmounted** below `FINE_MIN_ZOOM`, not just made transparent — it's hundreds of segments Leaflet would otherwise re-project on every pan and zoom.
- [src/components/map/MortarMarker.tsx](src/components/map/MortarMarker.tsx) / [TargetMarker.tsx](src/components/map/TargetMarker.tsx) — draggable markers. `TargetMarker` is wrapped in `React.memo`: the Space tool can place hundreds, and `updateActive` replaces only the target it touched, so everything else keeps identical props and skips the re-render. Both markers move their own vector layers (mortar range circle, spread ellipse) directly in a `drag` handler, since the store only learns the position on `dragend`. Target markers compute their firing solution live (including during drag, via a `drag` event handler that patches the label DOM directly for performance) and show mil/bearing on the map plus a fuller popup with distance/elevation. Right-click removes a marker (mortar or target) via `contextmenu` handlers; `L.DomEvent.preventDefault` suppresses the native context menu.
- [src/components/map/DrawMenu.tsx](src/components/map/DrawMenu.tsx) / [ShapeLayer.tsx](src/components/map/ShapeLayer.tsx) — right-clicking the map opens the draw menu: a **colour palette** ([src/data/shapeColors.ts](src/data/shapeColors.ts), 6 swatches) above the shape tools (line / rect / circle). A swatch sets the store's `shapeColor` and leaves the menu open (it applies to the shape you're about to pick *and* sticks for later ones); picking a shape arms the tool, and the next left-drag draws it and stores it on the session's `shapes` with that colour baked in. A shape's `color` is **optional** — shapes drawn before colours existed have none and render as `DEFAULT_SHAPE_COLOR` (amber), which is why `shapeStyle()` defaults it rather than assuming it's there. Colours are validated as plain hex (`isHexColor`) wherever they arrive from outside the app — store rehydration, session import — because the value goes straight into an SVG stroke/fill. While a tool is armed, map dragging is disabled so the drag draws instead of panning, and the trailing click after `mouseup` is suppressed so it doesn't also place a target. Shapes render into the `shapes` pane (`zIndex: 455`). **Right-clicking a shape's outline deletes it** (`removeShape`), like right-clicking a marker; the hit test is done in `MapController`'s `contextmenu` handler via `shapeAtPoint` in [src/lib/shapeHit.ts](src/lib/shapeHit.ts) rather than by making the layers interactive — an interactive shape would swallow left-clicks meant for target placement. Only the outline counts (±`SHAPE_HIT_PX`), never the fill, so right-clicking *inside* a rect or circle still opens the draw menu. The same hit test runs on `mousemove` to toggle `map--over-shape` on the map container, swapping the crosshair for a pointer so the deletable outline is discoverable; that CSS rule has to repeat the `svg`/`path`/`.leaflet-grab` selectors to out-specify the base crosshair rule.
- [src/hooks/useToolHotkeys.ts](src/hooks/useToolHotkeys.ts) — the 1/2/3 target-tool hotkeys, and `TOOL_KEYS`, the single source of truth for which key picks which tool. Bound in `Layout`, **not** in `ToolPanel`: the panel unmounts when the sidebar is hidden, which used to take the hotkeys down with it. Any future global hotkey belongs at this level for the same reason.
- [src/components/toolMeta.tsx](src/components/toolMeta.tsx) — each tool's label/icon/hint (`TOOL_META`) plus `metaFor`/`hotkeyFor`, shared by `ToolPanel` and `ToolIndicator` so the picker and the badge can't describe the same tool differently.
- [src/components/map/ToolIndicator.tsx](src/components/map/ToolIndicator.tsx) — the badge under the show-sidebar arrow that names the tool for ~1.6s after it changes. Rendered **only while the sidebar is hidden**, since that's when the picker is off screen and a hotkey press would otherwise have no visible effect. Its `shown` ref is seeded with the tool at mount, so revealing the badge takes an actual tool change rather than just hiding the sidebar.
- [src/components/ChangelogModal.tsx](src/components/ChangelogModal.tsx) / [src/data/changelog.ts](src/data/changelog.ts) — release notes, opened from the Changelog button in `.sidebar__bottom`. Centred dialog over a `backdrop-filter: blur` backdrop; closes on Escape or a backdrop click. `CHANGELOG` is newest-first and the entry matching `APP_VERSION` gets a "current" badge, so **bumping [src/version.ts](src/version.ts) means adding an entry here too**.
- [src/styles/theme.css](src/styles/theme.css) — single global stylesheet (grey/dark-blue theme), including Leaflet control overrides (zoom control is disabled; cursor is a crosshair over the map).

### Live streaming

A host can mirror the active session to another screen, over **Firebase Realtime Database** (project `squadcalc`, instance `squadcalc-default-rtdb`, us-central1). The `firebase` web SDK config lives in [src/lib/firebase.ts](src/lib/firebase.ts) (apiKey is public, not a secret; access is governed by RTDB rules). `firebase()` there **lazily** loads the SDK and memoises the promise, so every call site is async — including `subscribeStream`, which still returns its unsubscribe synchronously because effect cleanups can run before the SDK finishes loading. There are **two viewer paths**, both rendering through the same component:

1. **`/live` — the display screen.** A second PC parks on this fixed URL permanently. Pressing **Stream** on the host shows a **6-digit code**; type it on the `/live` screen and it mirrors the map. This is the primary path.
2. **`?watch=<roomId>` — the share link.** For spectators elsewhere. Reachable from the popup's "Copy share link" once live.

#### The code handshake

The host mints the code, the display consumes it — deliberately, because it needs no discovery, no auth, and no assumptions about the two machines being on the same network. Possession of the code (read off one screen, typed on the other) *is* the whole handshake. An earlier design tried to auto-discover displays by hashing the two machines' public IP into a shared bucket; it was dropped as unreliable — nothing about a browser guarantees two machines on one LAN see the same public IP, and it needed an approval prompt on top to be safe.

[src/lib/streamCode.ts](src/lib/streamCode.ts) owns it. Data model:

- `codes/{code}` — `{ roomId, createdAt }`. Six digits, digits-only so it's unambiguous read aloud. Claimed with `runTransaction` so two hosts starting at the same moment can't share a code; removed on Stop and by `onDisconnect`; any entry older than 12h can be re-claimed.
- `rooms/{roomId}` — unchanged, plus a `sessionName` field for the viewer banner.

#### Files

- [src/lib/stream.ts](src/lib/stream.ts) — `publishStream` (host overwrites `rooms/{roomId}`), `subscribeStream` (viewer `onValue`; empty arrays come back absent from RTDB, so targets/shapes default to `[]`), `removeStream`, `removeRoomOnDisconnect`. Build every synced object explicitly — RTDB rejects the whole write on any `undefined`; that's what `toWireShape` is for, since a shape's `color` is optional. The RTDB rules don't constrain the keys *inside* a shape, so adding a shape field needs no rules change.
- [src/store/useStreamStore.ts](src/store/useStreamStore.ts) — **non-persisted** host state: `off → starting → live` (plus `error`). `start()` mints a room id, claims a code, and arms `onDisconnect` on the code; `stop()` removes both the room and the code. Not persisted, so a host reload ends the stream rather than resurrecting a dead room.
- [src/hooks/useStreamPublisher.ts](src/hooks/useStreamPublisher.ts) — publishes only while `phase === "live"`, **throttled to ~200ms** with a trailing write. Dragging a marker mutates the session every mousemove and each publish is a full room overwrite, so the unthrottled version was a per-frame multi-KB write.
- [src/hooks/useLiveDisplay.ts](src/hooks/useLiveDisplay.ts) — the `/live` controller: `idle → joining → connecting → live`, plus `ended`/`error`. The resolved `roomId` and code live in **`sessionStorage`**, so F5 on the display resumes the stream while genuinely reopening `/live` starts from the code prompt. A 15s grace window covers a host reload before it gives up and shows "Stream ended".
- [src/components/live/LiveDisplayView.tsx](src/components/live/LiveDisplayView.tsx) — the `/live` page. The code entry is **one real input rendered invisibly over six presentational boxes** (`.live__code-char`), which keeps paste, mobile keyboards and autofill working while still looking like separate digits; the boxes are `pointer-events: none` so clicks land on the input. Typing the sixth digit submits — no Enter needed.
- [src/components/StreamButton.tsx](src/components/StreamButton.tsx) / [src/components/stream/StreamPopup.tsx](src/components/stream/StreamPopup.tsx) — the toolbar button and its dropdown, which shows the join code, the share link, and Stop.
- [src/components/watch/StreamMap.tsx](src/components/watch/StreamMap.tsx) — the shared read-only renderer (map image, grid, shapes pane, mortar/target markers, spectator-side mil/bearing recomputation). Callers own their loading/empty states so `useHeightmap` never sits behind an early return. [WatchView.tsx](src/components/watch/WatchView.tsx) and `LiveDisplayView` both render it, so the two viewer paths can't drift apart.
- [App.tsx](src/App.tsx) — checks `?watch=` **first** (so `/live?watch=…` still spectates a specific room), then `/live` by pathname. Both work in dev and in production because Vite's SPA mode and the Firebase hosting rewrite each serve `index.html` for unknown paths.

RTDB rules are in [database.rules.json](database.rules.json). Still no auth, so they do structural validation and key-shape restriction rather than authorization: `rooms/` and `codes/` are each scoped, `$other` children are rejected, and nothing is granted above those paths. `npm run deploy` pushes `hosting,database` together so rules ship with the app; **if you change the rules, they must be live before the feature works** — the app talks to production RTDB even from `npm run dev`.

### Map imagery

Each map needs two files in `public/maps/` (both gitignored, © OWI — see README credits): `<id>.webp` (basemap) and `<id>.height.json` (500×500 height grid, rounded to 0.1m to roughly halve the size). Run `npm run fetch-maps` after a fresh clone or `npm install`; the dev server will otherwise show broken map images and fall back to flat-terrain elevation.

**The assets are mirrored on our own Firebase Hosting**, at `https://squadcalc.web.app/maps/<id>.webp` — there is no third-party upstream. (Firebase *Storage* is not an option: the bucket is unprovisioned and, for a project of this vintage, Cloud Storage requires the Blaze plan while this project is on Spark. Hosting already serves the files for free.) Override the mirror with the `MAPS_MIRROR` env var to point at a preview channel, a custom domain, or a future bucket — nothing else needs changing.

The bootstrap is **circular but self-sustaining**: `public/maps` → `dist/maps` (vite copies `public/` verbatim) → Hosting (`firebase deploy`) → `public/maps` (`fetch-maps` on the next clone). So **at least one successful deploy must exist before a fresh clone can bootstrap**. `fetch-maps` never overwrites or deletes a file already present locally, so a bad mirror can't clobber a good local copy — but the 88MB `public/maps` is still worth keeping an offline backup of, since it is both the source and the product of the mirror.

Two gotchas worth not rediscovering:

- **A missing asset returns `200 text/html`, not `404`.** `firebase.json` rewrites `**` → `/index.html`, so an absent map serves a ~400-byte HTML page with a success status. `fetchAsset`/`headAsset` in [scripts/mapAssets.mjs](scripts/mapAssets.mjs) therefore validate `content-type`, not just `res.ok` — without that, `fetch-maps` writes the HTML page over the map. Don't "simplify" it back to an `res.ok` check.
- **Don't call `process.exit()` in these scripts.** Exiting while fetch's keep-alive sockets are open trips a libuv assertion on Windows and reports 127 instead of 1. Set `process.exitCode` and let Node drain.

[scripts/mapAssets.mjs](scripts/mapAssets.mjs) holds what `fetch-maps` and `verify-maps` share: the mirror base, the asset kinds, the fetch/head helpers and a 6-way concurrency pool (a full 88MB bootstrap takes ~9s). The map id list is **derived from `MAPS` in [src/data/maps.ts](src/data/maps.ts)** — the scripts import the `.ts` directly, relying on Node's native type stripping (needs **Node ≥ 22.18**), so adding a map means editing one file. If that ever breaks, fall back to a hardcoded id list.

The `/maps/**` `Cache-Control` in `firebase.json` is `max-age=31536000, immutable`. The filenames are *not* content-hashed, so if a map's imagery is ever replaced under the same name, returning visitors keep the stale copy for up to a year — rename the file or drop the max-age before deploying such a replacement.

### Adding a new map

The mirror can only serve maps it has already been deployed, so a new map is sourced by hand exactly once:

1. Add the entry to `RAW_MAPS` in [src/data/maps.ts](src/data/maps.ts) (`id`, `name`, `corner0`, `corner1` from the SDK minimap corners). This is the only id list.
2. Put `<id>.webp` and `<id>.height.json` into `public/maps/` manually (heightmap: 500×500 grid of metre heights, rounded to 0.1m to match the others).
3. `npm run build`, then check the map appears in the selector and the elevation readout is non-zero on slopes.
4. `npm run deploy` — `fetch-maps` skips the files (already present locally) and the deploy publishes them to the mirror. If you skip step 2, `fetch-maps` hard-fails with exit 1 and names the missing files rather than shipping a broken map.
5. `npm run verify-maps` — confirms the new map is mirrored, so the next clone can bootstrap it.
