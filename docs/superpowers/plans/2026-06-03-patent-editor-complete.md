# AXPlain.ai 특허 도면 편집기 완성 계획

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`
>
> **전제:**
> - Part A (TeX 수식 입력)는 이미 구현 완료. 이 파일은 Part B만 다룬다.
> - 작업 디렉토리: `c:\project\06_AXP\react-app`
> - Fabric.js, lucide-react 이미 설치됨
> - 기존 유틸 활용: `canvas/lineEnds.ts`, `canvas/meta.ts`, `canvas/overlay.ts`, `canvas/constants.ts`
> - 각 Task 완료 후 `npx tsc --noEmit && npm run build` 확인 후 commit

---

## 수정 대상 파일

| 파일 | 역할 |
|------|------|
| `src/features/patent-editor/types.ts` | ToolMode·LeaderCurve 타입 확장 |
| `src/features/patent-editor/EditorCanvas.tsx` | 캔버스 도구 로직 |
| `src/features/patent-editor/EditorToolbar.tsx` | 툴바 UI 버튼 |
| `src/features/patent-editor/PatentEditor.tsx` | 상태 관리·콜백 연결 |

---

## Task B-1: 미구현 도형 활성화 — 폴리라인·육각형·화살표 도형

**현재 상태:** EditorToolbar의 "도형 더보기" 메뉴에 disabled 버튼만 존재.

### B-1-1: types.ts — ToolMode 확장

- [ ] `src/features/patent-editor/types.ts`의 ToolMode에 아래 추가:

```typescript
| "hexagon"       // 육각형
| "arrow-shape"   // 화살표 도형
// "polygon"은 이미 있음 — 자유 폴리라인으로 사용
```

### B-1-2: EditorCanvas.tsx — 폴리라인(polygon) 구현

- [ ] 컴포넌트 상단에 ref 추가:

```typescript
const polylinePointsRef = useRef<{ x: number; y: number }[]>([]);
const polylinePreviewRef = useRef<fabric.Polyline | null>(null);
```

- [ ] `mouse:down` 핸들러에서 `tool === 'polygon'` 분기 추가
  (기존 rect/circle/triangle/diamond 분기 앞에 위치):

```typescript
if (tool === 'polygon') {
  polylinePointsRef.current.push(pt);
  if (polylinePreviewRef.current) fc.remove(polylinePreviewRef.current);
  const preview = new fabric.Polyline(
    [...polylinePointsRef.current, pt],
    {
      fill: 'transparent',
      stroke: '#000',
      strokeWidth: lineWeightPx,
      strokeDashArray: LINE_DASH_PATTERNS[lineStyle],
      objectCaching: false,
      selectable: false,
      evented: false,
    }
  );
  polylinePreviewRef.current = preview;
  fc.add(preview);
  fc.renderAll();
  return;
}
```

- [ ] `mouse:dblclick` 이벤트 리스너 추가 (useEffect 내 `fc.on` 블록):

```typescript
fc.on('mouse:dblclick', () => {
  if (tool !== 'polygon') return;
  if (polylinePointsRef.current.length < 2) {
    polylinePointsRef.current = [];
    if (polylinePreviewRef.current) { fc.remove(polylinePreviewRef.current); polylinePreviewRef.current = null; }
    fc.renderAll();
    return;
  }
  if (polylinePreviewRef.current) fc.remove(polylinePreviewRef.current);
  const poly = new fabric.Polyline([...polylinePointsRef.current], {
    fill: 'transparent',
    stroke: '#000',
    strokeWidth: lineWeightPx,
    strokeDashArray: LINE_DASH_PATTERNS[lineStyle],
    objectCaching: false,
  });
  fc.add(poly);
  polylinePointsRef.current = [];
  polylinePreviewRef.current = null;
  fc.renderAll();
  setTool('select');
});
```

> `lineWeightPx`는 기존 코드의 lineWeight → px 변환값을 사용한다.

### B-1-3: EditorCanvas.tsx — 육각형(hexagon) 구현

- [ ] 마우스 드래그 완료 시 `tool === 'hexagon'` 분기 추가
  (기존 `mouse:up` 또는 드래그 완료 처리 위치):

```typescript
if (tool === 'hexagon') {
  const cx = (startPt.x + pt.x) / 2;
  const cy = (startPt.y + pt.y) / 2;
  const r  = Math.min(Math.abs(pt.x - startPt.x), Math.abs(pt.y - startPt.y)) / 2;
  if (r < 5) return;
  const pts = Array.from({ length: 6 }, (_, i) => ({
    x: cx + r * Math.cos((Math.PI / 3) * i - Math.PI / 6),
    y: cy + r * Math.sin((Math.PI / 3) * i - Math.PI / 6),
  }));
  fc.add(new fabric.Polygon(pts, {
    fill: fillStyle === 'none' ? 'transparent' : '#000',
    stroke: '#000',
    strokeWidth: lineWeightPx,
    objectCaching: false,
  }));
  fc.renderAll();
  return;
}
```

### B-1-4: EditorCanvas.tsx — 화살표 도형(arrow-shape) 구현

- [ ] 드래그 완료 시 `tool === 'arrow-shape'` 분기 추가:

```typescript
if (tool === 'arrow-shape') {
  const dx = pt.x - startPt.x;
  const dy = pt.y - startPt.y;
  const len = Math.hypot(dx, dy);
  if (len < 10) return;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const bodyH = len * 0.15;
  const headH = len * 0.35;
  const headW = len * 0.25;
  const d = [
    `M 0,${-bodyH / 2}`,
    `L ${len - headH},${-bodyH / 2}`,
    `L ${len - headH},${-headW / 2}`,
    `L ${len},0`,
    `L ${len - headH},${headW / 2}`,
    `L ${len - headH},${bodyH / 2}`,
    `L 0,${bodyH / 2}`,
    'Z',
  ].join(' ');
  fc.add(new fabric.Path(d, {
    fill: '#000',
    stroke: 'none',
    left: startPt.x,
    top: startPt.y,
    originX: 'left',
    originY: 'center',
    angle,
    objectCaching: false,
  }));
  fc.renderAll();
  return;
}
```

### B-1-5: EditorToolbar.tsx — disabled 제거 + onClick 연결

- [ ] MoreBtn 내 세 항목을 아래로 교체 (disabled 제거, setTool 연결):

```typescript
// 기존 disabled 항목들을 아래로 교체
<MoreItem
  icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polygon points="7,1 13,4 13,10 7,13 1,10 1,4"/>
  </svg>}
  label="육각형"
  onClick={() => setTool('hexagon')}
