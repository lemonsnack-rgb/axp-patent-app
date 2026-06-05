# 도면 편집기 워크플로우 완성 계획 (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`
>
> **작업 디렉토리:** `c:\project\06_AXP\react-app`
> **완료 기준:** 각 Task 후 `npx tsc --noEmit && npm run build` 통과
>
> **전제:** Part A(TeX 수식), Part B-1~B-9(편집기 고도화)는 이미 완료됨.

---

## 정식 이용 흐름 (목표)

```
Step 1. PDF 도면 후보 제시 & bbox 확인/수정
  → 도면 편집기 진입 시 원본 이미지 위에 파란 bbox 박스 즉시 표시
  → 드래그로 위치/크기 조정
  → "영역 확인 완료" → adjustedBbox 저장 → 변환 시작

Step 2. CAD 스타일 변환
  → 1.8초 시뮬레이션 → mock SVG 3개 후보 표시
  → 이용자가 하나 선택

Step 3. 도면 편집기 — AI 부호 위치 추천
  → 편집기 열림과 동시에 AI가 구성요소별 추천 좌표 계산
  → 캔버스에 "오렌지 pending 마커" 표시 (드래그 조정 가능)
  → AiRefPanel에 추천 목록 표시
  → 이용자 수락(✓): 마커 위치에 지시선+번호 생성
  → 이용자 거절(✗): 마커 제거

Step 4. 도면 편집기 — 직접 편집 + 부호 배치
  → 모든 그리기 도구 사용 가능
  → 부호 자동 부여 → 배치 버튼 → 캔버스 클릭으로 추가 배치
  → 내보내기 → 완료
```

---

## 현황 문제 분석

