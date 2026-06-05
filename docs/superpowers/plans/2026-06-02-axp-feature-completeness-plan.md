# AXPlain.ai 단위 기능 완성도 향상 계획

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`
>
> **전제:** 버그 수정 계획(2026-06-02-axp-spec-workflow-plan.md)의 Task 1~7이 완료된 상태에서 실행한다.
> 목업 데이터임을 감안하여 **UI 인터랙션의 완결성**에 집중한다.
> "이용자가 이 화면에서 무엇을 해야 하는지 명확하고, 한 행동이 다음 화면에 의미 있게 반영되어야 한다."

---

## 기능별 현재 완성도 진단

| 기능 영역 | 현재 | 목표 | 핵심 문제 |
|-----------|------|------|-----------|
| ① 직무발명서 업로드 | 30% | 80% | 클릭하면 즉시 빈 flow 진입. 파일 선택 dialog도 없고, 무엇이 분석됐는지 이용자가 알 수 없음 |
| ② 발명의 명칭 | 60% | 85% | 후보 재생성 버튼이 no-op. 이용자가 선택을 왜 해야 하는지 맥락이 없음 |
| ③ 발명의 설명 | 55% | 85% | 서브섹션 순서 강제 (클릭 자유롭게 이동 불가), 확정 상태 시각화 미흡, 발명의 효과 누락 |
| ④ 구성요소 | 70% | 85% | 부호 배정 후 도면 단계/에디터에 연결 안됨. 계층 구조 시각 피드백 없음 |
| ⑤ 도면 | 40% | 75% | bbox 편집 단계에서 원본 이미지 없음 → 핵심 기능인 좌표 조정 체험 불가. stage 전환 흐름이 DrawingsPanel에서 불투명 |
| ⑥ 청구항 | 75% | 85% | 청구항 번호가 종속항 선택/해제 시 연속 관리 안됨. 독립항-종속항 의존관계 표시 없음 |
| ⑦ 요약서 | 65% | 80% | 글자수 제한(500자) 없음. 청구항 내용과 연결이 없음 |
| ⑧ 명세서 에디터 | 70% | 85% | 빈 섹션 경고 없음. 도면 탭의 "참조 삽입"이 분석 도면이 아닌 MOCK_DRAWINGS 참조. 에디터→분석 재진입 후 흐름 불명확 |
| ⑨ 미리보기/내보내기 | 20% | 75% | 내용 완전 하드코딩. DOCX/PDF 버튼 no-op |
| ⑩ 검색 결과 뷰 | 75% | 85% | 페이지네이션 동작 확인 필요. "배경기술 참조" 기능 미구현 |
| ⑪ 라이브러리 | 70% | 80% | 항목 일괄 이동 없음. 라이브러리 항목이 에디터 참고문헌과 연결 안됨 |

---

## Feature 1: 직무발명서 업로드 완성 (30% → 80%)

**이용자가 기대하는 경험:**
직발서 파일을 올리면 → 파일명과 업로드 완료가 표시되고 → AI가 파일에서 발명 내용을 읽어 명칭·설명·구성요소 후보를 만든다는 느낌을 받는다.

**현재 문제:**
- 업로드 영역 클릭 시 즉시 flow 진입 (파일 선택 dialog 없음)
- 분석 중에 파일명도, 진행도도 표시 안됨
- 직접 입력과 업로드가 동등한 경로인데 업로드가 빈 껍데기

**구현 Task:**

- [ ] **F1-1: 파일 업로드 UI 완성** (`src/views/SpecView.tsx`)

  업로드 존에 hidden `<input type="file">` 추가:
  ```typescript
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'selected' | 'analyzing' | 'done'>('idle');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);

  const handleFileSelect = (file: File) => {
    const sizeStr = file.size > 1024 * 1024
      ? `${(file.size / 1024 / 1024).toFixed(1)}MB`
      : `${(file.size / 1024).toFixed(0)}KB`;
    setUploadedFile({ name: file.name, size: sizeStr });
    setUploadState('selected');
  };
  ```

- [ ] **F1-2: 파일 선택 후 분석 확인 UI**

  파일 선택 후 "파일 선택됨" 상태로 전환, "AI 분석 시작" 버튼 활성:
  ```typescript
  // 파일 선택 상태 UI
  {uploadState === 'selected' && uploadedFile && (
    <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6 mb-5 text-center">
      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-3">
        <Icon name="doc" size={24} className="text-blue-600" />
      </div>
      <p className="text-md2 font-semibold text-blue-800">{uploadedFile.name}</p>
      <p className="text-sm2 text-blue-500 mt-0.5">{uploadedFile.size}</p>
      <div className="flex gap-2 justify-center mt-4">
        <button
          onClick={() => { setUploadedFile(null); setUploadState('idle'); }}
          className="btn-outline btn-sm text-sm2">파일 변경</button>
        <button
          onClick={startAnalysis}
          className="btn-primary btn-sm">
          <Icon name="star" size={13}/> AI 분석 시작
        </button>
      </div>
    </div>
  )}
  ```

- [ ] **F1-3: 분석 중 진행 표시**

  분석 시뮬레이션을 3단계로 쪼개어 진행 상황을 표시:
  ```typescript
  const ANALYSIS_STEPS = [
    { label: '문서 파싱 중...', duration: 600 },
    { label: '발명 핵심 내용 추출 중...', duration: 600 },
    { label: 'AI 후보 생성 중...', duration: 400 },
  ];

  // 분석 중 UI
  {uploadState === 'analyzing' && (
    <div className="text-center py-8">
      <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center mx-auto mb-4 animate-pulse">
        <span className="text-2xl animate-spin inline-block">↻</span>
      </div>
      <p className="text-md2 font-semibold text-blue-700 mb-1">직무발명서 분석 중</p>
      <p className="text-sm2 text-gray-500">{currentStepLabel}</p>
      <div className="mt-4 h-1 bg-gray-100 rounded-full mx-auto w-48">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }}/>
      </div>
    </div>
  )}
  ```

- [ ] **F1-4: 분석 완료 후 "기초자료" 패널에 파일 내용 표시**

  분석 완료 후 기초자료 패널(접힌 형태)에 파일명과 추출된 내용 요약 표시:
  ```typescript
  // 접힌 기초자료 패널 헤더
  <button onClick={() => setSourceDataOpen(o => !o)} className="...">
    <Icon name="doc" size={16} className="text-blue-600"/>
    <div className="flex-1">
      <p className="text-sm2 font-semibold text-gray-700">분석된 기초자료</p>
      <p className="text-xs2 text-gray-400">{uploadedFile?.name || diTitle} · AI 분석 완료</p>
    </div>
    <span className="text-xs2 px-2 py-0.5 rounded-full bg-green-100 text-green-700">분석 완료</span>
  </button>
  ```

- [ ] **Commit**
  ```bash
  git add src/views/SpecView.tsx
  git commit -m "feat: complete file upload UX — file dialog, analysis progress, result summary"
  ```

---

## Feature 2: 발명의 명칭 패널 완성 (60% → 85%)

**이용자가 기대하는 경험:**
A/B/C 3개 후보 중 하나를 고르는데, 각 후보가 왜 다른지 차별점이 보인다. 마음에 안들면 "재생성"으로 다른 버전을 볼 수 있다.

**현재 문제:**
- 재생성(↻) 버튼이 no-op — 클릭해도 아무 변화 없음
- 후보 A/B/C가 비슷해서 이용자가 어떤 기준으로 선택해야 할지 모름

**구현 Task:**

- [ ] **F2-1: 후보별 유형 배지 추가** (`src/views/SpecView.tsx` GuidePanel)

  각 후보 카드에 "장치 중심 / 방법 중심 / 포괄적" 배지 표시:
  ```typescript
  const TITLE_CANDIDATE_TYPES = ['장치·시스템 중심', '방법·프로세스 중심', '포괄적 표현'];
  // 카드 렌더링에서
  <span className="text-xs2 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
    {TITLE_CANDIDATE_TYPES[i] ?? ''}
  </span>
  ```

- [ ] **F2-2: 재생성 버튼 동작 구현**

  재생성 클릭 시 해당 카드 텍스트를 새 mock 후보로 교체:
  ```typescript
  const regenTitle = (idx: number) => {
    const input = { title: diTitle, field: diField, content: diContent };
    const variants = [
      `${input.field} 환경에서 ${input.title}을 위한 지능형 시스템`,
      `딥러닝 기반 ${input.title} 자동화 장치`,
      `실시간 ${input.title} 처리를 위한 ${input.field} 장치 및 방법`,
    ];
    const newText = variants[Math.floor(Math.random() * variants.length)];
    // 해당 idx의 editVals 업데이트
    setEditVals(prev => ({ ...prev, [idx]: newText }));
    setGSel(p => ({ ...p, title: newText }));
  };
  ```

- [ ] **F2-3: 선택된 후보 강조 개선**

  선택된 후보에 "선택됨" 배지 + 하단에 "이 명칭으로 확정하면 청구범위와 요약서에 자동 반영됩니다" 안내:
  ```typescript
  {isSelected && (
    <div className="mt-2 flex items-center gap-1.5 text-xs2 text-blue-600">
      <Icon name="check" size={10}/> 선택됨 — 이후 단계에서 이 명칭이 기준이 됩니다
    </div>
  )}
  ```

- [ ] **Commit**
  ```bash
  git commit -m "feat: title candidates — regen button works, type badges, selection feedback"
  ```

---

## Feature 3: 발명의 설명 패널 완성 (55% → 85%)

**이용자가 기대하는 경험:**
5개 섹션을 순서대로 또는 자유롭게 이동하며 확정한다. 각 섹션에 선행기술 검색 결과나 구성요소 정보가 반영된 텍스트가 제공된다.

**현재 문제:**
- 발명의 효과 섹션 없음 (B7 — 버그 수정 계획에서 이미 처리, 여기서는 완성도 관점 추가)
- "이 섹션을 왜 확정해야 하나" 안내 없음
- 서브섹션 탭이 작아서 섹션 간 이동이 불명확

**구현 Task:**

- [ ] **F3-1: 서브섹션별 가이드 텍스트 추가** (`DescriptionPanel`)

  각 섹션 하단에 특허 작성 가이드 팁 표시:
  ```typescript
  const SECTION_GUIDE: Record<string, string> = {
    tech:     '발명이 속한 기술 분야를 간결하게 정의합니다. 청구범위와 일치하도록 너무 좁거나 넓지 않게 기술하세요.',
    bg:       '기존 기술의 문제점을 구체적으로 서술합니다. 선행 특허/논문 인용 시 라이브러리에서 불러올 수 있습니다.',
    problem:  '본 발명이 해결하려는 과제를 명확히 서술합니다. 배경기술에서 제시한 문제점과 1:1로 대응되어야 합니다.',
    solution: '구성요소를 포함하는 청구항 형식으로 기술합니다. 4단계(구성요소)에서 확정된 구성요소가 여기에 반영됩니다.',
    effect:   '해결수단으로 달성되는 효과를 수치 또는 정성적으로 기술합니다. "40% 향상"처럼 구체적일수록 좋습니다.',
  };

  // 섹션 텍스트박스 아래에 표시
  <p className="text-xs2 text-gray-400 mt-1.5 leading-relaxed">
    💡 {SECTION_GUIDE[sec.key]}
  </p>
  ```

- [ ] **F3-2: 섹션 상태 시각화 개선 — 탭에 글자수·확정 표시**

  서브섹션 탭 버튼에 텍스트 길이 또는 확정 상태 표시:
  ```typescript
  <button key={s.key} onClick={() => setSubStep(i)} className={clsx(...)}>
    {isConfirmed && !isActive && <Icon name="check" size={8} className="inline mr-0.5"/>}
    {s.label}
    {texts[s.key]?.length > 0 && !isConfirmed && (
      <span className="ml-1 text-xs2 text-gray-400">({texts[s.key].length}자)</span>
    )}
  </button>
  ```

- [ ] **F3-3: 전체 확정 시 섹션 요약 카드 개선**

  확정 완료 카드(중앙 흐름)에 5개 섹션을 접을 수 있는 형태로 표시:
  ```typescript
  // 확정 카드에서 섹션별 접기/펼치기
  const [expandedSec, setExpandedSec] = useState<string | null>(null);
  // 각 섹션 미리보기 1줄 + 클릭 시 전체 표시
  ```

- [ ] **Commit**
  ```bash
  git commit -m "feat: description panel — section guides, char count, collapsible confirmed card"
  ```

---

## Feature 4: 구성요소 패널 완성 (70% → 85%)

**이용자가 기대하는 경험:**
구성요소를 확정하면 도면 편집기에서 해당 구성요소들을 부호 목록으로 바로 사용할 수 있고, 에디터의 구체적 내용 섹션에 "(100)", "(200)" 형태로 자동 반영된다.

**현재 문제:**
- 계층 구조(depth)가 시각적으로 명확하지 않음 (들여쓰기만 있고 선 없음)
- 부호 자동 부여 후 하위 항목에 들여쓰기 부호(110, 120 등)가 제대로 배정되는지 불명확

**구현 Task:**

- [ ] **F4-1: 계층 구조 시각 피드백 강화** (`ComponentsPanel`)

  depth 별로 왼쪽 색선(color bar) 추가:
  ```typescript
  const DEPTH_COLORS = ['', 'border-l-2 border-blue-200 ml-4', 'border-l-2 border-violet-200 ml-8'];

  // 항목 div에 depth별 클래스 적용
  <div className={clsx('flex items-center gap-1 rounded px-1.5 py-1', DEPTH_COLORS[item.depth ?? 0], ...)}>
  ```

- [ ] **F4-2: 부호 미리보기 — 자동 부여 전 시뮬레이션 표시**

  "부호 자동 부여" 버튼 hover 시 배정될 번호를 ghost로 미리 표시:
  ```typescript
  const [previewNums, setPreviewNums] = useState(false);
  const simulatedNums = previewNums ? calcAutoNums(items) : null;

  // 각 항목의 부호 배지 렌더링 시
  const displayNum = simulatedNums ? simulatedNums[i]?.num : item.num;
  ```

- [ ] **F4-3: 확정 후 요약 — 구성요소 트리 표시**

  확정 카드(중앙 흐름)에 평면 목록이 아닌 계층 트리로 표시:
  ```typescript
  // 확정 카드에서 items를 depth 기반으로 트리 구조 렌더링
  items.filter(c => c.sel).map(c => (
    <div key={c.id} style={{ paddingLeft: (c.depth || 0) * 16 }}
      className="flex items-center gap-1.5 text-xs2 text-gray-700 py-0.5">
      <span className="font-mono text-blue-600 w-8 shrink-0">{c.num || '—'}</span>
      <span>{c.text.split(':')[0]}</span>
    </div>
  ))
  ```

- [ ] **Commit**
  ```bash
  git commit -m "feat: components panel — hierarchy colors, num preview, tree confirmation card"
  ```

---

## Feature 5: 도면 워크플로우 완성 (40% → 75%)

**이용자가 기대하는 경험:**
직발서에서 추출된 도면이 페이지 썸네일로 보이고, 도면 영역(빨간 박스)을 드래그해서 조정한다. 이 조정이 "이 부분을 특허 도면으로 변환하겠다"는 핵심 행동이다.

**현재 문제:**
- DrawingEditorModal의 crop 단계에서 원본 이미지가 완전히 없음 (빈 회색 박스)
- bbox 드래그 조정 UI가 존재하지 않음 (그냥 빈 공간)
- DrawingsPanel에서 도면별 stage가 시각적으로 구분이 안됨

**구현 Task:**

- [ ] **F5-1: 도면 원본 이미지 — mock PDF 페이지 이미지 생성** (`mockAiService.ts`)

  SVG로 mock PDF 페이지를 생성 (실제 도면처럼 보이는 구성도):
  ```typescript
  export function generateMockPageSvg(type: '블록도' | '순서도' | '구성도', symbol: number): string {
    const colors = { 블록도: '#3b82f6', 순서도: '#10b981', 구성도: '#8b5cf6' };
    const color = colors[type];
    // 간단한 블록 다이어그램 SVG
    return `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" style="background:#f9fafb">
        <rect x="20" y="20" width="360" height="260" fill="none" stroke="#e5e7eb" stroke-width="1"/>
        <text x="200" y="40" text-anchor="middle" font-size="12" fill="#6b7280">도 ${symbol}</text>
        ${type === '블록도' ? `
          <rect x="60" y="60" width="100" height="50" rx="4" fill="none" stroke="${color}" stroke-width="1.5"/>
          <text x="110" y="90" text-anchor="middle" font-size="10" fill="${color}">입력부</text>
          <line x1="160" y1="85" x2="200" y2="85" stroke="${color}" stroke-width="1.5" marker-end="url(#arr)"/>
          <rect x="200" y="60" width="100" height="50" rx="4" fill="none" stroke="${color}" stroke-width="1.5"/>
          <text x="250" y="90" text-anchor="middle" font-size="10" fill="${color}">처리부</text>
        ` : `
          <ellipse cx="200" cy="80" rx="50" ry="25" fill="none" stroke="${color}" stroke-width="1.5"/>
          <text x="200" y="85" text-anchor="middle" font-size="10" fill="${color}">시작</text>
          <line x1="200" y1="105" x2="200" y2="140" stroke="${color}" stroke-width="1.5"/>
          <rect x="150" y="140" width="100" height="40" fill="none" stroke="${color}" stroke-width="1.5"/>
          <text x="200" y="165" text-anchor="middle" font-size="10" fill="${color}">처리</text>
        `}
      </svg>
    `)}`;
  }
  ```

  `generateMockDrawings()`에서 각 도면에 mock 이미지 URL 할당:
  ```typescript
  { id: 'd1', ..., originalImageUrl: generateMockPageSvg('블록도', 1) },
  { id: 'd2', ..., originalImageUrl: generateMockPageSvg('순서도', 2) },
  { id: 'd3', ..., originalImageUrl: generateMockPageSvg('구성도', 3) },
  ```

