# AXPlain.ai 에디터 고도화 계획

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`
>
> **전제:** 기존 버그 수정 계획(2026-06-02-axp-spec-workflow-plan.md)과 독립적으로 실행 가능하다.
> 이 계획은 두 영역으로 구성된다:
> - **Part A**: 명세서 에디터 — TeX 수식 입력 완성
> - **Part B**: 특허 도면 편집기(PatentEditor) — 핵심 기능 완성

---

## 현황 진단

### 명세서 에디터 수식 입력 (현재 20% → 목표 80%)

**현재:**
- `SpecEditorView.tsx`의 수식 입력 모달이 텍스트 input 하나뿐
- 특수문자 팔레트(∑, ∫, π 등)만 있고 TeX 렌더링 없음
- 수식이 본문에 `[수식: E=mc²]` 텍스트 형태로 삽입됨
- 이용자가 수식이 제대로 표시되는지 확인 불가

**필요:**
- TeX 입력 → 실시간 렌더링 미리보기
- 수식이 본문에 렌더링된 이미지 또는 MathML 형태로 삽입
- 특허 명세서에 자주 쓰이는 수식 템플릿

### 도면 편집기 (현재 50% → 목표 80%)

**현재 구현:**
- Fabric.js 캔버스
- 지시선(leader line) + 참조번호/원형 부호
- 기본 도형(사각형/원/삼각형/마름모)
- 선 스타일 5종 (실선/파선/1점쇄/2점쇄/점선)
- 선 굵기 3단계, 끝단 4종, 직선/S곡선 연결
- 해칭(사선/격자), 영역/브러시 지우기

**미구현/disabled:**
- 육각형·화살표 도형·자유 다각형 (disabled 버튼만 있음)
- 치수선(dimension line) 없음
- 꺾인 폴리라인 지시선 없음
- 텍스트 단독 삽입 없음
- 원본 이미지 underlayer 없음 (bbox로 자른 이미지 위에 트레이스)
- 객체 Copy/Paste 없음
- 정렬 도구 없음
- 도면 번호 자동 삽입 없음

---

## Part A: 명세서 에디터 — TeX 수식 입력

### A-1: KaTeX 설치

**Files:** `package.json`, `src/views/SpecEditorView.tsx`

- [ ] **Step 1: KaTeX 설치**

  ```bash
  cd c:\project\06_AXP\react-app && npm install katex && npm install -D @types/katex
  ```

- [ ] **Step 2: KaTeX CSS 로드**

  `src/main.tsx` 또는 `src/index.css` 상단에 추가:
  ```typescript
  // main.tsx
  import 'katex/dist/katex.min.css';
  ```

- [ ] **Step 3: 빌드 확인**

  ```bash
  npm run build 2>&1 | tail -10
  ```

---

### A-2: 수식 입력 모달 — 실시간 TeX 렌더링

**Files:** `src/views/SpecEditorView.tsx`

- [ ] **Step 1: FormulaModal 컴포넌트 교체**

  현재 단순 text input 모달을 TeX 렌더링 모달로 교체:

  ```typescript
  // SpecEditorView.tsx 상단에 import 추가
  import katex from 'katex';

  // FormulaModal 상태
  const [formulaModal, setFormulaModal] = useState(false);
  const [formulaVal, setFormulaVal] = useState('');
  const [formulaMode, setFormulaMode] = useState<'inline' | 'block'>('inline');
  const [formulaError, setFormulaError] = useState('');

  // TeX 렌더링 헬퍼
  const renderTeX = (tex: string): { html: string; error?: string } => {
    try {
      const html = katex.renderToString(tex, {
        throwOnError: true,
        displayMode: formulaMode === 'block',
        output: 'html',
      });
      return { html };
    } catch (e: unknown) {
      return { html: '', error: (e as Error).message };
    }
  };
  ```

- [ ] **Step 2: 수식 입력 모달 UI**

  ```typescript
  {formulaModal && (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setFormulaModal(false)}>
      <div className="bg-white rounded-xl shadow-card-deep w-[560px]" onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200">
          <h3 className="text-base2 font-bold text-zinc-800">수식 입력 (TeX / LaTeX)</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs2 text-zinc-400">모드:</span>
            <button
              onClick={() => setFormulaMode('inline')}
              className={clsx('px-2 py-1 rounded text-xs2', formulaMode === 'inline' ? 'bg-blue-100 text-blue-700 font-semibold' : 'bg-zinc-100 text-zinc-500')}>
              인라인
            </button>
            <button
              onClick={() => setFormulaMode('block')}
              className={clsx('px-2 py-1 rounded text-xs2', formulaMode === 'block' ? 'bg-blue-100 text-blue-700 font-semibold' : 'bg-zinc-100 text-zinc-500')}>
              블록
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* TeX 입력란 */}
          <div>
            <label className="block text-xs2 font-semibold text-zinc-600 mb-1">TeX 수식</label>
            <textarea
              autoFocus
              className="w-full input py-2 font-mono text-sm resize-none"
              rows={3}
              placeholder="예: E = mc^{2}  또는  \frac{a}{b} = \sqrt{c^2 + d^2}"
              value={formulaVal}
              onChange={e => { setFormulaVal(e.target.value); setFormulaError(''); }}
            />
          </div>

          {/* 실시간 렌더링 미리보기 */}
          <div>
            <label className="block text-xs2 font-semibold text-zinc-600 mb-1">미리보기</label>
            <div className={clsx(
              'min-h-[60px] rounded-lg border px-4 py-3 flex items-center',
              formulaMode === 'block' ? 'justify-center' : 'justify-start',
              formulaError ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-zinc-50'
            )}>
              {formulaVal.trim() ? (
                formulaError ? (
                  <span className="text-xs2 text-red-500">⚠️ {formulaError}</span>
                ) : (
                  <span
                    dangerouslySetInnerHTML={{ __html: renderTeX(formulaVal).html }}
                    className={formulaMode === 'block' ? 'text-xl' : 'text-base'}
                  />
                )
              ) : (
                <span className="text-zinc-400 text-xs2">수식을 입력하면 여기에 표시됩니다</span>
              )}
            </div>
          </div>

          {/* 특수문자 팔레트 */}
          <div>
            <label className="block text-xs2 font-semibold text-zinc-600 mb-1.5">자주 쓰는 TeX</label>
            <div className="flex flex-wrap gap-1">
              {FORMULA_TEMPLATES.map(t => (
                <button
                  key={t.label}
                  onClick={() => setFormulaVal(v => v + t.tex)}
                  title={t.title}
                  className="px-2 py-1 border border-zinc-200 rounded text-xs2 font-mono hover:bg-zinc-100 hover:border-zinc-400 transition-colors">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5 justify-end">
          <button onClick={() => setFormulaModal(false)} className="btn-outline btn-sm">취소</button>
          <button
            onClick={insertFormula}
            disabled={!formulaVal.trim() || !!formulaError}
            className="btn-primary btn-sm disabled:opacity-40">
            삽입
          </button>
        </div>
      </div>
    </div>
  )}
  ```

- [ ] **Step 3: FORMULA_TEMPLATES 상수 정의**

  ```typescript
  const FORMULA_TEMPLATES = [
    { label: '분수', tex: '\\frac{a}{b}', title: '분수' },
    { label: '제곱근', tex: '\\sqrt{x}', title: '제곱근' },
    { label: 'n제곱근', tex: '\\sqrt[n]{x}', title: 'n제곱근' },
    { label: '합산', tex: '\\sum_{i=1}^{n}', title: '합산 (시그마)' },
    { label: '적분', tex: '\\int_{a}^{b}', title: '정적분' },
    { label: '극한', tex: '\\lim_{x \\to \\infty}', title: '극한' },
    { label: '편미분', tex: '\\frac{\\partial f}{\\partial x}', title: '편미분' },
    { label: '벡터', tex: '\\vec{v}', title: '벡터' },
    { label: '행렬', tex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', title: '2×2 행렬' },
    { label: '≤', tex: '\\leq', title: '이하' },
    { label: '≥', tex: '\\geq', title: '이상' },
    { label: '≠', tex: '\\neq', title: '같지 않음' },
    { label: '∈', tex: '\\in', title: '포함' },
    { label: 'α β γ', tex: '\\alpha \\beta \\gamma', title: '그리스 문자' },
    { label: 'E=mc²', tex: 'E = mc^{2}', title: 'Einstein 공식 예시' },
  ];
  ```

- [ ] **Step 4: insertFormula 함수 수정 — TeX 렌더링 이미지 삽입**

  수식을 렌더링된 HTML span으로 삽입 (또는 텍스트 fallback):
  ```typescript
  const insertFormula = () => {
    if (!sel || !formulaVal.trim()) return;
    const rendered = renderTeX(formulaVal);
    if (rendered.error) { setFormulaError(rendered.error); return; }

    const cur = blocks[sel.sid][sel.idx] || '';
    // 인라인: 현재 단락에 TeX 표기 삽입 ($...$)
    // 블록: 새 단락으로 삽입 ($$...$$)
    const marker = formulaMode === 'inline'
      ? `$${formulaVal}$`
      : `\n$$\n${formulaVal}\n$$\n`;
    updateBlock(sel.sid, sel.idx, cur + marker);
    setFormulaModal(false);
    setFormulaVal('');
  };
  ```

  > 단락 내 `$...$`와 `$$...$$` 마커를 렌더링 시 KaTeX로 치환하는 `renderBlockContent()` 함수도 추가한다.

- [ ] **Step 5: 블록 렌더링 시 TeX 마커 치환**

  `SpecEditorView.tsx`의 블록 표시 p 태그에 TeX 렌더링 적용:
  ```typescript
  function renderBlockWithTeX(text: string): string {
    // $$...$$ 블록 수식
    let result = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
      try { return katex.renderToString(tex.trim(), { displayMode: true }); }
      catch { return `<span class="text-red-400 text-xs">[수식 오류: ${tex}]</span>`; }
    });
    // $...$ 인라인 수식
    result = result.replace(/\$([^$]+)\$/g, (_, tex) => {
      try { return katex.renderToString(tex.trim(), { displayMode: false }); }
      catch { return `<span class="text-red-400 text-xs">[수식 오류: ${tex}]</span>`; }
    });
    return result;
  }

  // 블록 표시 p 태그를 조건부로 dangerouslySetInnerHTML 사용
  {blockText.includes('$') ? (
    <p className="text-sm leading-relaxed whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: renderBlockWithTeX(blockText) }} />
  ) : (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">{blockText}</p>
  )}
  ```

- [ ] **Step 6: 브라우저 확인**

  1. 에디터 진입 → ∑ 버튼 클릭
  2. `\frac{\partial^2 f}{\partial x^2} = 0` 입력
  3. 미리보기에 렌더링된 수식 표시 확인
  4. "삽입" → 본문에 `$...$` 형태로 삽입되고 렌더링 확인

- [ ] **Step 7: Commit**

  ```bash
  git add -A
  git commit -m "feat: TeX formula editor with KaTeX live preview and inline rendering"
  ```

---

## Part B: 특허 도면 편집기 (PatentEditor) 고도화

### B-1: 미구현 도형 완성 (disabled 버튼 활성화)

**Files:** `src/features/patent-editor/EditorCanvas.tsx`, `src/features/patent-editor/EditorToolbar.tsx`

- [ ] **Step 1: 자유 다각형(Polyline) 도구 구현**

  `EditorCanvas.tsx`에 polyline 도구 로직 추가:

  ```typescript
  // polyline 상태
  const polylinePoints = useRef<Pt[]>([]);
  const polylinePreview = useRef<fabric.Polyline | null>(null);

  // tool === 'polygon' (polyline 모드) 핸들러
  // mouse:down: 점 추가, dblclick: 완성
  const handlePolylineClick = (pt: Pt) => {
    polylinePoints.current.push(pt);
    // 미리보기 업데이트
    if (polylinePreview.current) fc.remove(polylinePreview.current);
    polylinePreview.current = new fabric.Polyline(polylinePoints.current, {
      fill: 'transparent',
      stroke: '#000',
      strokeWidth: 1.5,
      strokeDashArray: LINE_DASH_PATTERNS[lineStyle],
      objectCaching: false,
    });
    fc.add(polylinePreview.current);
  };

  const finishPolyline = () => {
    if (polylinePoints.current.length < 2) return;
    if (polylinePreview.current) fc.remove(polylinePreview.current);
    const poly = new fabric.Polyline([...polylinePoints.current], {
      fill: 'transparent',
      stroke: '#000',
      strokeWidth: lineWeightPx,
      strokeDashArray: LINE_DASH_PATTERNS[lineStyle],
      objectCaching: false,
    });
    fc.add(poly);
    polylinePoints.current = [];
    polylinePreview.current = null;
    fc.renderAll();
  };
  ```

  EditorToolbar에서 polygon 버튼 `disabled` 제거.

- [ ] **Step 2: 육각형 도형 구현**

  `hexagon` ToolMode 추가 및 Fabric.js Polygon으로 구현:

  ```typescript
  // types.ts에 추가
  | "hexagon"

  // EditorCanvas.tsx
  if (tool === 'hexagon') {
    // 마우스 드래그로 외접원 반지름 결정
    const r = Math.max(Math.abs(dx), Math.abs(dy)) / 2;
    const cx = Math.min(startPt.x, pt.x) + Math.abs(dx) / 2;
    const cy = Math.min(startPt.y, pt.y) + Math.abs(dy) / 2;
    const pts = Array.from({ length: 6 }, (_, i) => ({
      x: cx + r * Math.cos((Math.PI / 3) * i - Math.PI / 6),
      y: cy + r * Math.sin((Math.PI / 3) * i - Math.PI / 6),
    }));
    fc.add(new fabric.Polygon(pts, { fill: 'transparent', stroke: '#000', strokeWidth: lineWeightPx }));
  }
  ```

- [ ] **Step 3: 화살표 도형 구현**

  ```typescript
  | "arrow-shape"

  // 드래그 방향으로 화살표 도형 생성
  const makeArrowShape = (from: Pt, to: Pt): fabric.Path => {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const headW = len * 0.3;
    const headH = len * 0.4;
    const bodyH = len * 0.15;
    // 기본 가로 화살표 path (0,0 → len,0)
    const d = `
      M 0,${-bodyH/2}
      L ${len - headH},${-bodyH/2}
      L ${len - headH},${-headW/2}
      L ${len},0
      L ${len - headH},${headW/2}
      L ${len - headH},${bodyH/2}
      L 0,${bodyH/2}
      Z
    `;
    return new fabric.Path(d, {
      fill: '#000',
      stroke: 'none',
      angle: (angle * 180) / Math.PI,
      left: from.x,
      top: from.y,
      originX: 'left', originY: 'center',
    });
  };
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/patent-editor/
  git commit -m "feat: patent editor — polyline, hexagon, arrow-shape tools enabled"
  ```

---

### B-2: 치수선(Dimension Line) 도구

특허 도면에서 크기/거리를 표시하는 치수선은 독립 도구로 구현한다.

**Files:** `src/features/patent-editor/types.ts`, `src/features/patent-editor/EditorCanvas.tsx`, `src/features/patent-editor/EditorToolbar.tsx`

- [ ] **Step 1: `ToolMode`에 추가**

  ```typescript
  // types.ts
  | "dimension"  // 치수선
  ```

- [ ] **Step 2: 치수선 그리기 로직**

  드래그 시작→끝으로 치수선 생성. 치수선은 3개 요소로 구성:
  - 본선 (dimension line): 양 끝 화살표
  - 연장선 (extension lines): 양쪽 수직선
  - 치수 텍스트: 중앙에 거리(px) 표시

  ```typescript
  const createDimensionLine = (fc: fabric.Canvas, from: Pt, to: Pt, lineWeightPx: number) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // 본선 (양 끝 화살표)
    const mainLine = new fabric.Line([from.x, from.y, to.x, to.y], {
      stroke: '#000', strokeWidth: lineWeightPx,
      objectCaching: false,
    });

    // 화살표 양쪽
    const arrowLeft  = buildEndDecoration('arrow', to, from);
    const arrowRight = buildEndDecoration('arrow', from, to);

    // 연장선 (from, to에서 수직으로 ±12px)
    const perpAngle = angle + 90;
    const perpRad = (perpAngle * Math.PI) / 180;
    const extLen = 12;

    const makeExt = (pt: Pt) => new fabric.Line([
      pt.x - Math.cos(perpRad) * extLen, pt.y - Math.sin(perpRad) * extLen,
      pt.x + Math.cos(perpRad) * extLen, pt.y + Math.sin(perpRad) * extLen,
    ], { stroke: '#000', strokeWidth: lineWeightPx * 0.7, objectCaching: false });

    // 치수 텍스트
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const distText = `${Math.round(len)}`;
    const label = new fabric.IText(distText, {
      left: midX, top: midY - 14,
      fontSize: 12, fontFamily: FIXED_FONT_FAMILY,
      fill: '#000',
      originX: 'center', originY: 'center',
      objectCaching: false,
    });

    const objects = [mainLine, makeExt(from), makeExt(to), label];
    if (arrowLeft) objects.push(arrowLeft);
    if (arrowRight) objects.push(arrowRight);

    const group = new fabric.Group(objects, { objectCaching: false });
    fc.add(group);
    fc.renderAll();
  };
  ```

- [ ] **Step 3: EditorToolbar에 치수선 버튼 추가**

  지시선/부호 그룹에 추가:
  ```typescript
  <ToolBtn active={tool === 'dimension'} onClick={() => setTool('dimension')}
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

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat: dimension line tool for patent drawings"
  ```

---

### B-3: 텍스트 단독 삽입 도구

도면 내 레이블, 설명문, 도면 번호 등을 자유롭게 추가하는 텍스트 도구.

**Files:** `src/features/patent-editor/types.ts`, `src/features/patent-editor/EditorCanvas.tsx`, `src/features/patent-editor/EditorToolbar.tsx`

- [ ] **Step 1: `standalone-text` ToolMode 추가**

  ```typescript
  | "standalone-text"
  ```

- [ ] **Step 2: 캔버스 클릭 시 텍스트 생성**

  ```typescript
  // tool === 'standalone-text' 클릭 핸들러
  if (tool === 'standalone-text') {
    const textObj = new fabric.IText('텍스트 입력', {
      left: pt.x,
      top: pt.y,
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
    setTool('select'); // 텍스트 입력 완료 후 선택 모드로
  }
  ```

- [ ] **Step 3: EditorToolbar 추가**

  기본 도구 그룹에:
  ```typescript
  <ToolBtn active={tool === 'standalone-text'} onClick={() => setTool('standalone-text')}
    title="텍스트 (T)"
    icon={<span className="font-bold text-sm leading-none">T</span>}
    label="텍스트"
  />
  ```

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat: standalone text tool for patent editor"
  ```

---

### B-4: 원본 이미지 Underlayer (Tracing 기능)

**이용자 기대:** CAD 변환 후 원본 도면을 반투명하게 깔아두고 그 위에 선을 그려 정밀하게 도면을 수정한다.

**Files:** `src/features/patent-editor/PatentEditor.tsx`, `src/features/patent-editor/EditorCanvas.tsx`, `src/features/patent-editor/EditorToolbar.tsx`

- [ ] **Step 1: PatentEditor에 underlayer 상태 추가**

  ```typescript
  // PatentEditor.tsx
  const [showUnderlayer, setShowUnderlayer] = useState(false);
  const [underlayerOpacity, setUnderlayerOpacity] = useState(0.3);
  ```

- [ ] **Step 2: EditorCanvas에 underlayer 이미지 렌더링**

  ```typescript
  // EditorCanvas props에 추가
  interface Props {
    ...
    underlayerImageUrl?: string;
    underlayerOpacity?: number;
    showUnderlayer?: boolean;
  }

  // Fabric.js 캔버스에 이미지 배경으로 추가 (선택/이동 불가)
  useEffect(() => {
    if (!fc || !props.underlayerImageUrl) return;
    const existing = fc.getObjects().find(o => getMeta(o, META.isOverlay) === 'underlayer');
    if (existing) fc.remove(existing);

    if (!props.showUnderlayer) { fc.renderAll(); return; }

    fabric.Image.fromURL(props.underlayerImageUrl, (img) => {
      // 캔버스 크기에 맞게 스케일
      img.scaleToWidth(fc.width!);
      img.set({
        left: 0, top: 0,
        opacity: props.underlayerOpacity ?? 0.3,
        selectable: false, evented: false,
        objectCaching: false,
        excludeFromExport: true,
      });
      setMeta(img, META.isOverlay, 'underlayer' as any);
      fc.add(img);
      fc.sendObjectToBack(img);
      fc.renderAll();
    });
  }, [props.underlayerImageUrl, props.showUnderlayer, props.underlayerOpacity, fc]);
  ```

- [ ] **Step 3: EditorToolbar에 트레이스 컨트롤 추가**

  ```typescript
  // 보기 그룹에 추가
  <OptBtn
    active={showUnderlayer}
    onClick={() => setShowUnderlayer(o => !o)}
    title="원본 이미지 투명 오버레이 (트레이스용)">
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="2" y="2" width="10" height="10" rx="1" opacity="0.4"/>
      <path d="M2,10 L6,6 L9,9 L11,7" strokeWidth="1.5"/>
    </svg>
    <span className="ml-1 text-xs2">트레이스</span>
  </OptBtn>

  {/* 투명도 슬라이더 — 트레이스 켤 때만 표시 */}
  {showUnderlayer && (
    <div className="flex items-center gap-1.5 ml-1">
      <input
        type="range" min={10} max={70} step={5}
        value={Math.round(underlayerOpacity * 100)}
        onChange={e => setUnderlayerOpacity(Number(e.target.value) / 100)}
        className="w-20 h-1 accent-blue-600"
      />
      <span className="text-xs2 text-zinc-400 w-7">{Math.round(underlayerOpacity * 100)}%</span>
    </div>
  )}
  ```

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat: underlayer tracing mode for patent editor canvas"
  ```

---

### B-5: Copy/Paste + 정렬 도구

**Files:** `src/features/patent-editor/EditorCanvas.tsx`, `src/features/patent-editor/PatentEditor.tsx`

- [ ] **Step 1: 복사/붙여넣기 (Ctrl+C / Ctrl+V)**

  ```typescript
  // EditorCanvas.tsx 또는 PatentEditor.tsx
  const clipboardRef = useRef<fabric.Object | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const fc = canvasHandleRef.current?.getCanvas();
      if (!fc) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        const active = fc.getActiveObject();
        if (active) {
          active.clone((cloned: fabric.Object) => {
            clipboardRef.current = cloned;
          });
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        if (!clipboardRef.current) return;
        clipboardRef.current.clone((cloned: fabric.Object) => {
          cloned.set({ left: (cloned.left ?? 0) + 20, top: (cloned.top ?? 0) + 20 });
          fc.add(cloned);
          fc.setActiveObject(cloned);
          clipboardRef.current = cloned; // 반복 붙여넣기 시 오프셋
          fc.renderAll();
        });
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        const active = fc.getActiveObjects();
        fc.remove(...active);
        fc.discardActiveObject();
        fc.renderAll();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  ```

- [ ] **Step 2: 정렬 도구 — 선택 객체 정렬**

  PatentEditor 패널이나 컨텍스트 메뉴에 정렬 버튼 추가:
  ```typescript
  const alignObjects = (fc: fabric.Canvas, direction: 'left'|'right'|'top'|'bottom'|'centerH'|'centerV') => {
    const objects = fc.getActiveObjects();
    if (objects.length < 2) return;

    const bounds = objects.reduce((b, o) => ({
      left:   Math.min(b.left, o.left ?? 0),
      top:    Math.min(b.top, o.top ?? 0),
      right:  Math.max(b.right, (o.left ?? 0) + (o.width ?? 0) * (o.scaleX ?? 1)),
      bottom: Math.max(b.bottom, (o.top ?? 0) + (o.height ?? 0) * (o.scaleY ?? 1)),
    }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });

    objects.forEach(o => {
      if (direction === 'left')    o.set({ left: bounds.left });
      if (direction === 'right')   o.set({ left: bounds.right - (o.width ?? 0) * (o.scaleX ?? 1) });
      if (direction === 'top')     o.set({ top: bounds.top });
      if (direction === 'bottom')  o.set({ top: bounds.bottom - (o.height ?? 0) * (o.scaleY ?? 1) });
      if (direction === 'centerH') o.set({ left: (bounds.left + bounds.right) / 2 - (o.width ?? 0) * (o.scaleX ?? 1) / 2 });
      if (direction === 'centerV') o.set({ top: (bounds.top + bounds.bottom) / 2 - (o.height ?? 0) * (o.scaleY ?? 1) / 2 });
    });
    fc.renderAll();
  };
  ```

- [ ] **Step 3: EditorToolbar에 정렬 그룹 추가**

  ```typescript
  <Group label="정렬">
    <MoreBtn label="정렬">
      <MoreItem icon={<AlignLeft size={13}/>} label="왼쪽 정렬"
        onClick={() => alignObjects(fc!, 'left')} />
      <MoreItem icon={<AlignRight size={13}/>} label="오른쪽 정렬"
        onClick={() => alignObjects(fc!, 'right')} />
      <MoreItem icon={<AlignTop size={13}/>} label="위쪽 정렬"
        onClick={() => alignObjects(fc!, 'top')} />
      <MoreItem icon={<AlignBottom size={13}/>} label="아래쪽 정렬"
        onClick={() => alignObjects(fc!, 'bottom')} />
      <MoreItem icon={<AlignCenterH size={13}/>} label="수평 중앙"
        onClick={() => alignObjects(fc!, 'centerH')} />
      <MoreItem icon={<AlignCenterV size={13}/>} label="수직 중앙"
        onClick={() => alignObjects(fc!, 'centerV')} />
    </MoreBtn>
  </Group>
  ```

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat: copy/paste, delete key, alignment tools for patent editor"
  ```

---

### B-6: 도면 번호 자동 삽입

각 도면에 "도 1", "도 2" 형식의 타이틀이 여백 하단에 자동 삽입된다.

**Files:** `src/features/patent-editor/PatentEditor.tsx`, `src/features/patent-editor/DrawingListPanel.tsx`

- [ ] **Step 1: PatentEditor에 도면 번호 삽입 버튼**

  ```typescript
  // PatentEditor.tsx
  const insertDrawingNumber = (fc: fabric.Canvas, drawingIndex: number) => {
    const existing = fc.getObjects().find(o =>
      o instanceof fabric.IText && (o as fabric.IText).text?.startsWith('도 ')
    );
    if (existing) fc.remove(existing);

    const label = new fabric.IText(`도 ${drawingIndex}`, {
      left: fc.width! / 2,
      top: fc.height! - 40,
      fontSize: 16,
      fontFamily: FIXED_FONT_FAMILY,
      fontWeight: 'bold',
      fill: '#000',
      originX: 'center',
      originY: 'center',
      objectCaching: false,
    });
    fc.add(label);
    fc.renderAll();
  };
  ```

  EditorToolbar 보기 그룹에 버튼:
  ```typescript
  <MoreItem icon={<Hash size={13}/>} label="도면 번호 삽입"
    onClick={() => insertDrawingNumber(fc!, activeDrawingIndex + 1)} />
  ```

- [ ] **Step 2: Commit**

  ```bash
  git commit -m "feat: auto-insert drawing number label (도 N)"
  ```

---

### B-7: 꺾인 지시선 (Elbow Leader Line)

특허 도면에서 가장 많이 쓰이는 꺾임 지시선 (L자 또는 Z자 경로).

**Files:** `src/features/patent-editor/types.ts`, `src/features/patent-editor/EditorCanvas.tsx`

- [ ] **Step 1: `elbow-leader` ToolMode 추가**

  ```typescript
  | "elbow-leader"  // 꺾인 지시선
  ```

- [ ] **Step 2: 꺾인 지시선 경로 계산**

  anchor → 수평/수직 꺾임 → textPos 형태:
  ```typescript
  const buildElbowLeaderPath = (anchor: Pt, textPos: Pt): string => {
    // anchor에서 수평으로 이동 후 textPos로 수직 이동
    const midX = textPos.x;
    return `M ${anchor.x},${anchor.y} L ${midX},${anchor.y} L ${midX},${textPos.y}`;
  };

  // 꺾인 지시선 생성
  const createElbowLeader = (fc: fabric.Canvas, anchor: Pt, textPos: Pt, ref: EditorReference) => {
    const pathStr = buildElbowLeaderPath(anchor, textPos);
    const leaderPath = new fabric.Path(pathStr, {
      fill: 'transparent',
      stroke: '#000',
      strokeWidth: 1.5,
      objectCaching: false,
    });
    // 끝단 화살표 (anchor 방향)
    const arrow = buildEndDecoration('arrow', { x: textPos.x, y: anchor.y }, anchor);

    // 참조번호 텍스트
    const label = new fabric.IText(ref.number, {
      left: textPos.x,
      top: textPos.y,
      fontSize: 14, fontFamily: FIXED_FONT_FAMILY,
      fill: '#000', originX: 'center', originY: 'center',
    });

    const objects: fabric.Object[] = [leaderPath, label];
    if (arrow) objects.push(arrow);
    fc.add(...objects);
  };
  ```

- [ ] **Step 3: EditorToolbar — 연결선 그룹에 추가**

  ```typescript
  <OptBtn active={leaderCurve === 'elbow'} onClick={() => setLeaderCurve('elbow')} title="꺾인 지시선">
    <svg width="22" height="16" viewBox="0 0 22 16">
      <path d="M4,12 L4,4 L18,4" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <polygon points="2,13 4,10 6,13" fill="currentColor"/>
    </svg>
    <span className="ml-1 text-xs2">꺾임</span>
  </OptBtn>
  ```

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat: elbow leader line tool for patent drawing annotation"
  ```

---

### B-8: 내보내기 품질 향상

특허청 제출 기준에 맞는 해상도(300dpi 이상)로 내보내기.

**Files:** `src/features/patent-editor/PatentEditor.tsx`

- [ ] **Step 1: 고해상도 내보내기 옵션 추가**

  현재 `exportBinaryReady()`를 고해상도 버전으로 교체:
  ```typescript
  // PatentEditor.tsx의 handleExport
  const handleExport = async () => {
    const fc = canvasHandleRef.current?.getCanvas();
    if (!fc) return;

    setBusy(true);

    // 고해상도: 3배 스케일 (72dpi × 3 ≈ 216dpi, 충분한 품질)
    const SCALE = 3;
    withOverlaysHidden(fc, () => {
      const dataUrl = fc.toDataURL({
        format: 'png',
        multiplier: SCALE,
        quality: 1,
      });
      // blob 변환
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] ?? 'image/png';
      const bstr = atob(arr[1]);
      const u8 = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8], { type: mime });
      onExportComplete(activeDrawingId, blob);
    });

    setBusy(false);
  };
  ```

- [ ] **Step 2: 내보내기 해상도 선택 UI**

  내보내기 버튼 옆 드롭다운:
  ```typescript
  const [exportScale, setExportScale] = useState(2);

  <select
    value={exportScale}
    onChange={e => setExportScale(Number(e.target.value))}
    className="border border-zinc-300 rounded px-1 text-xs2 h-8">
    <option value={1}>72dpi (화면)</option>
    <option value={2}>144dpi (표준)</option>
    <option value={3}>216dpi (인쇄)</option>
    <option value={4}>288dpi (고품질)</option>
  </select>
  ```

- [ ] **Step 3: Commit**

  ```bash
  git commit -m "feat: high-resolution export options for patent drawing (up to 288dpi)"
  ```

---

### B-9: 도면 편집기 — 단축키 완성

특허 도면 편집에 필요한 핵심 단축키 체계.

**Files:** `src/features/patent-editor/PatentEditor.tsx`

- [ ] **Step 1: 단축키 맵 정의 및 이벤트 리스너 추가**

  ```typescript
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA') return;

      const fc = canvasHandleRef.current?.getCanvas();
      if (!fc) return;

      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); break;
        case 'l': setTool('line'); break;
        case 't': setTool('standalone-text'); break;
        case 'r': setTool('rect'); break;
        case 'o': setTool('circle'); break;
        case 'p': setTool('polygon'); break;   // polyline
        case 'd': setTool('dimension'); break;  // 치수선
        case 'e': setTool('marquee-eraser'); break;
        case 'g': toggleGrid(); break;           // 그리드
        case 'escape':
          fc.discardActiveObject();
          setTool('select');
          fc.renderAll();
          break;
        // Ctrl+Z / Ctrl+Y는 기존 구현 유지
      }

      // Ctrl+A: 전체 선택
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        fc.setActiveObject(new fabric.ActiveSelection(
          fc.getObjects().filter(o => !isOverlay(o)),
          { canvas: fc }
        ));
        fc.renderAll();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);
  ```

- [ ] **Step 2: 도구 툴팁에 단축키 표시**

  EditorToolbar의 title 속성 업데이트:
  ```typescript
  // 기존 title="선택 (V)" 형태로 이미 일부 있음 — 누락 항목 추가
  title="텍스트 단독 (T)"
  title="꺾인 지시선 (J)"
  title="치수선 (D)"
  title="다각형 (P)"
  ```

- [ ] **Step 3: 단축키 도움말 패널 (?) 버튼**

  툴바 우측에 단축키 목록 팝업:
  ```typescript
  const SHORTCUTS = [
    ['V', '선택'], ['L', '지시선'], ['T', '텍스트'], ['R', '사각형'],
    ['O', '원'], ['P', '폴리라인'], ['D', '치수선'], ['E', '지우기'],
    ['G', '그리드 토글'], ['Esc', '선택 해제'],
    ['Ctrl+C/V', '복사/붙여넣기'], ['Delete', '삭제'],
    ['Ctrl+Z/Y', '실행취소/다시실행'],
    ['Ctrl+A', '전체 선택'],
  ];
  ```

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "feat: comprehensive keyboard shortcuts for patent editor"
  ```