| 구분 | 현재 상태 | 문제 |
|------|----------|------|
| **Step 1 bbox** | crop 단계는 이미지만 표시, reselect에서만 bbox 편집 | bbox 편집이 즉시 안되고 "영역 재지정" 클릭 필요. bbox가 저장 안됨 |
| **AI 마커** | `placeInitialRefs()`가 지시선을 즉시 확정 생성 | 조정 불가. "pending 마커" 개념 없음 |
| **AiRefPanel** | UI 컴포넌트 존재, 캔버스와 미연결 | 수락/거절 버튼이 실제 캔버스에 영향 없음 |
| **배치 안내** | "배치" 클릭 후 다음 행동 안내 없음 | 이용자가 캔버스 클릭 필요성을 모름 |

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/features/drawing-workflow/types.ts` | `DrawingItem.adjustedBbox` 추가 |
| `src/features/drawing-workflow/DrawingEditorModal.tsx` | Step 1 bbox 즉시 편집 + 저장 |
| `src/features/patent-editor/types.ts` | `EditorCanvasHandle` 메서드 추가 |
| `src/features/patent-editor/canvas/constants.ts` | AI 마커용 META 키 추가 |
| `src/features/patent-editor/EditorCanvas.tsx` | pending 마커 생성/수락/거절 구현 |
| `src/features/patent-editor/PatentEditor.tsx` | AiRefPanel 연결, AI 추천 생성 |
| `src/features/patent-editor/RefListPanel.tsx` | 배치 안내 배너, 상태 시각화 |
| `src/views/SpecView.tsx` | DrawingsPanel 뱃지 업데이트 |

---

## Task 1: DrawingItem — adjustedBbox 타입 추가

**File:** `src/features/drawing-workflow/types.ts`

- [ ] **Step 1: DrawingItem에 adjustedBbox 추가**

  ```typescript
  export interface DrawingItem {
    id: string;
    symbol: number;
    label: DrawingLabel;
    name: string;
    description: string;
    applied: boolean;
    pageNumber: number;
    imageSize?: { w: number; h: number };
    stage: DrawingStage;
    originalImageUrl: string;
    bbox: DrawingBBox;           // AI 자동 추출 원본 bbox
    adjustedBbox?: DrawingBBox;  // 이용자가 수정한 bbox (없으면 bbox 사용)
    cadCandidates?: CadCandidate[];
    selectedCandidateId?: string;
    savedEditorJson?: string;
    exportedImageUrl?: string;
    isRepresentative?: boolean;
    drawingDescription?: string;
  }
  ```

- [ ] **Step 2: 타입 오류 없음 확인**
  ```bash
  npx tsc --noEmit 2>&1 | head -10
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add src/features/drawing-workflow/types.ts
  git commit -m "feat: add adjustedBbox field to DrawingItem"
  ```

---

## Task 2: DrawingEditorModal — Step 1 bbox 편집 즉시 활성화 + 저장

**File:** `src/features/drawing-workflow/DrawingEditorModal.tsx`

### 2-A: crop 단계를 bbox 드래그 편집 UI로 교체

- [ ] **Step 1: 현재 코드에서 `workStage === 'crop'` 분기를 찾아 교체**

  현재 (약 379행, workStage==='crop' 일 때 정적 이미지 표시):
  ```typescript
  {workStage === 'crop' ? (
    <div className="flex-1 bg-gray-100 rounded-lg ...">
      {이미지 or 플레이스홀더}
    </div>
  ) : (
    /* reselect: bbox 드래그 편집 */
    <div ref={cropContainerRef} ...>
  ```

  **변경**: crop/reselect 모두 bbox 드래그 편집 UI를 표시. 이미지 있으면 배경에 표시, 없으면 플레이스홀더.

  ```typescript
  {/* crop + reselect 통합: bbox 드래그 편집 */}
  <div
    ref={cropContainerRef}
    className="flex-1 bg-gray-100 rounded-lg border border-gray-200 relative overflow-hidden select-none"
    style={{ cursor: 'default' }}
  >
    {/* 배경: 원본 이미지 or 플레이스홀더 */}
    {(activeDraw?.originalImageUrl || activeDraw?.exportedImageUrl) ? (
      <img
        src={activeDraw.originalImageUrl || activeDraw.exportedImageUrl}
        className="w-full h-full object-contain"
        alt="원본 도면"
        draggable={false}
      />
    ) : (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 gap-3 px-8">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
        </svg>
        <p className="text-sm2 font-semibold text-gray-400 text-center">{activeDraw?.name}</p>
        <p className="text-xs2 text-gray-300 text-center leading-relaxed">
          실제 서비스에서는 직무발명서에서 추출된<br/>원본 도면 이미지가 여기에 표시됩니다
        </p>
      </div>
    )}

    {/* 이미지 있을 때: 어두운 마스크 (bbox 밖 영역) */}
    {(activeDraw?.originalImageUrl || activeDraw?.exportedImageUrl) && (
      <div className="absolute inset-0 bg-black/25 pointer-events-none" />
    )}

    {/* bbox 편집 영역 */}
    <div
      className="absolute border-2 border-blue-500"
      style={{
        left:   `${cropBox.x1}%`,
        top:    `${cropBox.y1}%`,
        width:  `${cropBox.x2 - cropBox.x1}%`,
        height: `${cropBox.y2 - cropBox.y1}%`,
        cursor: 'move',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.30)',
      }}
      onMouseDown={e => startCropDrag('move', e)}
    >
      {/* 레이블 */}
      <span className="absolute -top-6 left-0 text-xs2 text-white bg-blue-600 px-2 py-0.5 rounded font-semibold shadow whitespace-nowrap">
        도면 변환 영역 — 드래그하여 조정
      </span>

      {/* 8방향 리사이즈 핸들 */}
      {(['nw','n','ne','e','se','s','sw','w'] as const).map(h => {
        const pos: React.CSSProperties = {};
        if (h.includes('n')) pos.top = '-5px';
        if (h.includes('s')) pos.bottom = '-5px';
        if (!h.includes('n') && !h.includes('s')) pos.top = 'calc(50% - 5px)';
        if (h.includes('w')) pos.left = '-5px';
        if (h.includes('e')) pos.right = '-5px';
        if (!h.includes('w') && !h.includes('e')) pos.left = 'calc(50% - 5px)';
        const cursors: Record<string, string> = {
          nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize',
          se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize',
        };
        return (
          <div key={h}
            className="absolute w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm z-10 shadow"
            style={{ ...pos, cursor: cursors[h] }}
            onMouseDown={e => { e.stopPropagation(); startCropDrag(h, e); }}
          />
        );
      })}

      {/* 영역 크기 표시 */}
      <span className="absolute bottom-1 right-1.5 text-xs2 text-white/80 font-mono bg-black/30 px-1 rounded">
        {Math.round(cropBox.x2 - cropBox.x1)}% × {Math.round(cropBox.y2 - cropBox.y1)}%
      </span>
    </div>

    {/* 안내 텍스트 */}
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs2 px-3 py-1.5 rounded-full backdrop-blur-sm whitespace-nowrap">
      파란 박스를 드래그하여 변환할 도면 영역을 지정하세요
    </div>
  </div>
  ```

### 2-B: "영역 확인 완료" 버튼 — bbox 저장 후 변환

- [ ] **Step 2: `startConvert` 함수 수정**

  현재:
  ```typescript
  const startConvert = () => {
    goStage('converting');
    setTimeout(() => { ... }, 1800);
  };
  ```

  변경 — bbox 저장을 먼저:
  ```typescript
  const startConvert = () => {
    // ① adjustedBbox 계산 (퍼센트 → 픽셀)
    const imgW = activeDraw?.imageSize?.w ?? 400;
    const imgH = activeDraw?.imageSize?.h ?? 300;
    const adjustedBbox: DrawingBBox = {
      x: Math.round(cropBox.x1 / 100 * imgW),
      y: Math.round(cropBox.y1 / 100 * imgH),
      w: Math.round((cropBox.x2 - cropBox.x1) / 100 * imgW),
      h: Math.round((cropBox.y2 - cropBox.y1) / 100 * imgH),
    };

    // ② DrawingItem에 저장 (stage = bbox-adjusted)
    onSave(activeId, { adjustedBbox, stage: 'bbox-adjusted' });

    // ③ 변환 시작
    goStage('converting');
    setTimeout(() => {
      const cands = MOCK_SVGS.map((svg, i) => ({
        id: `c-${activeId}-${i}`,
        svgDataUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
      }));
      setCandidatesMap(m => ({ ...m, [activeId]: cands }));
      setSelectedMap(m => ({ ...m, [activeId]: cands[0].id }));
      goStage('decide');
    }, 1800);
  };
  ```

- [ ] **Step 3: 하단 버튼 영역 교체**

  crop/reselect 단계 푸터에서 현재 "스타일 변환 시작 →" 버튼을:
  ```typescript
  <div className="flex items-center gap-2">
    <button
      onClick={() => setCropBox({ x1: 15, y1: 15, x2: 85, y2: 85 })}
      className="px-3 py-1.5 border border-gray-300 rounded text-xs2 text-gray-600 hover:bg-gray-50"
    >
      영역 초기화
    </button>
    <button
      onClick={startConvert}
      className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs2 font-semibold hover:bg-blue-700 flex items-center gap-1.5 active:scale-[0.98]"
    >
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="12" height="12">
        <polyline points="2,7 6,11 12,3"/>
      </svg>
      영역 확인 완료 — 변환 시작
    </button>
  </div>
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add src/features/drawing-workflow/DrawingEditorModal.tsx
  git commit -m "feat: Step1 bbox edit always active, save adjustedBbox before CAD conversion"
  ```

---

## Task 3: EditorCanvas — AI Pending 마커 시스템 구현

**File:** `src/features/patent-editor/EditorCanvas.tsx`, `src/features/patent-editor/canvas/constants.ts`, `src/features/patent-editor/types.ts`

### 3-A: META 키 + EditorCanvasHandle 메서드 추가

- [ ] **Step 1: `canvas/constants.ts`에 AI 마커 META 키 추가**

  ```typescript
  export const META = {
    // ... 기존 유지 ...
    // AI pending 마커
    isAiPendingMarker: 'isAiPendingMarker',
    aiRecId:           'aiRecId',
  } as const;

  export const CUSTOM_PROPS = [
    // ... 기존 유지 ...
    META.isAiPendingMarker,
    META.aiRecId,
  ];
  ```

- [ ] **Step 2: `types.ts` EditorCanvasHandle에 메서드 추가**

  ```typescript
  export interface EditorCanvasHandle {
    getCanvas: () => fabric.Canvas | null;
    toggleHatchOnSelection: () => void;
    exportBinaryReady: () => HTMLCanvasElement | null;
    removeAllUsesOfRef: (refNumber: string) => number;
    placeInitialRefs: (refs: EditorReference[]) => void;  // 기존 유지 (fallback용)

    // AI 추천 pending 마커 관련 (신규)
    /** AI 추천 좌표에 pending 마커를 캔버스에 배치 */
    placeAiPendingMarkers: (
      recs: Array<{ id: string; refNumber: string; componentName: string; posXPct: number; posYPct: number }>,
    ) => void;
    /** pending 마커를 수락 → 해당 위치에 지시선+번호 생성, 마커 제거 */
    acceptAiMarker: (recId: string, ref: EditorReference) => void;
    /** pending 마커를 거절 → 마커만 제거 */
    rejectAiMarker: (recId: string) => void;
    /** pending 마커의 현재 위치를 % 좌표로 반환 (마커 이동 후 동기화용) */
    getAiMarkerPosition: (recId: string) => { xPct: number; yPct: number } | null;

    // 줌 제어 (기존 유지)
    zoomIn: () => void;
    zoomOut: () => void;
    fitToScreen: () => void;
    resetZoom: () => void;
    getZoom: () => number;
    selectRefForPlacement: (ref: EditorReference) => void;
  }
  ```

### 3-B: EditorCanvas.tsx — pending 마커 생성 함수

- [ ] **Step 3: `placeAiPendingMarkers` 구현**

  `useImperativeHandle` 블록에 추가:

  ```typescript
  placeAiPendingMarkers: (recs) => {
    const fc = fabricRef.current;
    if (!fc || recs.length === 0) return;

    const W = fc.getWidth();
    const H = fc.getHeight();

    // 기존 pending 마커 모두 제거
    const oldMarkers = fc.getObjects().filter(o => getMeta(o, META.isAiPendingMarker));
    oldMarkers.forEach(o => fc.remove(o));

    recs.forEach(rec => {
      const cx = (rec.posXPct / 100) * W;
      const cy = (rec.posYPct / 100) * H;

      // ── 오렌지 원 ──────────────────────────────────────
      const circle = new fabric.Circle({
        radius: 18,
        fill: '#f97316',          // orange-500
        stroke: '#ffffff',
        strokeWidth: 2.5,
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.25)', blur: 6, offsetX: 0, offsetY: 2 }),
        originX: 'center',
        originY: 'center',
        objectCaching: false,
      });

      // ── 번호 텍스트 (원 안) ──────────────────────────
      const numText = new fabric.IText(rec.refNumber || '?', {
        fontSize:   11,
        fontWeight: 'bold',
        fontFamily: 'Arial, sans-serif',
        fill:       '#ffffff',
        originX:    'center',
        originY:    'center',
        objectCaching: false,
        selectable: false,
        evented:    false,
      });

      // ── 구성요소명 레이블 (원 오른쪽) ──────────────
      const nameLabel = new fabric.IText(rec.componentName, {
        fontSize:         10,
        fontFamily:       'Arial, sans-serif',
        fill:             '#1e3a5f',
        backgroundColor:  'rgba(255,255,255,0.85)',
        left:             22,
        top:              -7,
        originX:          'left',
        originY:          'top',
        objectCaching:    false,
        selectable:       false,
        evented:          false,
      });

      // ── 그룹으로 묶기 ────────────────────────────────
      const group = new fabric.Group([circle, numText, nameLabel], {
        left:           cx,
        top:            cy,
        originX:        'center',
        originY:        'center',
        hasControls:    false,   // 스케일/회전 핸들 숨김
        hasBorders:     true,
        borderColor:    '#f97316',
        cornerColor:    '#f97316',
        objectCaching:  false,
        hoverCursor:    'move',
        moveCursor:     'move',
      });

      // META 태깅
      setMeta(group, META.isAiPendingMarker, true as any);
      setMeta(group, META.aiRecId, rec.id as any);
      setMeta(group, META.refNumber, rec.refNumber as any);

      fc.add(group);
    });

    fc.discardActiveObject();
    fc.requestRenderAll();
  },
  ```

### 3-C: acceptAiMarker — pending 마커 → 지시선으로 전환

- [ ] **Step 4: `acceptAiMarker` 구현**

  ```typescript
  acceptAiMarker: (recId, ref) => {
    const fc = fabricRef.current;
    if (!fc) return;

    // pending 마커 찾기
    const marker = fc.getObjects().find(
      o => getMeta(o, META.isAiPendingMarker) && getMeta(o, META.aiRecId) === recId
    );
    if (!marker) return;

    // 마커 현재 위치
    const anchorX = (marker.left  ?? 0);
    const anchorY = (marker.top   ?? 0);

    // textPos: anchor에서 오른쪽 위 방향으로 오프셋
    const W = fc.getWidth();
    const textPos = {
      x: Math.min(anchorX + 70, W - 30),
      y: Math.max(anchorY - 50, 20),
    };

    // 마커 제거
    fc.remove(marker);

    // 실제 지시선 + 번호 생성
    const state = useEditorStore.getState();
    spawnLeaderPair(
      fc,
      { x: anchorX, y: anchorY },
      textPos,
      state.lineStyle,
      state.leaderCurve,
      ref
    );

    fc.discardActiveObject();
    fc.requestRenderAll();
  },
  ```

### 3-D: rejectAiMarker — 마커 제거

- [ ] **Step 5: `rejectAiMarker` 구현**

  ```typescript
  rejectAiMarker: (recId) => {
    const fc = fabricRef.current;
    if (!fc) return;
    const marker = fc.getObjects().find(
      o => getMeta(o, META.isAiPendingMarker) && getMeta(o, META.aiRecId) === recId
    );
    if (marker) {
      fc.remove(marker);
      fc.requestRenderAll();
    }
  },
  ```

### 3-E: getAiMarkerPosition — 마커 위치 반환

- [ ] **Step 6: `getAiMarkerPosition` 구현**

  ```typescript
  getAiMarkerPosition: (recId) => {
    const fc = fabricRef.current;
    if (!fc) return null;
    const marker = fc.getObjects().find(
      o => getMeta(o, META.isAiPendingMarker) && getMeta(o, META.aiRecId) === recId
    );
    if (!marker) return null;
    const W = fc.getWidth();
    const H = fc.getHeight();
    return {
      xPct: ((marker.left  ?? 0) / W) * 100,
      yPct: ((marker.top   ?? 0) / H) * 100,
    };
  },
  ```

### 3-F: 마커 이동 시 콜백 (object:modified 이벤트)

- [ ] **Step 7: EditorCanvas Props에 onAiMarkerMoved 콜백 추가**

  Props interface에:
  ```typescript
  onAiMarkerMoved?: (recId: string, xPct: number, yPct: number) => void;
  ```

  useEffect 내 Fabric 이벤트 리스너에:
  ```typescript
  fc.on('object:modified', (e) => {
    const obj = e.target;
    if (!obj) return;
    if (getMeta(obj, META.isAiPendingMarker)) {
      const recId = getMeta<string>(obj, META.aiRecId);
      if (recId) {
        const W = fc.getWidth();
        const H = fc.getHeight();
        const xPct = ((obj.left ?? 0) / W) * 100;
        const yPct = ((obj.top  ?? 0) / H) * 100;
        onAiMarkerMoved?.(recId, xPct, yPct);
      }
    }
    // ... 기존 object:modified 처리 유지
  });
  ```

- [ ] **Step 8: 타입 오류 없음 확인 + Commit**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  git add src/features/patent-editor/
  git commit -m "feat: AI pending marker system — place/accept/reject on canvas (EditorCanvas)"
  ```

