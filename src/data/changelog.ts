/**
 * User-facing release notes, newest first. Add an entry here (and bump
 * APP_VERSION in src/version.ts) whenever a change is worth surfacing —
 * the same bar as the version bump itself, not every commit.
 */
export interface ChangelogEntry {
  version: string;
  title: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v1.8",
    title: "Stream matches your display settings (minor update)",
    changes: [
      "The /live display and the share link now mirror your planner's target-label font size, map grid opacity, and mortar spread toggle, instead of each screen using its own defaults. Change a slider on the planning PC and the second screen follows.",
    ],
  },
  {
    version: "v1.7",
    title: "Shape colours, deletion & changelog",
    changes: [
      "Drawn shapes can be coloured: the right-click Draw menu now has a palette above the shape list. The colour applies to the next shape you draw and sticks until you change it.",
      "Right-clicking a drawn shape's outline now deletes it, the same way right-clicking a marker removes it. Right-clicking empty map still opens the Draw menu.",
      "The cursor turns into a hand over a shape's outline, so you can see what's about to be deleted.",
      "The 1/2/3 target-tool hotkeys keep working while the sidebar is hidden, and a badge under the open-sidebar arrow briefly names the tool you switched to.",
      "Added this changelog, opened from the button at the bottom of the sidebar.",
      "Faster first load — the streaming code is now downloaded only when you actually stream, cutting about a third off the initial download.",
      "Smoother sliders and renaming, which no longer re-save every session on each frame or keystroke.",
      "Switching maps now warns you when the session only contains drawn shapes (they get cleared too), and deleting a session with marks in it asks first.",
    ],
  },
  {
    version: "v1.6",
    title: "Live display screen",
    changes: [
      "Replaced share-link-only streaming with a dedicated /live display page: pressing Stream shows a 6-digit code you type on the /live screen to mirror the map.",
      "The share link is still available from the Stream popup for spectators elsewhere.",
      "Throttled the publisher, so dragging a marker no longer rewrites the whole room every frame.",
      "Fixed shapes being lost: switching maps clears them along with the mortar and targets, and saved session files round-trip them instead of dropping them.",
      "Map imagery now comes from our own hosting mirror.",
    ],
  },
  {
    version: "v1.5",
    title: "Mortar spread",
    changes: [
      "Added the mortar spread (dispersion) radius as a circle around each target, with a sidebar toggle.",
      "The Space tool sizes its spacing from the spread radius, so placed targets tile to cover the area with no gaps.",
      "Added a target label font size slider (50%–100%).",
    ],
  },
  {
    version: "v1.4",
    title: "Live sharing",
    changes: [
      "Added live sharing: a link that opens a read-only page showing the mortar and targets in real time.",
    ],
  },
  {
    version: "v1.3",
    title: "Drawing shapes",
    changes: [
      "Right-clicking the map opens a Draw menu with three shapes — line, circle and square — drawn by dragging.",
    ],
  },
  {
    version: "v1.2",
    title: "UI pass",
    changes: [
      "Added the version tag next to the SquadCalc name and cleaned up the sidebar layout.",
    ],
  },
  {
    version: "v1.1",
    title: "Tools & deployment",
    changes: [
      "Deployed the app publicly.",
      "Added the target tool picker (Single, Line, Space) with 1/2/3 hotkeys.",
      "Added a proper loading card while a map's imagery and heightmap load.",
    ],
  },
  {
    version: "v1.0",
    title: "First release",
    changes: [
      "Map selection, mortar and target placement with a live firing solution (distance, bearing, mil elevation).",
      "Heightmap-based elevation, so firing solutions account for terrain height difference.",
      "Sessions persisted in the browser, plus save-to-file and import-from-file.",
    ],
  },
];