/>
<MoreItem
  icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1,7 H8 M8,3 L13,7 L8,11 Z" fill="currentColor"/>
  </svg>}
  label="화살표 도형"
  onClick={() => setTool('arrow-shape')}
/>
<MoreItem
  icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="1,13 4,7 7,10 10,4 13,8"/>
  </svg>}
  label="자유 폴리라인"
  onClick={() => setTool('polygon')}
/>
```

- [ ] Commit:

```bash
git add src/features/patent-editor/
git commit -m "feat(editor): polyline, hexagon, arrow-shape tools (B-1)"
```

---

## Task B-2: 치수선 (Dimension Line)

**목적:** 두 점 사이의 거리를 표시하는 치수선(본선 + 연장선 + 거리 텍스트).

### B-2-1: types.ts

- [ ] ToolMode에 추가:

```typescript
| "dimension"
```

### B-2-2: EditorCanvas.tsx — createDimensionLine 함수

- [ ] 파일 상단(컴포넌트 바깥)에 헬퍼 함수 추가:

```typescript
function createDimensionLine(
  fc: fabric.Canvas,
  from: { x: number; y: number },
  to:   { x: number; y: number },
  strokeWidth: number,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 5) return;

  const angle    = Math.atan2(dy, dx);
  const perpAngle = angle + Math.PI / 2;
  const extLen   = 14;

  // 본선
  const mainLine = new fabric.Line([from.x, from.y, to.x, to.y], {
    stroke: '#000', strokeWidth, objectCaching: false,
  });

  // 연장선
  const makeExt = (pt: { x: number; y: number }) =>
    new fabric.Line([
      pt.x + Math.cos(perpAngle) * extLen,
      pt.y + Math.sin(perpAngle) * extLen,
      pt.x - Math.cos(perpAngle) * extLen,
      pt.y - Math.sin(perpAngle) * extLen,
    ], { stroke: '#000', strokeWidth: strokeWidth * 0.7, objectCaching: false });

  // 화살표 (buildEndDecoration 재활용)
  const arrL = buildEndDecoration('arrow', to,   from);
  const arrR = buildEndDecoration('arrow', from, to);

  // 거리 텍스트
  const label = new fabric.IText(`${Math.round(len)}`, {
    left: (from.x + to.x) / 2,
    top:  (from.y + to.y) / 2 - 16,
    fontSize: 12,
    fontFamily: FIXED_FONT_FAMILY,
    fill: '#000',
    originX: 'center',
    originY: 'center',
    objectCaching: false,
  });

  const objs: fabric.Object[] = [mainLine, makeExt(from), makeExt(to), label];
  if (arrL) objs.push(arrL);
  if (arrR) objs.push(arrR);

  const group = new fabric.Group(objs, { objectCaching: false });
  fc.add(group);
  fc.renderAll();
}
```

- [ ] 드래그 완료 핸들러에 `tool === 'dimension'` 분기 추가:

```typescript
if (tool === 'dimension') {
  createDimensionLine(fc, startPt, pt, lineWeightPx);
  return;
}
```

### B-2-3: EditorToolbar.tsx — 치수선 버튼

- [ ] "지시선 · 부호" Group에 추가:

```typescript
<ToolBtn
  active={tool === 'dimension'}
  onClick={() => setTool('dimension')}
  title="치수선 (D)"
  icon={
    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.3">
      <line x1="1" y1="7" x2="15" y2="7"/>
      <polyline points="3,4 1,7 3,10"/>
      <polyline points="13,4 15,7 13,10"/>
      <line x1="1" y1="3" x2="1" y2="11"/>
      <line x1="15" y1="3" x2="15" y2="11"/>
    </svg>
  }
  label="치수선"