---

## Task 4: PatentEditor — AI 추천 생성 + AiRefPanel 연결

**File:** `src/features/patent-editor/PatentEditor.tsx`

- [ ] **Step 1: import 추가**

  ```typescript
  import { AiRefPanel } from './AiRefPanel';
  import type { AiRefRecommendation } from './types';
  ```

- [ ] **Step 2: 상태 추가**

  컴포넌트 상단:
  ```typescript
  const [aiRefRecs, setAiRefRecs]         = useState<AiRefRecommendation[]>([]);
  const [aiRefLoading, setAiRefLoading]   = useState(false);
  const [activePlacingRef, setActivePlacingRef] = useState<EditorReference | null>(null);
  ```

- [ ] **Step 3: activeDrawingId 변경 시 AI 추천 자동 생성**

  ```typescript
  useEffect(() => {
    if (!components.length) return;
    setAiRefLoading(true);
    setAiRefRecs([]);

    const timer = setTimeout(() => {
      // mock AI 추천: 구성요소를 캔버스에 3열 배치
      const recs: AiRefRecommendation[] = components
        .slice(0, 6)
        .map((c, i) => ({
          id:            `ai-${activeDrawingId}-${c.number}-${i}`,
          refNumber:     c.number,
          componentName: c.name,
          posXPct:       15 + (i % 3) * 30,          // 15%, 45%, 75%
          posYPct:       25 + Math.floor(i / 3) * 45, // 25%, 70%
          status:        'pending' as const,
        }));

      setAiRefRecs(recs);
      setAiRefLoading(false);

      // 캔버스에 pending 마커 배치
      if (canvasHandleRef.current) {
        canvasHandleRef.current.placeAiPendingMarkers(recs);
      }
    }, 1200);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDrawingId]);
  ```