- [ ] **F5-2: DrawingEditorModal crop 단계 — bbox 드래그 UI** (`DrawingEditorModal.tsx`)

  원본 이미지 위에 빨간 점선 박스를 overlay로 표시, 드래그로 조정 가능:
  ```typescript
  // crop 단계 UI (BBoxEditor 인라인 컴포넌트)
  function BBoxEditor({ imageUrl, bbox, onChange }: {
    imageUrl: string; bbox: DrawingBBox; onChange: (b: DrawingBBox) => void;
  }) {
    const imgRef = useRef<HTMLImageElement>(null);
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    return (
      <div className="relative inline-block select-none">
        <img ref={imgRef} src={imageUrl} className="max-w-full max-h-[480px] object-contain" alt="원본 도면"/>
        {/* bbox 오버레이 */}
        <div
          className="absolute border-2 border-red-500 border-dashed bg-red-50/10 cursor-move"
          style={{
            left: `${(bbox.x / (imgRef.current?.naturalWidth || 400)) * 100}%`,
            top: `${(bbox.y / (imgRef.current?.naturalHeight || 300)) * 100}%`,
            width: `${(bbox.w / (imgRef.current?.naturalWidth || 400)) * 100}%`,
            height: `${(bbox.h / (imgRef.current?.naturalHeight || 300)) * 100}%`,
          }}
          onMouseDown={e => { setDragging(true); setDragStart({ x: e.clientX, y: e.clientY }); }}
        >
          <div className="absolute -top-5 left-0 text-xs text-red-600 font-mono whitespace-nowrap">
            선택 영역 ({Math.round(bbox.w)}×{Math.round(bbox.h)}px)
          </div>
          {/* 8방향 리사이즈 핸들 */}
          {['nw','n','ne','e','se','s','sw','w'].map(pos => (
            <div key={pos} className="absolute w-3 h-3 bg-red-500 rounded-sm"
              style={{ /* 각 방향별 위치 */ }}/>
          ))}
        </div>
        <p className="mt-2 text-xs2 text-gray-500 text-center">
          빨간 박스를 드래그하여 도면 영역을 조정하세요
        </p>
      </div>
    );
  }
  ```