/>
```

- [ ] Commit:

```bash
git add src/features/patent-editor/
git commit -m "feat(editor): dimension line tool (B-2)"
```

---

## Task B-3: 텍스트 단독 삽입 도구

**목적:** 도면 내 레이블·설명을 자유 위치에 삽입.

### B-3-1: types.ts

- [ ] ToolMode에 추가:

```typescript
| "standalone-text"
```

### B-3-2: EditorCanvas.tsx — standalone-text 클릭 핸들러

- [ ] `mouse:down` 분기에 추가 (tool === 'select' 분기 앞):

```typescript
if (tool === 'standalone-text') {
  const textObj = new fabric.IText('텍스트 입력', {
    left: pt.x,
    top:  pt.y,
    fontSize: 14,
    fontFamily: FIXED_FONT_FAMILY,
    fill: '#000',
    originX: 'center',
    originY: 'center',
    objectCaching: false,
  });
  fc.add(textObj);
  fc.setActiveObject(textObj);
  textObj.enterEditing();
  textObj.selectAll();
  fc.renderAll();
  setTool('select');
  return;
}
```

### B-3-3: EditorToolbar.tsx — 텍스트 버튼

- [ ] "기본 도구" Group에 추가 (선택 버튼 옆):

```typescript
<ToolBtn
  active={tool === 'standalone-text'}
  onClick={() => setTool('standalone-text')}
  title="텍스트 단독 삽입 (T)"
  icon={<span className="font-serif font-bold text-base leading-none">T</span>}
  label="텍스트"