- [ ] **Step 4: AI 마커 이동 동기화 콜백**

  ```typescript
  const handleAiMarkerMoved = (recId: string, xPct: number, yPct: number) => {
    setAiRefRecs(prev =>
      prev.map(r => r.id === recId ? { ...r, posXPct: xPct, posYPct: yPct } : r)
    );
  };
  ```

- [ ] **Step 5: handlePlaceRef + handleReferenceAdd**

  ```typescript
  const handlePlaceRef = (ref: EditorReference) => {
    setActivePlacingRef(ref);
    canvasHandleRef.current?.selectRefForPlacement(ref);
  };

  const handleReferenceAdd = (ref: EditorReference) => {
    setActivePlacingRef(null);
    onReferenceAdd?.(ref);
  };
  ```

- [ ] **Step 6: EditorCanvas에 props 연결**

  ```typescript
  <EditorCanvas
    ...
    onAiMarkerMoved={handleAiMarkerMoved}
    onReferenceAdd={handleReferenceAdd}
  />
  ```

- [ ] **Step 7: 우측 패널에 AiRefPanel 추가**

  RefListPanel 위에 삽입:
  ```typescript
  {/* AI 부호 위치 추천 패널 */}
  {(aiRefLoading || aiRefRecs.length > 0) && (
    <AiRefPanel
      recommendations={aiRefRecs}
      loading={aiRefLoading}
      components={components}
      onAccept={(rec, componentNumber) => {
        // 캔버스: pending 마커 → 지시선으로 전환
        const ref: EditorReference = {
          number: rec.refNumber,
          name:   rec.componentName,
        };
        canvasHandleRef.current?.acceptAiMarker(rec.id, ref);
        // 상태: accepted로 변경
        setAiRefRecs(prev =>
          prev.map(r => r.id === rec.id ? { ...r, status: 'accepted' } : r)
        );
      }}
      onReject={recId => {
        // 캔버스: 마커 제거
        canvasHandleRef.current?.rejectAiMarker(recId);
        // 상태: rejected로 변경
        setAiRefRecs(prev =>
          prev.map(r => r.id === recId ? { ...r, status: 'rejected' } : r)
        );
      }}
      onNumberChange={(recId, newNumber) => {
        setAiRefRecs(prev =>
          prev.map(r => r.id === recId ? { ...r, refNumber: newNumber } : r)
        );
      }}
      onComponentChange={(recId, componentNumber) => {
        const comp = components.find(c => c.number === componentNumber);
        setAiRefRecs(prev =>
          prev.map(r => r.id === recId
            ? { ...r, componentName: comp?.name ?? r.componentName }
            : r)
        );
      }}
    />
  )}
  {/* 도면 부호 목록 */}
  <RefListPanel
    ...
    activePlacingRef={activePlacingRef}
    onPlaceRef={handlePlaceRef}
  />
  ```

