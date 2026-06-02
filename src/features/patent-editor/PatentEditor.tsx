import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DrawingListPanel } from "./DrawingListPanel";
import { EditorCanvas, type EditorCanvasHandle } from "./EditorCanvas";
import { EditorToolbar } from "./EditorToolbar";
import { RefListPanel } from "./RefListPanel";
import { binarizeCanvasToBlob } from "./binarize";
import { useEditorStore } from "./useEditorStore";
import { CUSTOM_PROPS } from "./canvas/constants";
import type { EditorReference, PatentEditorProps } from "./types";

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 700;

const LEFT_WIDTH_KEY = "patent-editor:left-panel-width";
const RIGHT_WIDTH_KEY = "patent-editor:right-panel-width";
const LEFT_MIN = 120;
const LEFT_MAX = 320;
const RIGHT_MIN = 180;
const RIGHT_MAX = 400;
const LEFT_DEFAULT = 160;
const RIGHT_DEFAULT = 240;

function readStoredWidth(key: string, def: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const n = Number(raw);
      if (!Number.isNaN(n)) return n;
    }
  } catch {
    /* ignore */
  }
  return def;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function PatentEditor({
  drawings,
  activeDrawingId,
  representativeDrawingId,
  onActiveDrawingChange,
  onRepresentativeChange,
  onCaptionChange,
  onDescriptionChange,
  availableReferences,
  inventionComponents,
  singleDrawingMode = false,
  onDrawingDescriptionChange,
  onReferenceAdd,
  onReferenceUpdate,
  onReferenceDelete,
  onSaveProject,
  onExportComplete,
  onClose,
}: PatentEditorProps) {
  const canvasHandleRef = useRef<EditorCanvasHandle>(null);
  const [busy, setBusy] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [zoom, setZoom] = useState(1);

  const components = useMemo(() => inventionComponents ?? [], [inventionComponents]);
  const [leftWidth, setLeftWidth] = useState(() =>
    clamp(readStoredWidth(LEFT_WIDTH_KEY, LEFT_DEFAULT), LEFT_MIN, LEFT_MAX),
  );
  const [rightWidth, setRightWidth] = useState(() =>
    clamp(readStoredWidth(RIGHT_WIDTH_KEY, RIGHT_DEFAULT), RIGHT_MIN, RIGHT_MAX),
  );

  // 패널 리사이즈 (좌측·우측 손잡이 드래그)
  const startResize = useCallback(
    (side: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = side === "left" ? leftWidth : rightWidth;
      const onMove = (ev: MouseEvent) => {
        const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
        const next = side === "left"
          ? clamp(startW + delta, LEFT_MIN, LEFT_MAX)
          : clamp(startW + delta, RIGHT_MIN, RIGHT_MAX);
        if (side === "left") setLeftWidth(next);
        else setRightWidth(next);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        try {
          localStorage.setItem(
            side === "left" ? LEFT_WIDTH_KEY : RIGHT_WIDTH_KEY,
            String(side === "left" ? leftWidthRef.current : rightWidthRef.current),
          );
        } catch {
          /* ignore */
        }
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [leftWidth, rightWidth],
  );

  // 최신 width를 mouseup에서 참조하기 위한 ref
  const leftWidthRef = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);
  useEffect(() => {
    leftWidthRef.current = leftWidth;
  }, [leftWidth]);
  useEffect(() => {
    rightWidthRef.current = rightWidth;
  }, [rightWidth]);

  useEffect(() => {
    return () => {
      useEditorStore.getState().reset();
    };
  }, []);

  const refs = useMemo<EditorReference[]>(
    () => availableReferences ?? [],
    [availableReferences],
  );

  const activeDrawing = useMemo(
    () => drawings.find((d) => d.id === activeDrawingId) ?? drawings[0],
    [drawings, activeDrawingId],
  );

  // 활성 도면 변경 시 caption·description draft 동기화
  useEffect(() => {
    setCaptionDraft(activeDrawing?.caption ?? "");
    setDescriptionDraft(activeDrawing?.description ?? "");
  }, [activeDrawing?.id, activeDrawing?.caption, activeDrawing?.description]);

  // 저장 데이터 없을 때 구성요소를 캔버스에 자동 배치 (AI 추천 위치)
  useEffect(() => {
    if (!activeDrawing?.savedEditorDataJson && refs.length > 0) {
      // EditorCanvas가 마운트된 후 약간의 지연 후 배치
      const t = setTimeout(() => {
        canvasHandleRef.current?.placeInitialRefs(refs);
      }, 300);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDrawing?.id]);

  const commitCaption = useCallback(() => {
    if (!activeDrawing) return;
    if (captionDraft !== activeDrawing.caption) {
      onCaptionChange?.(activeDrawing.id, captionDraft);
    }
  }, [activeDrawing, captionDraft, onCaptionChange]);

  const commitDescription = useCallback(() => {
    if (!activeDrawing) return;
    if (descriptionDraft !== (activeDrawing.description ?? "")) {
      onDescriptionChange?.(activeDrawing.id, descriptionDraft);
    }
  }, [activeDrawing, descriptionDraft, onDescriptionChange]);

  // 현재 캔버스 상태를 JSON으로 직렬화
  const serializeCurrentCanvas = useCallback((): string | null => {
    const fc = canvasHandleRef.current?.getCanvas();
    if (!fc) return null;
    return JSON.stringify(fc.toObject(CUSTOM_PROPS));
  }, []);

  // 도면 전환: 현재 도면 자동 저장 후 새 도면 활성화
  const handleDrawingChange = useCallback(
    (newId: string) => {
      if (newId === activeDrawingId) return;
      const json = serializeCurrentCanvas();
      if (json) onSaveProject(activeDrawingId, json);
      onActiveDrawingChange(newId);
    },
    [activeDrawingId, onActiveDrawingChange, onSaveProject, serializeCurrentCanvas],
  );

  const handleSave = useCallback(() => {
    const json = serializeCurrentCanvas();
    if (!json) return;
    onSaveProject(activeDrawingId, json);
  }, [activeDrawingId, onSaveProject, serializeCurrentCanvas]);

  const handleExport = useCallback(async () => {
    const handle = canvasHandleRef.current;
    if (!handle) return;
    try {
      setBusy(true);
      const merged = handle.exportBinaryReady();
      if (!merged) return;
      const blob = await binarizeCanvasToBlob(merged);
      onExportComplete(activeDrawingId, blob);
    } catch (err) {
      console.error("[PatentEditor] export failed:", err);
      const tainted =
        err instanceof DOMException && err.name === "SecurityError";
      alert(
        tainted
          ? "캔버스가 CORS로 오염되어 내보내기에 실패했습니다."
          : "내보내기에 실패했습니다. 콘솔을 확인하세요.",
      );
    } finally {
      setBusy(false);
    }
  }, [activeDrawingId, onExportComplete]);

  const handleToggleHatch = useCallback(() => {
    canvasHandleRef.current?.toggleHatchOnSelection();
  }, []);

  const handleReferenceAdd = useCallback(
    (ref: EditorReference) => {
      onReferenceAdd?.(ref);
    },
    [onReferenceAdd],
  );

  const handleReferenceDelete = useCallback(
    (refNumber: string) => {
      const confirmed = window.confirm(
        `'${refNumber}' 부호를 삭제합니다.\n이 부호를 사용한 캔버스의 모든 지시선·텍스트·원형부호가 함께 삭제됩니다.\n계속할까요?`,
      );
      if (!confirmed) return;
      // 현재 활성 캔버스에서 즉시 제거
      canvasHandleRef.current?.removeAllUsesOfRef(refNumber);
      // 외부(App)에 알려서 풀에서 제거 + 다른 도면 JSON도 정리
      onReferenceDelete?.(refNumber);
    },
    [onReferenceDelete],
  );

  // 닫기 전 현재 도면 자동 저장 + 수락된 부호 일괄 갱신 콜백
  const handleClose = useCallback(() => {
    const json = serializeCurrentCanvas();
    if (json) onSaveProject(activeDrawingId, json);
    onClose();
  }, [activeDrawingId, onClose, onSaveProject, serializeCurrentCanvas]);

  if (!activeDrawing) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-8 text-base2 text-gray-500">
        편집할 도면이 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <EditorToolbar
        onSave={handleSave}
        onExport={handleExport}
        onClose={handleClose}
        onToggleHatch={handleToggleHatch}
        busy={busy}
      />
      <div className="flex-1 min-h-0 flex">
        {/* 단일 도면 모드에서는 도면 목록 패널 숨김 */}
        {!singleDrawingMode && (
          <>
            <div
              className="shrink-0 border-r border-ck-border"
              style={{ width: leftWidth }}
            >
              <DrawingListPanel
                drawings={drawings}
                activeId={activeDrawing.id}
                representativeId={representativeDrawingId}
                onSelect={handleDrawingChange}
              />
            </div>
            <div
              onMouseDown={startResize("left")}
              className="w-1 shrink-0 cursor-col-resize bg-gray-200 transition hover:bg-blue-400"
              title="패널 크기 조절"
            />
          </>
        )}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          {/* singleDrawingMode에서는 caption/description을 RefListPanel로 이동했으므로 숨김 */}
          {!singleDrawingMode && (
            <div className="space-y-2 border-b border-ck-border bg-white px-3 py-2 shrink-0">
              <div className="flex items-center gap-2">
                <label htmlFor="patent-caption" className="shrink-0 text-md2 font-semibold text-gray-600">
                  도면의 명칭:
                </label>
                <input id="patent-caption" type="text" value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  onBlur={commitCaption}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
                  placeholder="예: 도 1: 본체 사시도"
                  className="flex-1 max-w-md rounded border border-gray-300 px-2 py-1 text-md2 focus:border-blue-500 focus:outline-none"
                />
                {representativeDrawingId === activeDrawing.id ? (
                  <span className="shrink-0 rounded bg-amber-100 px-2 py-1 text-sm2 font-semibold text-amber-700">★ 대표도면</span>
                ) : onRepresentativeChange ? (
                  <button type="button" onClick={() => onRepresentativeChange(activeDrawing.id)}
                    className="shrink-0 rounded border border-amber-400 bg-white px-2 py-1 text-sm2 font-semibold text-amber-700 hover:bg-amber-50"
                    title="이 도면을 명세서의 대표도면으로 지정">
                    대표도면으로 설정
                  </button>
                ) : null}
                <span className="ml-auto shrink-0 text-xs2 text-gray-400">ID: {activeDrawing.id}</span>
              </div>
              <div>
                <label htmlFor="patent-description" className="mb-0.5 block text-xs2 font-semibold uppercase tracking-wider text-gray-500">도면의 설명</label>
                <textarea id="patent-description" value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  onBlur={commitDescription} rows={2}
                  placeholder="예: 도 1은 본체의 외관을 도시한 사시도이다."
                  className="w-full resize-y rounded border border-gray-300 px-2 py-1 text-md2 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-auto bg-gray-100 p-4 flex items-center justify-center relative">
              {/* key={activeDrawing.id} : 도면 전환 시 fabric 캔버스를 완전히 새로 마운트 */}
              <EditorCanvas
                key={activeDrawing.id}
                ref={canvasHandleRef}
                sourceImageUrl={activeDrawing.sourceImageUrl}
                savedEditorDataJson={activeDrawing.savedEditorDataJson}
                width={DEFAULT_WIDTH}
                height={DEFAULT_HEIGHT}
                availableReferences={refs}
                onReferenceAdd={onReferenceAdd}
                onZoomChange={setZoom}
              />
              {/* 줌 컨트롤 */}
              <div className="absolute bottom-4 left-4 flex items-center gap-0.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm px-1 py-1">
                <button
                  onClick={() => canvasHandleRef.current?.zoomOut()}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 text-base font-medium transition-colors"
                  title="축소 (Ctrl+-)"
                >−</button>
                <button
                  onClick={() => { canvasHandleRef.current?.resetZoom(); setZoom(1); }}
                  className="min-w-[3.5rem] h-7 px-1 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 text-xs2 font-mono transition-colors"
                  title="100% 원본 크기"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={() => canvasHandleRef.current?.zoomIn()}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 text-base font-medium transition-colors"
                  title="확대 (Ctrl++)"
                >+</button>
                <div className="w-px h-4 bg-gray-200 mx-0.5" />
                <button
                  onClick={() => canvasHandleRef.current?.fitToScreen()}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 transition-colors"
                  title="전체 맞춤"
                >
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="13" height="13">
                    <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/>
                  </svg>
                </button>
              </div>
            </div>
            <div
              onMouseDown={startResize("right")}
              className="w-1 shrink-0 cursor-col-resize bg-gray-200 transition hover:bg-blue-400"
              title="패널 크기 조절"
            />
            <div
              className="shrink-0 border-l border-ck-border"
              style={{ width: rightWidth }}
            >
              <RefListPanel
                references={refs}
                onAdd={handleReferenceAdd}
                onUpdate={onReferenceUpdate}
                onDelete={handleReferenceDelete}
                inventionComponents={components}
                drawingDescription={singleDrawingMode ? (descriptionDraft || activeDrawing?.description) : undefined}
                onDrawingDescriptionChange={singleDrawingMode ? (val) => {
                  setDescriptionDraft(val);
                  onDrawingDescriptionChange?.(activeDrawing.id, val);
                } : undefined}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-ck-border bg-ck-bg px-3 py-1.5 text-sm2 text-gray-500">
        Fabric.js · 1-bit PNG 내보내기 · 도면 전환 시 자동 저장 · 지시선 더블클릭으로 부호 편집
      </div>
    </div>
  );
}