/>
```

- [ ] Commit:

```bash
git add src/features/patent-editor/
git commit -m "feat(editor): standalone text insertion tool (B-3)"
```

---

## Task B-4: 트레이스 모드 (원본 이미지 Underlayer)

**목적:** 원본 도면(sourceImageUrl)을 반투명 배경으로 깔아 정밀 트레이스 지원.

### B-4-1: PatentEditor.tsx — 상태 추가

- [ ] 컴포넌트 상단에 추가:

```typescript
const [showUnderlayer,    setShowUnderlayer]    = useState(false);
const [underlayerOpacity, setUnderlayerOpacity] = useState(30); // %
```

### B-4-2: EditorCanvas.tsx — props 확장 + useEffect

- [ ] Props interface에 추가:

```typescript
underlayerImageUrl?: string;
showUnderlayer?:    boolean;
underlayerOpacity?: number; // 0~100
```

- [ ] useEffect 추가 (fc 초기화 이후):

```typescript
useEffect(() => {
  if (!fc) return;
  const UNDERLAYER = 'underlayer';
  // 기존 underlayer 제거
  const existing = fc.getObjects().find(
    o => getMeta(o, META.isOverlay) === UNDERLAYER
  );
  if (existing) { fc.remove(existing); fc.renderAll(); }
  if (!showUnderlayer || !underlayerImageUrl) return;

  fabric.Image.fromURL(underlayerImageUrl, (img) => {
    const scaleX = (fc.width  ?? 800) / (img.width  ?? 1);
    const scaleY = (fc.height ?? 600) / (img.height ?? 1);
    const scale  = Math.min(scaleX, scaleY);
    img.set({
      left: 0, top: 0,
      scaleX: scale, scaleY: scale,
      opacity: (underlayerOpacity ?? 30) / 100,
      selectable: false, evented: false,
      objectCaching: false,
      excludeFromExport: true,
    });
    setMeta(img, META.isOverlay, UNDERLAYER as any);
    fc.add(img);
    fc.sendObjectToBack(img);
    // 그리드·여백 가이드를 다시 맨 앞으로
    fc.getObjects()
      .filter(o => isOverlay(o) && getMeta(o, META.isOverlay) !== UNDERLAYER)
      .forEach(o => fc.bringObjectToFront(o));
    fc.renderAll();
  });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [fc, showUnderlayer, underlayerOpacity, underlayerImageUrl]);
```

> `isOverlay`, `getMeta`, `setMeta`, `META`는 기존 import 사용.

### B-4-3: PatentEditor.tsx → EditorCanvas props 연결

- [ ] EditorCanvas 호출부에 추가:

```typescript
underlayerImageUrl={drawings.find(d => d.id === activeDrawingId)?.sourceImageUrl}
showUnderlayer={showUnderlayer}
underlayerOpacity={underlayerOpacity}
```

### B-4-4: EditorToolbar.tsx — 트레이스 컨트롤

- [ ] Props interface에 추가:

```typescript
showUnderlayer:    boolean;
underlayerOpacity: number;
onToggleUnderlayer: () => void;
onUnderlayerOpacity: (v: number) => void;
```

- [ ] "보기" Group에 추가:

```typescript
<OptBtn
  active={showUnderlayer}
  onClick={onToggleUnderlayer}
  title="원본 이미지 트레이스 모드"
>
  <svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="2" y="2" width="12" height="10" rx="1" opacity="0.35" fill="currentColor"/>
    <path d="M2,10 L5,7 L8,9 L11,6 L14,9" strokeWidth="1.6" opacity="1"/>
  </svg>
  <span className="ml-1 text-xs2">트레이스</span>
</OptBtn>
{showUnderlayer && (
  <div className="flex items-center gap-1 h-8 ml-1">
    <input
      type="range" min={10} max={70} step={5}
      value={underlayerOpacity}
      onChange={e => onUnderlayerOpacity(Number(e.target.value))}
      className="w-16 accent-blue-600"
      style={{ height: 4 }}
    />
    <span className="text-xs2 text-zinc-400 w-7">{underlayerOpacity}%</span>
  </div>
)}
```

- [ ] PatentEditor.tsx에서 EditorToolbar에 props 전달:

```typescript
showUnderlayer={showUnderlayer}
underlayerOpacity={underlayerOpacity}
onToggleUnderlayer={() => setShowUnderlayer(o => !o)}
onUnderlayerOpacity={setUnderlayerOpacity}
```

- [ ] Commit:

```bash
git add src/features/patent-editor/
git commit -m "feat(editor): tracing underlayer mode with opacity slider (B-4)"
```

---

## Task B-5: Copy·Paste·Delete + 정렬 도구

### B-5-1: PatentEditor.tsx — 클립보드 + 단축키 리스너

- [ ] 컴포넌트 상단에 추가:

```typescript
const clipboardRef = useRef<fabric.Object | null>(null);
```

- [ ] useEffect 추가:

```typescript
useEffect(() => {
  const handleKey = (e: KeyboardEvent) => {
    const tag = (document.activeElement as HTMLElement)?.tagName ?? '';
    if (['INPUT', 'TEXTAREA'].includes(tag)) return;
    const fc = canvasHandleRef.current?.getCanvas();
    if (!fc) return;

    // 복사
    if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      const active = fc.getActiveObject();
      if (active) active.clone((cloned: fabric.Object) => { clipboardRef.current = cloned; });
    }
    // 붙여넣기
    if ((e.metaKey || e.ctrlKey) && e.key === 'v' && clipboardRef.current) {
      clipboardRef.current.clone((cloned: fabric.Object) => {
        cloned.set({ left: (cloned.left ?? 0) + 20, top: (cloned.top ?? 0) + 20 });
        fc.add(cloned);
        fc.setActiveObject(cloned);
        clipboardRef.current = cloned; // 반복 붙여넣기 오프셋
        fc.renderAll();
      });
    }
    // 전체 선택
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      const targets = fc.getObjects().filter(o => !isOverlay(o));
      if (targets.length) {
        const sel = new fabric.ActiveSelection(targets, { canvas: fc });
        fc.setActiveObject(sel);
        fc.renderAll();
      }
    }
    // 삭제
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
      const actives = fc.getActiveObjects();
      if (actives.length) {
        fc.remove(...actives);
        fc.discardActiveObject();
        fc.renderAll();
      }
    }
  };
  document.addEventListener('keydown', handleKey);
  return () => document.removeEventListener('keydown', handleKey);
}, []);
```

> `isOverlay`는 `canvas/overlay.ts`에서 import.

### B-5-2: PatentEditor.tsx — 정렬 함수

- [ ] 컴포넌트 내부에 추가:

```typescript
const alignObjects = (dir: 'left'|'right'|'top'|'bottom'|'centerH'|'centerV') => {
  const fc = canvasHandleRef.current?.getCanvas();
  if (!fc) return;
  const objs = fc.getActiveObjects();
  if (objs.length < 2) return;

  const bounds = objs.reduce(
    (b, o) => {
      const l = o.left ?? 0, t = o.top ?? 0;
      const w = (o.width  ?? 0) * (o.scaleX ?? 1);
      const h = (o.height ?? 0) * (o.scaleY ?? 1);
      return { l: Math.min(b.l, l), t: Math.min(b.t, t), r: Math.max(b.r, l + w), b: Math.max(b.b, t + h) };
    },
    { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity }
  );

  objs.forEach(o => {
    const w = (o.width  ?? 0) * (o.scaleX ?? 1);
    const h = (o.height ?? 0) * (o.scaleY ?? 1);
    if (dir === 'left')    o.set({ left: bounds.l });
    if (dir === 'right')   o.set({ left: bounds.r - w });
    if (dir === 'top')     o.set({ top:  bounds.t });
    if (dir === 'bottom')  o.set({ top:  bounds.b - h });
    if (dir === 'centerH') o.set({ left: (bounds.l + bounds.r) / 2 - w / 2 });
    if (dir === 'centerV') o.set({ top:  (bounds.t + bounds.b) / 2 - h / 2 });
  });
  fc.renderAll();
};
```

### B-5-3: EditorToolbar.tsx — 정렬 그룹 + Props

- [ ] Props interface에 추가:

```typescript
onAlign: (dir: 'left'|'right'|'top'|'bottom'|'centerH'|'centerV') => void;
```

- [ ] 기존 DIVIDER 뒤 (지우기 그룹 뒤)에 정렬 Group 추가:

```typescript
<div className={DIVIDER} />
<Group label="정렬">
  <MoreBtn label="정렬">
    <MoreItem
      icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="2" x2="2" y2="12"/><rect x="4" y="4" width="4" height="3" rx="0.5"/><rect x="4" y="8" width="6" height="3" rx="0.5"/></svg>}
      label="왼쪽 정렬" onClick={() => onAlign('left')} />
    <MoreItem
      icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="2" x2="12" y2="12"/><rect x="6" y="4" width="4" height="3" rx="0.5"/><rect x="4" y="8" width="6" height="3" rx="0.5"/></svg>}
      label="오른쪽 정렬" onClick={() => onAlign('right')} />
    <MoreItem
      icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="2" x2="12" y2="2"/><rect x="3" y="4" width="3" height="4" rx="0.5"/><rect x="7" y="4" width="3" height="6" rx="0.5"/></svg>}
      label="위쪽 정렬" onClick={() => onAlign('top')} />
    <MoreItem
      icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="12" x2="12" y2="12"/><rect x="3" y="4" width="3" height="4" rx="0.5"/><rect x="7" y="2" width="3" height="6" rx="0.5"/></svg>}
      label="아래쪽 정렬" onClick={() => onAlign('bottom')} />
    <MoreItem
      icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="7" y1="2" x2="7" y2="12"/><rect x="4" y="4" width="6" height="3" rx="0.5"/><rect x="3" y="8" width="8" height="3" rx="0.5"/></svg>}
      label="수평 중앙 정렬" onClick={() => onAlign('centerH')} />
    <MoreItem
      icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="7" x2="12" y2="7"/><rect x="4" y="4" width="3" height="6" rx="0.5"/><rect x="8" y="3" width="3" height="8" rx="0.5"/></svg>}
      label="수직 중앙 정렬" onClick={() => onAlign('centerV')} />
  </MoreBtn>