- [ ] **F5-3: DrawingsPanel — 도면 진행 현황 헤더**

  패널 상단에 도면 stage 진행 현황을 한눈에 표시:
  ```typescript
  // DrawingsPanel 상단
  const stageCounts = drawings.reduce((acc, d) => {
    acc[d.stage] = (acc[d.stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const doneCount = stageCounts['done'] || 0;
  const totalCount = drawings.length;

  <div className="flex items-center gap-2 mb-3">
    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full bg-green-500 rounded-full transition-all"
        style={{ width: `${(doneCount / totalCount) * 100}%` }}/>
    </div>
    <span className="text-xs2 text-gray-500 font-medium shrink-0">
      {doneCount}/{totalCount} 완료
    </span>
  </div>
  ```

- [ ] **F5-4: 도면 편집 완료 후 썸네일 자동 업데이트**

  PatentEditor에서 내보내기 완료 시 DrawingsPanel 카드 썸네일이 업데이트되는 흐름 완결:
  - `onEditorResult`에서 `exportedImageUrl` 수신 → DrawingsPanel `drawings` 상태 업데이트
  - 카드 썸네일 영역에 `exportedImageUrl`이 있으면 실제 이미지 표시

- [ ] **Commit**
  ```bash
  git commit -m "feat: drawings — mock page images, bbox drag UI, progress bar, thumbnail update"
  ```

