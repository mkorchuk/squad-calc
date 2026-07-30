import L from "leaflet";

/** White mortar-launcher glyph shown inside the blue pin. */
const MORTAR_SVG = `
<svg viewBox="0 0 24 24" width="12" height="12" fill="none"
     stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <line x1="16.5" y1="6" x2="8" y2="16.5" />
  <line x1="4.5" y1="18.5" x2="12" y2="18.5" />
  <line x1="10" y1="13" x2="13.5" y2="15.5" />
</svg>`;

/** Blue teardrop pin with a mortar icon; anchored at its pointed tip. */
export const mortarIcon: L.DivIcon = L.divIcon({
  className: "",
  html: `<div class="marker-pin marker-pin--mortar">
           <div class="marker-pin__glyph">${MORTAR_SVG}</div>
         </div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -24],
});

export interface TargetLabel {
  mil: number | null; // null => no mortar placed / out of range
  bearing: number | null;
}

/**
 * Red ring with an optional firing-data label to its left (elevation mil on top,
 * bearing below). No index number.
 */
export function targetIcon(label: TargetLabel): L.DivIcon {
  const hasLabel = label.bearing !== null;
  const milText = label.mil !== null ? String(Math.round(label.mil)) : "∞";
  const bearingText = label.bearing !== null ? `${label.bearing.toFixed(1)}°` : "";

  const labelHtml = hasLabel
    ? `<div class="target-marker__label">
         <span class="target-marker__mil">${milText}</span>
         <span class="target-marker__bearing">${bearingText}</span>
       </div>`
    : "";

  return L.divIcon({
    className: "",
    html: `<div class="target-marker">
             ${labelHtml}
             <span class="target-marker__ring"></span>
           </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -8],
  });
}
