export interface TargetMark {
  id: string;
  lat: number;
  lng: number;
}

export interface MortarMark {
  lat: number;
  lng: number;
}

export interface Session {
  id: string;
  name: string;
  mapId: string;
  mortar: MortarMark | null;
  targets: TargetMark[];
}

export type PlacementMode = "mortar" | "target";
