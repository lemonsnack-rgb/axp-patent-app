import { create } from "zustand";
import type { LeaderCurve, LineEnd, LineStyle, ToolMode } from "./types";

interface EditorState {
  tool: ToolMode;
  lineStyle: LineStyle;
  lineEnd: LineEnd;
  leaderCurve: LeaderCurve;
  showGrid: boolean;
  showMarginGuide: boolean;
  setTool: (t: ToolMode) => void;
  setLineStyle: (s: LineStyle) => void;
  setLineEnd: (e: LineEnd) => void;
  setLeaderCurve: (c: LeaderCurve) => void;
  toggleGrid: () => void;
  toggleMarginGuide: () => void;
  reset: () => void;
}

const INITIAL: Pick<
  EditorState,
  | "tool"
  | "lineStyle"
  | "lineEnd"
  | "leaderCurve"
  | "showGrid"
  | "showMarginGuide"
> = {
  tool: "select",
  lineStyle: "solid",
  lineEnd: "plain",
  leaderCurve: "s-curve",
  showGrid: true,
  showMarginGuide: true,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...INITIAL,
  setTool: (tool) => set({ tool }),
  setLineStyle: (lineStyle) => set({ lineStyle }),
  setLineEnd: (lineEnd) => set({ lineEnd }),
  setLeaderCurve: (leaderCurve) => set({ leaderCurve }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleMarginGuide: () =>
    set((s) => ({ showMarginGuide: !s.showMarginGuide })),
  reset: () => set({ ...INITIAL }),
}));
