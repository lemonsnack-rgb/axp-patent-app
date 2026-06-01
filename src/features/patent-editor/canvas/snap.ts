import { SNAP_GRID } from "./constants";

export const snap = (v: number): number => Math.round(v / SNAP_GRID) * SNAP_GRID;