---

## Feature 6: 청구항 패널 완성 (75% → 85%)

**이용자가 기대하는 경험:**
독립항과 종속항이 청구항 번호 순서대로 표시되고, 종속항을 선택/해제할 때 번호가 자동으로 재계산된다. "이 청구항은 제N항에 의존한다"가 시각적으로 명확하다.

**현재 문제:**
- 종속항 선택/해제 시 전체 번호가 재계산되나 해제된 항목이 여전히 번호를 가진 행처럼 표시됨
- 독립항-종속항 의존 관계가 텍스트("종속(→1)")로만 표시됨

**구현 Task:**

- [ ] **F6-1: 청구항 번호 재계산 — 실시간 전체 미리보기** (`ClaimsPanel`)

  Phase B에서 오른쪽 상단에 "청구항 미리보기" 접이식 패널 추가:
  ```typescript
  const [showPreview, setShowPreview] = useState(false);
  // 전체 청구항 텍스트 미리보기 (번호 자동 매기기)
  <div className="mb-2 flex items-center justify-between">
    <span className="text-xs2 font-semibold text-gray-500">
      청구항 {totalIndep + totalDep}개 (독립 {totalIndep}, 종속 {totalDep})
    </span>
    <button onClick={() => setShowPreview(o => !o)}
      className="text-xs2 text-blue-600 hover:underline">
      {showPreview ? '미리보기 닫기' : '전체 미리보기'}
    </button>
  </div>
  {showPreview && (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-3 text-xs2 leading-relaxed font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
      {buildFullClaimsText(cands, depGroups)}
    </div>
  )}
  ```