</Group>
```

- [ ] PatentEditor.tsx에서 EditorToolbar에 `onAlign={alignObjects}` 전달.

- [ ] Commit:

```bash
git add src/features/patent-editor/
git commit -m "feat(editor): copy/paste, delete, select-all, alignment tools (B-5)"
```

---

## Task B-6: 도면 번호 자동 삽입

**목적:** "도 N" 텍스트를 캔버스 하단 중앙에 자동 삽입.

### B-6-1: PatentEditor.tsx — insertDrawingTitle 함수

- [ ] 추가:

```typescript
const insertDrawingTitle = () => {
  const fc = canvasHandleRef.current?.getCanvas();
  if (!fc) return;
  // 기존 도면 번호 텍스트 제거
  const existing = fc.getObjects().find(
    o => o instanceof fabric.IText && /^도\s\d+$/.test((o as fabric.IText).text ?? '')
  );
  if (existing) fc.remove(existing);

  const idx = drawings.findIndex(d => d.id === activeDrawingId);
  const titleObj = new fabric.IText(`도 ${idx + 1}`, {
    left:       (fc.width  ?? 800) / 2,
    top:        (fc.height ?? 600) - 30,
    fontSize:   16,
    fontFamily: FIXED_FONT_FAMILY,
    fontWeight: 'bold',
    fill:       '#000',
    originX:    'center',
    originY:    'center',
    objectCaching: false,
  });
  fc.add(titleObj);
  fc.renderAll();
};
```

### B-6-2: EditorToolbar.tsx — 도면 번호 버튼 + Props

- [ ] Props에 추가:

```typescript
onInsertDrawingTitle?: () => void;
```

- [ ] "보기" Group의 MoreBtn 내에 추가:

```typescript
<MoreItem
  icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <text x="1" y="11" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none">도1</text>
  </svg>}
  label="도면 번호 삽입 (도 N)"
  onClick={() => onInsertDrawingTitle?.()}