- [ ] **Step 8: Commit**

  ```bash
  git add src/features/patent-editor/PatentEditor.tsx
  git commit -m "feat: AI ref recommendations — generate mock positions, connect AiRefPanel (PatentEditor)"
  ```

---

## Task 5: RefListPanel — 배치 안내 배너 + 상태 시각화

**File:** `src/features/patent-editor/RefListPanel.tsx`

- [ ] **Step 1: Props에 `activePlacingRef` 추가**

  ```typescript
  interface Props {
    // ... 기존 유지 ...
    activePlacingRef?: EditorReference | null;
  }
  ```

- [ ] **Step 2: 배치 안내 배너**

  헤더 바로 아래에:
  ```typescript
  {activePlacingRef && (
    <div className="mx-2 my-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs2 flex items-center gap-2">
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13" className="shrink-0 animate-pulse">
        <circle cx="7" cy="7" r="6"/><line x1="7" y1="4" x2="7" y2="7"/><circle cx="7" cy="9.5" r="0.6" fill="currentColor"/>
      </svg>
      <span>
        <strong>{activePlacingRef.number}</strong>{activePlacingRef.name ? ` · ${activePlacingRef.name}` : ''} —
        캔버스에서 클릭하여 지시선 위치를 지정하세요
      </span>
    </div>
  )}
  ```