- [ ] **F6-2: 종속항 의존 관계 시각화**

  Phase B에서 독립항과 그 종속항 사이를 연결선으로 표시:
  ```typescript
  // 독립항 섹션과 종속항 목록 사이에 시각적 연결
  <div className="flex items-start gap-2">
    <div className="w-0.5 bg-blue-200 ml-3 mt-2 self-stretch shrink-0"/>
    <div className="flex-1 space-y-1">
      {grp.items.map(dep => ...)}
    </div>
  </div>
  ```

- [ ] **F6-3: 청구항 번호 오류 감지**

  종속항 텍스트에 "제N항"이 있는데 N이 실제 청구항 번호와 다를 때 경고:
  ```typescript
  // 각 종속항 텍스트에서 "제N항" 파싱
  const depRefNum = parseInt(dep.text.match(/제(\d+)항/)?.[1] || '0');
  const isValidRef = depRefNum > 0 && depRefNum <= claimNum;
  // 유효하지 않은 참조번호면 주황 테두리
  ```

- [ ] **Commit**
  ```bash
  git commit -m "feat: claims panel — full preview, dependency visualization, claim ref validation"
  ```

---

## Feature 7: 요약서 패널 완성 (65% → 80%)

**이용자가 기대하는 경험:**
요약서는 500자(또는 1500바이트) 이내여야 하는 특허 규정이 있다. 글자수를 보면서 편집하고, 독립항 내용이 요약서에 반영되어 있는지 확인한다.