/>
```

- [ ] PatentEditor.tsx → EditorToolbar에 `onInsertDrawingTitle={insertDrawingTitle}` 전달.

- [ ] Commit:

```bash
git add src/features/patent-editor/
git commit -m "feat(editor): drawing title auto-insert (도 N) (B-6)"
```

---

## Task B-7: 꺾인 지시선 (Elbow Leader Line)

**목적:** L자 꺾임 형태의 지시선 — 특허 도면에서 가장 보편적 형태.

### B-7-1: types.ts — LeaderCurve 확장

- [ ] LeaderCurve에 추가:

```typescript
| "elbow"
```

### B-7-2: EditorCanvas.tsx — createElbowLeader 함수

- [ ] 파일 상단(컴포넌트 바깥)에 추가:

```typescript
function createElbowLeader(
  fc:          fabric.Canvas,
  anchor:      { x: number; y: number },
  textPos:     { x: number; y: number },
  ref:         EditorReference,
  strokeWidth: number,
): void {
  const elbowX = textPos.x;
  const pathStr = `M ${anchor.x},${anchor.y} L ${elbowX},${anchor.y} L ${elbowX},${textPos.y}`;

  const leaderPath = new fabric.Path(pathStr, {
    fill: 'transparent',
    stroke: '#000',
    strokeWidth,
    objectCaching: false,
  });

  // anchor 끝 화살표
  const tangentFrom = { x: elbowX, y: anchor.y };
  const arrow = buildEndDecoration('arrow', tangentFrom, anchor);

  const label = new fabric.IText(ref.number, {
    left:       textPos.x,
    top:        textPos.y,
    fontSize:   14,
    fontFamily: FIXED_FONT_FAMILY,
    fill:       '#000',
    originX:    'center',
    originY:    'center',
    objectCaching: false,
  });
  setMeta(label, META.refNumber, ref.number);

  const objs: fabric.Object[] = [leaderPath, label];
  if (arrow) objs.push(arrow);
  objs.forEach(o => fc.add(o));
  fc.renderAll();
}
```

- [ ] leader 생성 분기(leaderCurve 판별부)에 추가:

```typescript
if (leaderCurve === 'elbow') {
  createElbowLeader(fc, anchor, textPos, selectedRef, lineWeightPx);
  return;
}
```

### B-7-3: EditorToolbar.tsx — 꺾임 버튼

- [ ] "연결선" Group에 추가 (직선/S자 옆):

```typescript
<OptBtn
  active={leaderCurve === 'elbow'}
  onClick={() => setLeaderCurve('elbow')}
  title="꺾인 지시선 (L자)"