- [ ] **Step 3: 배치 버튼 상태 3종**

  ```typescript
  <button
    onClick={() => {
      if (!r.number) { showNoNumGuide(`${r.number}-${r.name}`); }
      else { onPlaceRef?.(r); }
    }}
    title={
      r.number
        ? activePlacingRef?.number === r.number
          ? '캔버스에서 클릭하여 배치 중...'
          : placedNums?.has(r.number)
            ? '이미 배치됨 — 다시 배치하려면 클릭'
            : `캔버스에 배치 (${r.number})`
        : '번호를 먼저 부여하세요'
    }
    className={clsx(
      'shrink-0 rounded px-1.5 py-0.5 text-xs2 font-semibold border transition-all',
      activePlacingRef?.number === r.number
        // 배치 중: 파란 + 펄스
        ? 'text-blue-700 border-blue-400 bg-blue-100 animate-pulse cursor-default'
        : placedNums?.has(r.number)
          // 배치 완료: 초록
          ? 'text-green-700 border-green-300 bg-green-50 hover:bg-green-100'
          : r.number
            // 대기: 파란 outline
            ? 'text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-400'
            // 번호 없음: 비활성
            : 'text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
    )}>
    {activePlacingRef?.number === r.number
      ? '배치 중...'
      : placedNums?.has(r.number)
        ? '✓ 배치됨'
        : '배치'}
  </button>
  ```