**구현 Task:**

- [ ] **F7-1: 글자수 실시간 표시 + 제한 경고** (`AbstractPanel` in SpecView)

  선택된 요약서 텍스트박스 아래 글자수 표시:
  ```typescript
  const MAX_CHARS = 500;
  const charCount = editVals[selectedIdx]?.length ?? ABSTRACT_CANDS[selectedIdx]?.text.length ?? 0;
  const isOver = charCount > MAX_CHARS;

  <div className="flex items-center justify-between mt-1">
    <span className={clsx('text-xs2 font-medium', isOver ? 'text-red-500' : 'text-gray-400')}>
      {charCount} / {MAX_CHARS}자
      {isOver && ' (초과)'}
    </span>
    {isOver && (
      <button onClick={() => { /* AI로 요약 단축 */ }}
        className="text-xs2 text-violet-600 hover:underline">
        AI로 단축하기
      </button>
    )}
  </div>
  ```

- [ ] **F7-2: 바이트수 표시 (한국 특허: 1500바이트 제한)**

  ```typescript
  const byteCount = new TextEncoder().encode(currentText).length;
  // 글자수 옆에 바이트수도 표시
  <span className="text-xs2 text-gray-300">/ {byteCount}bytes</span>
  ```

- [ ] **F7-3: 청구항 연동 안내**

  요약서 패널 상단에 "이 요약서는 제1항 독립항을 기반으로 생성됐습니다" 연결 표시:
  ```typescript
  <div className="mx-3 mt-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs2 text-amber-700">
    💡 요약서는 확정된 <strong>청구항 1 (독립항)</strong>을 기반으로 생성됩니다. 
    청구항 수정이 필요하면 이전 단계로 돌아가세요.
  </div>
  ```

- [ ] **Commit**
  ```bash
  git commit -m "feat: abstract panel — char/byte counter, AI shorten, claims linkage notice"
  ```

---

## Feature 8: 명세서 에디터 완성 (70% → 85%)

**이용자가 기대하는 경험:**
명세서를 작성하다 보면 어떤 섹션이 비어 있는지, 어떤 섹션이 충분히 작성되었는지 알 수 있다. 도면을 편집하고 돌아오면 도면 탭이 업데이트되어 있다.

**구현 Task:**

- [ ] **F8-1: 섹션별 완성도 표시** (`SpecEditorView.tsx`)

  섹션 탭 바에 각 섹션의 글자수 또는 완성도 인디케이터 추가:
  ```typescript
  // 섹션 탭에 완성도 점(dot) 표시
  const sectionWordCount = (id: SectionId) =>
    blocks[id]?.join(' ').replace(/\s+/g, ' ').trim().length ?? 0;
  const sectionStatus = (id: SectionId) => {
    const len = sectionWordCount(id);
    if (len === 0) return 'empty';
    if (len < 50) return 'minimal';
    return 'ok';
  };

  // 탭 버튼에 status dot
  <span className={clsx('inline-block w-1.5 h-1.5 rounded-full ml-1',
    sectionStatus(s.id) === 'empty' ? 'bg-red-300' :
    sectionStatus(s.id) === 'minimal' ? 'bg-amber-300' : 'bg-green-400'
  )}/>
  ```

- [ ] **F8-2: 빈 섹션 경고** 

  "저장" 또는 "미리보기" 클릭 시 비어있는 섹션 목록 표시:
  ```typescript
  const emptySections = EDITOR_SECTIONS.filter(s => !blocks[s.id]?.join('').trim());
  if (emptySections.length > 0) {
    // 경고 toast
    toast.show(
      `미완성 섹션: ${emptySections.map(s => s.short).join(', ')}`,
      'warning'
    );
  }
  ```