>
  <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M4,13 L4,4 L18,4"/>
    <polygon points="2,14 4,11 6,14" fill="currentColor" stroke="none"/>
  </svg>
  <span className="ml-1 text-xs2">꺾임</span>
</OptBtn>
```

- [ ] Commit:

```bash
git add src/features/patent-editor/
git commit -m "feat(editor): elbow (L-shape) leader line tool (B-7)"
```

---

## Task B-8: 고해상도 내보내기

**목적:** 특허청 제출용 300dpi+ 내보내기 지원.

### B-8-1: PatentEditor.tsx — exportScale 상태

- [ ] 추가:

```typescript
const [exportScale, setExportScale] = useState<1|2|3|4>(2);
```

### B-8-2: PatentEditor.tsx — handleExport 수정

- [ ] 기존 내보내기 로직을 아래로 교체:

```typescript
const handleExport = async () => {
  const fc = canvasHandleRef.current?.getCanvas();
  if (!fc) return;
  setBusy(true);

  // 오버레이(그리드·여백·underlayer) 임시 숨김
  const overlayObjs = fc.getObjects().filter(o => isOverlay(o));
  overlayObjs.forEach(o => o.set({ visible: false }));
  fc.renderAll();

  const dataUrl = fc.toDataURL({
    format: 'png',
    multiplier: exportScale,
    quality: 1,
  });

  overlayObjs.forEach(o => o.set({ visible: true }));
  fc.renderAll();

  // dataUrl → Blob
  const [header, body] = dataUrl.split(',');
  const mime   = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(body);
  const u8     = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
  const blob = new Blob([u8], { type: mime });

  onExportComplete(activeDrawingId, blob);
  setBusy(false);
};
```

### B-8-3: EditorToolbar.tsx — 해상도 드롭다운 + Props

- [ ] Props에 추가:

```typescript
exportScale:      1|2|3|4;
onExportScale:    (v: 1|2|3|4) => void;
```

- [ ] "내보내기" 버튼 바로 앞에 삽입:

```typescript
<select
  value={exportScale}
  onChange={e => onExportScale(Number(e.target.value) as 1|2|3|4)}
  className="h-8 border border-zinc-300 rounded px-1.5 text-xs2 bg-white text-zinc-600"
  title="내보내기 해상도"
>
  <option value={1}>×1 · 화면</option>
  <option value={2}>×2 · 144dpi</option>
  <option value={3}>×3 · 216dpi</option>
  <option value={4}>×4 · 288dpi</option>