- [ ] **Step 4: 항목 행 하이라이트 (배치 중인 항목)**

  ```typescript
  className={clsx(
    'flex items-center gap-1 rounded px-1.5 py-1 transition-all group',
    'bg-white border hover:border-blue-300',
    activePlacingRef?.number === r.number
      ? 'border-blue-500 bg-blue-50 shadow-sm'
      : noNumGuide === `${r.number}-${r.name}`
        ? 'border-amber-400 bg-amber-50'
        : 'border-gray-200'
  )}
  ```

- [ ] **Step 5: 부호 자동 부여 완료 피드백**

  ```typescript
  const [assignFeedback, setAssignFeedback] = useState(false);

  const autoAssign = () => {
    const updated = autoAssignNumbers(references);
    if (onBulkUpdate) onBulkUpdate(updated);
    else if (onUpdate) updated.forEach(r => onUpdate(r));
    setAssignFeedback(true);
    setTimeout(() => setAssignFeedback(false), 2000);
  };
  ```

  버튼 옆에:
  ```typescript
  {assignFeedback && (
    <span className="text-xs2 text-green-600 font-semibold flex items-center gap-1">
      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="9" height="9">
        <polyline points="1,5 4,8 9,2"/>
      </svg>
      할당 완료
    </span>
  )}
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/features/patent-editor/RefListPanel.tsx
  git commit -m "feat: RefListPanel place banner, 3-state button, highlight, assign feedback"
  ```