- [ ] **F8-3: 섹션 이동 — 키보드 단축키**

  ```typescript
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ']') {
        // 다음 섹션으로
        const idx = EDITOR_SECTIONS.findIndex(s => s.id === activeSec);
        if (idx < EDITOR_SECTIONS.length - 1) goToSection(EDITOR_SECTIONS[idx + 1].id);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '[') {
        // 이전 섹션으로
        const idx = EDITOR_SECTIONS.findIndex(s => s.id === activeSec);
        if (idx > 0) goToSection(EDITOR_SECTIONS[idx - 1].id);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeSec]);
  ```

- [ ] **F8-4: 도면 탭 — 분석 도면 + 편집 완료 상태 표시**

  에디터 도면 탭에 analysisResult.drawings를 사용하고, stage별 상태 표시:
  ```typescript
  // 완성된 도면은 썸네일 + 녹색, 미완성은 회색 플레이스홀더
  {d.exportedImageUrl ? (
    <img src={d.exportedImageUrl} className="w-full h-full object-contain"/>
  ) : (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <span className="text-xs2 text-gray-400">편집 필요</span>
    </div>
  )}
  ```

- [ ] **F8-5: 글자수 표시 — 섹션별**

  각 섹션 헤더 옆에 해당 섹션 전체 글자수:
  ```typescript
  <h2 className="text-sm font-bold text-zinc-800 mb-3 pb-1.5 border-b border-zinc-200 flex items-center justify-between">
    {sec.label}
    <span className="text-xs2 font-normal text-zinc-400">
      {blocks[sec.id]?.join('').length ?? 0}자
    </span>
  </h2>
  ```

- [ ] **Commit**
  ```bash
  git commit -m "feat: spec editor — section completeness dots, empty warnings, keyboard nav, char counts"
  ```

---

## Feature 9: 미리보기/내보내기 완성 (20% → 75%)

**이용자가 기대하는 경험:**
"미리보기"를 클릭하면 실제 작성 중인 명세서 내용이 특허청 제출 형식과 유사하게 표시된다. "DOCX 다운로드"는 "아직 준비 중"이라고 안내한다.

**구현 Task:**

- [ ] **F9-1: PreviewModal — 실제 에디터 내용 반영**

  SpecEditorView에서 미리보기 버튼 추가 + 현재 blocks 내용으로 PreviewModal 구성:
  ```typescript
  // SpecEditorView 툴바에 미리보기 추가
  <button onClick={() => setPreviewOpen(true)}
    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded hover:bg-zinc-100 text-xs2 text-zinc-600">
    <Icon name="search" size={12}/> 미리보기
  </button>

  // previewSections 생성
  const makeEditorPreview = (): PreviewSection[] =>
    EDITOR_SECTIONS.map(sec => ({
      label: sec.label,
      content: blocks[sec.id]?.join('\n\n') || '',
    })).filter(s => s.content.trim());
  ```

- [ ] **F9-2: PreviewModal — 특허 문서 형식 스타일링**

  모달 내부를 실제 특허 문서처럼 스타일링:
  ```typescript
  // 각 섹션을 【발명의 명칭】 형태로 표시
  {sections.map((s, i) => (
    <div key={i} className="mb-6">
      <h4 className="text-sm font-bold text-gray-900 mb-2">【{s.label}】</h4>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line pl-4 border-l-2 border-gray-100">
        {s.content || <span className="text-gray-300 italic">내용을 입력하세요</span>}
      </p>
    </div>
  ))}
  ```

- [ ] **F9-3: DOCX/PDF 버튼 — "준비 중" 피드백**

  ```typescript
  <button onClick={() => {
    toast.show('DOCX 다운로드는 실제 서비스에서 제공됩니다. (현재 프로토타입)', 'info');
  }} className="btn-primary btn-sm" style={{ background: '#2563eb' }}>
    <Icon name="doc" size={12}/> DOCX 다운로드
  </button>
  ```

- [ ] **F9-4: 전체 글자수/페이지 예상 표시**

  미리보기 모달 하단에 총 글자수와 예상 페이지 수 표시:
  ```typescript
  const totalChars = sections.reduce((acc, s) => acc + s.content.length, 0);
  const estimatedPages = Math.ceil(totalChars / 1000); // 약 1000자 = 1페이지 (가이드라인)

  <div className="flex items-center gap-4 text-xs2 text-gray-400 px-4 py-2 border-t">
    <span>총 {totalChars.toLocaleString()}자</span>
    <span>예상 {estimatedPages}페이지</span>
    <span className={clsx(totalChars > 30000 ? 'text-amber-500' : 'text-gray-300')}>
      {totalChars > 30000 ? '⚠️ 권장 분량 초과' : '✓ 권장 분량 이내'}
    </span>
  </div>
  ```

- [ ] **Commit**
  ```bash
  git commit -m "feat: preview modal — real content, patent format styling, DOCX feedback, stats"
  ```

---

## Feature 10: 검색 결과 — 배경기술 참조 기능 (미구현 → 기본 구현)

