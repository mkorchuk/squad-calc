/**
 * Squad map definitions.
 *
 * `sizeX` / `sizeY` are the real in-game dimensions in meters, derived from the
 * SDK minimap corners (corner1 - corner0) used by the original SquadCalc.
 * `image` points to the locally bundled basemap under /public/maps.
 *
 * Source of corner data & imagery: https://github.com/sh4rkman/SquadCalc
 * (imagery © OWI / SquadCalc — bundled here for personal use).
 */
export interface MapDefinition {
  id: string;
  name: string;
  image: string;
  sizeX: number;
  sizeY: number;
}

interface RawMap {
  id: string;
  name: string;
  corner0: [number, number];
  corner1: [number, number];
}

const RAW_MAPS: RawMap[] = [
  { id: "albasrah", name: "Al Basrah", corner0: [-2000, -2000], corner1: [2000, 2000] },
  { id: "anvil", name: "Anvil", corner0: [-2040, -2040], corner1: [1020, 1020] },
  { id: "blackcoast", name: "Black Coast", corner0: [-2299, -2127], corner1: [2299, 2472] },
  { id: "chora", name: "Chora", corner0: [-2464, -2664], corner1: [1600, 1400] },
  { id: "fallujah", name: "Fallujah", corner0: [-1315, -1545], corner1: [1690, 1460] },
  { id: "foolsroad", name: "Fool's Road", corner0: [-1326, -1326], corner1: [448, 448] },
  { id: "goosebay", name: "Goose Bay", corner0: [-2016, -2016], corner1: [2015, 2015] },
  { id: "gorodok", name: "Gorodok", corner0: [-2032, -2032], corner1: [2032, 2032] },
  { id: "harju", name: "Harju", corner0: [-2016, -2016], corner1: [2016, 2016] },
  { id: "jensen", name: "Jensen's Range", corner0: [-2004, -2004], corner1: [2004, 2004] },
  { id: "kamdesh", name: "Kamdesh", corner0: [-2016, -2016], corner1: [2016, 2016] },
  { id: "kohat", name: "Kohat", corner0: [-2300, -2300], corner1: [2317, 2317] },
  { id: "kokan", name: "Kokan", corner0: [-1076, -1076], corner1: [1420, 1420] },
  { id: "lashkar", name: "Lashkar Valley", corner0: [-2167, -2167], corner1: [2167, 2167] },
  { id: "logar", name: "Logar Valley", corner0: [-881, -1132], corner1: [880, 629] },
  { id: "manicouagan", name: "Manicouagan", corner0: [-2016, -2016], corner1: [2015, 2015] },
  { id: "mestia", name: "Mestia", corner0: [-1200, -1100], corner1: [1200, 1300] },
  { id: "mutaha", name: "Mutaha", corner0: [-935, -1140], corner1: [1820, 1615] },
  { id: "narva", name: "Narva", corner0: [-1390, -1402], corner1: [1410, 1398] },
  { id: "pacific", name: "Pacific Proving Grounds", corner0: [-2016, -2016], corner1: [2016, 2016] },
  { id: "sanxian", name: "Sanxian Islands", corner0: [-2300, -2050], corner1: [2300, 2550] },
  { id: "skorpo", name: "Skorpo", corner0: [-3611, -3293], corner1: [3238, 3576] },
  { id: "sumari", name: "Sumari Bala", corner0: [-640, -447], corner1: [660, 853] },
  { id: "tallil", name: "Tallil Outskirts", corner0: [-2340, -2340], corner1: [2340, 2340] },
  { id: "yehorivka", name: "Yehorivka", corner0: [-3302, -3302], corner1: [3048, 3048] },
];

export const MAPS: MapDefinition[] = RAW_MAPS.map((m) => ({
  id: m.id,
  name: m.name,
  image: `/maps/${m.id}.webp`,
  sizeX: m.corner1[0] - m.corner0[0],
  sizeY: m.corner1[1] - m.corner0[1],
}));

export const DEFAULT_MAP_ID = MAPS[0].id;

export function getMap(id: string): MapDefinition {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}