---

## 자기 검토

### 완성도 향상

| 기능 | 구현 전 | 구현 후 |
|------|---------|---------|
| 수식 입력 (TeX) | 20% | 80% |
| 자유 다각형/폴리라인 | 0% (disabled) | 75% |
| 치수선 | 0% | 75% |
| 텍스트 단독 도구 | 0% | 80% |
| 트레이스 (Underlayer) | 0% | 75% |
| Copy/Paste | 0% | 85% |
| 정렬 도구 | 0% | 80% |
| 도면 번호 자동 삽입 | 0% | 80% |
| 꺾인 지시선 | 0% | 70% |
| 내보내기 고해상도 | 30% | 80% |
| 단축키 체계 | 40% | 85% |

### 구현 순서

1. **A-1~A-2** (KaTeX 수식) — 독립 기능, 빠른 임팩트
2. **B-5** (Copy/Paste, Delete, 정렬) — 기본 편집 UX 필수
3. **B-9** (단축키) — 편집 효율 직결
4. **B-3** (텍스트 단독) — 기본 도구 완성
5. **B-1** (미구현 도형 활성화) — disabled 버튼 제거
6. **B-4** (트레이스) — 핵심 도면 편집 UX
7. **B-7** (꺾인 지시선) — 특허 도면 필수
8. **B-2** (치수선) — 특허 도면 필수
9. **B-6** (도면 번호) — 마무리
10. **B-8** (내보내기 품질) — 최종 품질

---

## 실행 프롬프트

```
프로젝트: c:\project\06_AXP\react-app
계획서: docs/superpowers/plans/2026-06-03-axp-editor-enhancement-plan.md

Part A (TeX 수식) → Part B (도면 편집기) 순서로 구현한다.
각 Task 완료 후 npm run build && git commit 한다.
Part A는 A-1 → A-2 순서로 실행한다.
Part B는 B-5 → B-9 → B-3 → B-1 → B-4 → B-7 → B-2 → B-6 → B-8 순서로 실행한다.
```