</select>
```

- [ ] PatentEditor.tsx → EditorToolbar에 `exportScale={exportScale}` `onExportScale={setExportScale}` 전달.

- [ ] Commit:

```bash
git add src/features/patent-editor/
git commit -m "feat(editor): hi-res export ×1~×4, overlay exclusion (B-8)"
```

---

## Task B-9: 단축키 체계 완성

**목적:** 모든 도구를 키보드 단축키로 전환 + 도움말 팝업.

### B-9-1: PatentEditor.tsx — 단축키 리스너

- [ ] B-5에서 추가한 keydown 리스너에 도구 단축키 추가 (하나의 리스너로 통합):

```typescript
useEffect(() => {
  const handleKey = (e: KeyboardEvent) => {
    const tag = (document.activeElement as HTMLElement)?.tagName ?? '';
    if (['INPUT', 'TEXTAREA'].includes(tag)) return;
    const fc = canvasHandleRef.current?.getCanvas();
    if (!fc) return;

    // ── 도구 전환 ──────────────────────────────────────────
    const keyMap: Record<string, ToolMode | 'escape' | 'grid'> = {
      v: 'select',
      l: 'line',
      t: 'standalone-text',
      r: 'rect',
      o: 'circle',
      p: 'polygon',       // polyline
      d: 'dimension',
      e: 'marquee-eraser',
      g: 'grid',
    };
    const mapped = keyMap[e.key.toLowerCase()];
    if (mapped && !e.metaKey && !e.ctrlKey) {
      if (mapped === 'grid') { toggleGrid(); return; }
      setTool(mapped as ToolMode);
      return;
    }
    if (e.key === 'Escape') {
      fc.discardActiveObject();
      setTool('select');
      fc.renderAll();
      return;
    }

    // ── 편집 단축키 (B-5 리스너와 통합) ──────────────────
    if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      const active = fc.getActiveObject();
      if (active) active.clone((cloned: fabric.Object) => { clipboardRef.current = cloned; });
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'v' && clipboardRef.current) {
      clipboardRef.current.clone((cloned: fabric.Object) => {
        cloned.set({ left: (cloned.left ?? 0) + 20, top: (cloned.top ?? 0) + 20 });
        fc.add(cloned);
        fc.setActiveObject(cloned);
        clipboardRef.current = cloned;
        fc.renderAll();
      });
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      const targets = fc.getObjects().filter(o => !isOverlay(o));
      if (targets.length) {
        const sel = new fabric.ActiveSelection(targets, { canvas: fc });
        fc.setActiveObject(sel);
        fc.renderAll();
      }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
      const actives = fc.getActiveObjects();
      if (actives.length) { fc.remove(...actives); fc.discardActiveObject(); fc.renderAll(); }
    }
  };
  document.addEventListener('keydown', handleKey);
  return () => document.removeEventListener('keydown', handleKey);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

> B-5에서 추가한 단축키 리스너가 있으면 제거하고 이 리스너로 통합한다.

### B-9-2: EditorToolbar.tsx — 단축키 도움말 버튼

- [ ] 툴바 맨 오른쪽(저장/내보내기 그룹 뒤)에 추가:

```typescript
<div className={DIVIDER} />
<ShortcutHelpBtn />
```

- [ ] `ShortcutHelpBtn` 컴포넌트 (같은 파일 하단에 추가):

```typescript
function ShortcutHelpBtn() {
  const [open, setOpen] = useState(false);
  const SHORTCUTS = [
    ['V', '선택'],          ['L', '지시선'],
    ['T', '텍스트'],        ['R', '사각형'],
    ['O', '원'],            ['P', '폴리라인'],
    ['D', '치수선'],        ['E', '지우기'],
    ['G', '그리드 토글'],   ['Esc', '선택 해제'],
    ['Ctrl+C', '복사'],     ['Ctrl+V', '붙여넣기'],
    ['Delete', '삭제'],     ['Ctrl+A', '전체 선택'],
    ['Ctrl+Z', '실행취소'], ['Ctrl+Y', '다시실행'],
  ];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`${BTN_BASE} w-7 ${open ? BTN_ACTIVE : BTN_INACTIVE}`}
        title="단축키 도움말"
      >
        <span className="text-sm font-bold">?</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 bg-white border border-ck-border rounded-xl shadow-lg z-50 p-3 w-56"
          onMouseLeave={() => setOpen(false)}
        >
          <p className="text-xs2 font-bold text-zinc-600 mb-2">단축키</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-300 rounded text-xs2 font-mono shrink-0">
                  {k}
                </kbd>
                <span className="text-xs2 text-zinc-500">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] Commit:

```bash
git add src/features/patent-editor/
git commit -m "feat(editor): unified keyboard shortcuts + shortcut help panel (B-9)"
```

---

## 완료 검증 체크리스트

모든 Task 완료 후 아래를 순서대로 확인한다.

```bash
# 타입 오류 없음
npx tsc --noEmit

# 빌드 성공
npm run build
```

| 기능 | 검증 방법 |
|------|-----------|
| 폴리라인 | 도구 선택 → 클릭×3 → 더블클릭 → 꺾인 선 완성 |
| 육각형 | 도구 선택 → 드래그 → 정육각형 생성 |
| 화살표 도형 | 드래그 방향으로 화살표 도형 생성 |
| 치수선 | 드래그 → 본선+연장선+거리(px) 표시 |
| 텍스트 단독 | 도구 선택 → 캔버스 클릭 → 편집 모드 진입 |
| 트레이스 | 버튼 토글 → 원본 이미지 반투명 표시, 슬라이더 동작 |
| 복사/붙여넣기 | Ctrl+C → Ctrl+V → +20px 오프셋 복사 |
| Delete 삭제 | 객체 선택 → Delete 키 → 삭제 |
| 정렬 | 2개 선택 → 정렬 메뉴 → 정렬 적용 |
| 도면 번호 | 메뉴 → "도면 번호 삽입" → "도 1" 하단 중앙 삽입 |
| 꺾인 지시선 | leaderCurve=elbow → 지시선 도구 → L자 지시선 |
| 내보내기 해상도 | ×3 선택 → 내보내기 → 파일 크기 3배 확인 |
| 단축키 | V/L/T/R/O/P/D/E/G 키 각각 도구 전환 확인 |
| ? 버튼 | 클릭 시 단축키 팝업 표시 |