**이용자가 기대하는 경험:**
선행특허 검색 후 관련 특허를 "배경기술로 참조"하면, 명세서 작성 시 해당 특허 정보가 배경기술 섹션에 인용 형태로 들어간다.

**현재 문제:**
- "배경기술 참조" 버튼이 alert("mockup") 출력

**구현 Task:**

- [ ] **F10-1: 배경기술 참조 — 라이브러리 저장 + 에디터 연결**

  "배경기술 참조" 클릭 시:
  1. 해당 특허를 라이브러리에 저장 (자동, 태그='배경기술')
  2. Toast: "배경기술로 참조됨 — 명세서 에디터의 참고문헌 탭에서 인용할 수 있습니다"
  
  ```typescript
  const handleBgRef = (patent: PatentResult) => {
    libraryAdd({
      type: 'patent',
      refNumber: patent.applicationNo || patent.number,
      title: patent.title,
      applicant: patent.applicant,
      applicationDate: patent.applicationDate,
      abstract: patent.abstract,
      tags: ['배경기술'],
      note: '배경기술 참조',
      favorite: false,
      fromTaskId: activeTaskId || undefined,
    });
    toast.show(
      `배경기술 참조 완료: ${patent.title.slice(0, 30)}... — 에디터 참고문헌 탭에서 인용 가능`,
      'success'
    );
  };
  ```

- [ ] **Commit**
  ```bash
  git commit -m "feat: search — background art reference saves to library with tag"
  ```

---

## Feature 11: 라이브러리 → 에디터 참고문헌 연결

**이용자가 기대하는 경험:**
라이브러리에 저장된 특허/논문을 에디터의 "참고문헌" 탭에서 바로 인용할 수 있다.

**현재 문제:**
- SpecEditorView 참고문헌 탭이 `library` (전체)를 보여주나, 검색이나 필터가 없음
- "배경기술" 태그 항목을 우선 표시하는 기능 없음

**구현 Task:**

- [ ] **F11-1: 에디터 참고문헌 탭 — 검색 + 배경기술 우선 표시**

  ```typescript
  // SpecEditorView 참고문헌 탭
  const [refSearch, setRefSearch] = useState('');
  const filtered = library
    .filter(l => !refSearch || l.title.toLowerCase().includes(refSearch.toLowerCase()) || l.refNumber.includes(refSearch))
    .sort((a, b) => {
      // 배경기술 태그 항목 우선
      const aIsBg = a.tags?.includes('배경기술') ? -1 : 0;
      const bIsBg = b.tags?.includes('배경기술') ? -1 : 0;
      return aIsBg - bIsBg;
    });

  <input
    className="input text-xs2 py-1.5 mb-2 w-full"
    placeholder="특허번호·제목 검색..."
    value={refSearch}
    onChange={e => setRefSearch(e.target.value)}
  />
  {filtered.map(item => (
    <div key={item.id} className="rounded-xl border border-zinc-200 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {item.tags?.includes('배경기술') && (
          <span className="text-xs2 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">배경기술</span>
        )}
        <span className="text-xs2 font-mono text-zinc-400">{item.refNumber}</span>
      </div>
      // ...
    </div>
  ))}
  ```

- [ ] **Commit**
  ```bash
  git commit -m "feat: editor refs tab — search, background art priority display"
  ```

---

## 자기 검토

### 완성도 향상 목표

| 기능 | 구현 전 | 구현 후 |
|------|---------|---------|
| 직무발명서 업로드 | 30% | 80% |
| 발명의 명칭 | 60% | 85% |
| 발명의 설명 | 55% | 85% |
| 구성요소 | 70% | 85% |
| 도면 | 40% | 75% |
| 청구항 | 75% | 85% |
| 요약서 | 65% | 80% |
| 명세서 에디터 | 70% | 85% |
| 미리보기 | 20% | 75% |
| 검색 배경기술 참조 | 0% | 70% |
| 라이브러리-에디터 연결 | 40% | 75% |

### 구현 순서

1. F1 (업로드) — 첫 진입 경험이므로 최우선
2. F5 (도면) — 가장 차별적 기능, 원본 이미지 있어야 UX 완성
3. F9 (미리보기) — 완성도 체감 직접 영향
4. F2 (명칭) — 재생성 버튼 no-op이 프로토타입 신뢰도 저하
5. F3 (설명) — 섹션 가이드 추가
6. F8 (에디터) — 완성도 점, 빈 섹션 경고
7. F6 (청구항) — 번호 연속성
8. F7 (요약서) — 글자수 제한
9. F4 (구성요소) — 계층 시각화
10. F10-F11 (검색-라이브러리 연결)

---

**두 가지 실행 방법:**

**1. Subagent-Driven (권장)** — Feature별 독립 서브에이전트, F1부터 순서대로

**2. Inline Execution** — executing-plans 스킬로 현재 세션 순차 실행