---

## Task 6: DrawingsPanel — bbox 상태 시각화 개선

**File:** `src/views/SpecView.tsx`

- [ ] **Step 1: STAGE_BADGE 업데이트**

  ```typescript
  const STAGE_BADGE: Record<string, { label: string; cls: string }> = {
    'extracted':        { label: '영역 확인 필요',   cls: 'bg-amber-100 text-amber-700' },
    'bbox-adjusted':    { label: '영역 확인 완료 ✓', cls: 'bg-blue-100 text-blue-700' },
    'converting':       { label: '변환 중',           cls: 'bg-violet-100 text-violet-700' },
    'candidate-select': { label: '후보 선택 필요',   cls: 'bg-orange-100 text-orange-700' },
    'editing':          { label: '편집 중',           cls: 'bg-sky-100 text-sky-700' },
    'done':             { label: '편집 완료',         cls: 'bg-green-100 text-green-700' },
  };
  ```

- [ ] **Step 2: bbox-adjusted 카드에 조정 영역 크기 표시**

  도면 카드 name 아래:
  ```typescript
  {d.stage === 'bbox-adjusted' && d.adjustedBbox && (
    <p className="text-xs2 text-blue-500 truncate">
      {d.adjustedBbox.w}×{d.adjustedBbox.h}px 지정됨
    </p>
  )}
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/views/SpecView.tsx
  git commit -m "feat: DrawingsPanel shows bbox-adjusted status with pixel dimensions"
  ```

---

## 완료 검증

```bash
npx tsc --noEmit
npm run build
```

### 기능 검증 체크리스트

| # | 검증 항목 | 방법 | 기대 결과 |
|---|-----------|------|-----------|
| 1 | bbox 즉시 표시 | 도면 편집기 진입(stage=extracted) | 파란 박스 + 8핸들 즉시 표시 |
| 2 | bbox 드래그 조정 | 박스 드래그 | 실시간 위치/크기 변경 |
| 3 | bbox 저장 | "영역 확인 완료" 클릭 | adjustedBbox 저장 + stage='bbox-adjusted' |
| 4 | 변환 진행 | 저장 후 | 1.8초 로딩 → Step 2 후보 선택 |
| 5 | **AI 마커 표시** | Step 3(편집) 진입 | 1.2초 후 캔버스에 오렌지 원형 마커 배치됨 |
| 6 | **마커 드래그** | 마커 드래그 | 위치 이동 가능, 이동 후 posXPct/posYPct 업데이트 |
| 7 | **마커 수락** | AiRefPanel "✓" 클릭 | 마커 사라지고 해당 위치에 지시선+번호 생성 |
| 8 | **마커 거절** | AiRefPanel "✗" 클릭 | 마커만 사라짐 |
| 9 | 배치 안내 배너 | "부호 자동 부여" → "배치" 클릭 | 파란 배너 표시 + 해당 항목 하이라이트 |
| 10 | 배치 완료 상태 | 캔버스 클릭으로 지시선 생성 | "✓ 배치됨" + 배너 사라짐 |
| 11 | DrawingsPanel 상태 | bbox 확인 후 메인 탭 | 카드에 "영역 확인 완료 ✓" 배지 |
