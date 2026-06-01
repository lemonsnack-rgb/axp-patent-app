import { create } from "zustand";
import type { FillStyle, LeaderCurve, LineEnd, LineStyle, LineWeight, ToolMode } from "./types";

interface EditorState {
  tool: ToolMode;
  lineStyle: LineStyle;
  lineWeight: LineWeight;
  lineEnd: LineEnd;
  leaderCurve: LeaderCurve;
  fillStyle: FillStyle;
  showGrid: boolean;
  showMarginGuide: boolean;
  setTool: (t: ToolMode) => void;
  setLineStyle: (s: LineStyle) => void;
  setLineWeight: (w: LineWeight) => void;
  setLineEnd: (e: LineEnd) => void;
  setLeaderCurve: (c: LeaderCurve) => void;
  setFillStyle: (f: FillStyle) => void;
  toggleGrid: () => void;
  toggleMarginGuide: () => void;
  reset: () => void;
}

const INITIAL: Pick<
  EditorState,
  | "tool" | "lineStyle" | "lineWeight" | "lineEnd"
  | "leaderCurve" | "fillStyle" | "showGrid" | "showMarginGuide"
> = {
  tool: "select",
  lineStyle: "solid",
  lineWeight: "normal",
  lineEnd: "plain",
  leaderCurve: "s-curve",
  fillStyle: "none",
  showGrid: true,
  showMarginGuide: true,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...INITIAL,
  setTool:         (tool)        => set({ tool }),
  setLineStyle:    (lineStyle)   => set({ lineStyle }),
  setLineWeight:   (lineWeight)  => set({ lineWeight }),
  setLineEnd:      (lineEnd)     => set({ lineEnd }),
  setLeaderCurve:  (leaderCurve) => set({ leaderCurve }),
  setFillStyle:    (fillStyle)   => set({ fillStyle }),
  toggleGrid:      ()            => set((s) => ({ showGrid: !s.showGrid })),
  toggleMarginGuide: ()          => set((s) => ({ showMarginGuide: !s.showMarginGuide })),
  reset:           ()            => set({ ...INITIAL }),
}));
