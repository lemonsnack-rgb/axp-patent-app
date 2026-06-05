# AXPlain.ai 반응형 웹 실행 프롬프트

당신은 `c:\project\06_AXP\react-app` React 앱에 PC·태블릿·모바일 3단계 반응형을 구현한다.

---

## 브레이크포인트 기준

| 이름 | 범위 | Tailwind prefix |
|------|------|----------------|
| **PC** | ≥ 1024px | `lg:` |
| **태블릿** | 768 – 1023px | `md:` (and below `lg:`) |
| **모바일** | < 768px | base (no prefix) |

Tailwind 기본 브레이크포인트를 그대로 사용한다. 커스텀 브레이크포인트를 추가하지 않는다.

**스타일 원칙**:
- 기존 클래스(`ck-*`, `btn-primary`, `text-xs2`, `scroll-thin`, `w-nav`, `w-nav-c`)를 유지한다
- `inline style`로 하드코딩된 px 값을 Tailwind 클래스로 교체한다
- 모바일 퍼스트 원칙: base 스타일이 모바일, `md:` / `lg:` 로 확장

---

## Task R1 — TopBar 반응형

### 현재 문제
`src/components/TopBar.tsx` line 31에 인라인 style로 `calc(72px/260px - 24px)` 하드코딩.  
모바일에서 breadcrumb(현재 모드·작업명)이 잘림.

### 실행

**R1-A. 인라인 style 제거 → Tailwind 클래스로 교체**

현재 코드(line 27-56):
```tsx
<header className="h-topbar bg-white border-b border-zinc-200 flex items-center justify-between px-3 shrink-0">
  <div className="flex items-center gap-2">
    <div
      className={sidebarCollapsed ? 'flex items-center justify-center' : 'flex items-center justify-between'}
      style={{ width: `calc(${sidebarCollapsed ? '72px' : '260px'} - 24px)` }}
    >
```

교체 후:
```tsx
<header className="h-topbar bg-white border-b border-zinc-200 flex items-center justify-between px-3 shrink-0 gap-2">
  <div className="flex items-center gap-2 min-w-0">
    <div
      className={clsx(
        'flex items-center shrink-0 transition-all duration-200',
        sidebarCollapsed ? 'w-[48px] justify-center' : 'w-[236px] justify-between',
        // 모바일: 사이드바 너비 영역 불필요 → 최소화
        'max-md:w-auto max-md:justify-start',
      )}
    >
```

**R1-B. breadcrumb 모바일 생략**

작업 이름(showTaskName)은 모바일에서 숨긴다:
```tsx
<span className="text-md2 text-zinc-500 ml-2 truncate min-w-0">
  {label}
  {showTaskName && active && (
    <>
      <span className="mx-1 text-zinc-300">/</span>
      <span className="text-zinc-800 font-medium hidden sm:inline truncate">{active.name}</span>
    </>
  )}
</span>
```

**R1-C. 우측 버튼 그룹 모바일 축소**

도움말(help) 링크는 모바일에서 숨긴다:
```tsx
<div className="flex items-center gap-1 shrink-0">
  <a href={HELP_URL} ... className="btn-ghost hidden md:flex" ...>
    <Icon name="help" />
  </a>
  <button className="btn-ghost relative" ...>  {/* 알림은 항상 표시 */}
  <button className="btn-ghost text-sm2 px-2 hidden sm:flex" ...>KR</button>
</div>
```

**R1-D. `import clsx` 추가** (없으면):
```typescript
import clsx from 'clsx';
```

---

## Task R2 — Sidebar 반응형

### 현재 상태
- 모바일(<768px): App.tsx에서 자동 접힘, 열리면 오버레이 표시됨 ✅
- 태블릿(768-1023px): 현재 PC와 동일하게 expanded/collapsed 상태 유지 → 개선 필요
- PC(≥1024px): 정상 동작 ✅

### 개선 목표
- **태블릿**: 기본 icon-only(collapsed), 탭 클릭 시 일시 expanded overlay
- **모바일**: 완전히 화면 밖으로 숨김, 햄버거 버튼으로 슬라이드 인

### 실행

**R2-A. App.tsx — 태블릿 자동 접힘 조건 추가**

현재 코드(line 22):
```typescript
const mq = window.matchMedia('(max-width: 767px)');
```

교체 후:
```typescript
// 태블릿(< 1024px)에서 자동 접힘
const mq = window.matchMedia('(max-width: 1023px)');
```

**R2-B. App.tsx — 모바일 오버레이 조건 개선**

현재 코드(line 32):
```typescript
const isMobileOpen = !sidebarCollapsed && window.innerWidth < 768;
```

교체 후:
```typescript
// 모바일·태블릿에서 사이드바 열릴 때 오버레이
const isMobileOpen = !sidebarCollapsed && window.innerWidth < 1024;
```

**R2-C. Sidebar.tsx — `<aside>` 클래스 반응형 추가**

현재(line 48-54):
```tsx
<aside
  className={clsx(
    'border-r border-zinc-200 bg-white flex flex-col shrink-0 transition-all duration-200 relative',
    sidebarCollapsed ? 'w-nav-c min-w-nav-c' : 'w-nav min-w-nav',
    'max-md:z-30',
  )}
>
```

교체 후:
```tsx
<aside
  className={clsx(
    'border-r border-zinc-200 bg-white flex flex-col shrink-0 transition-all duration-200 relative',
    // PC: 항상 인라인
    sidebarCollapsed ? 'lg:w-nav-c lg:min-w-nav-c' : 'lg:w-nav lg:min-w-nav',
    // 태블릿·모바일: 열릴 때 fixed overlay, 닫힐 때 화면 밖
    !sidebarCollapsed
      ? 'max-lg:fixed max-lg:top-0 max-lg:left-0 max-lg:h-full max-lg:z-40 max-lg:w-nav max-lg:shadow-2xl'
      : 'max-lg:fixed max-lg:top-0 max-lg:-left-full max-lg:h-full max-lg:z-40 max-lg:w-nav',
    // 모바일: collapsed 시 화면에서 완전히 제거 (아이콘 없음)
    sidebarCollapsed && 'max-md:hidden',
  )}
>
```

**R2-D. App.tsx — 태블릿·모바일에서 TopBar 햄버거 버튼 동작 보완**

`Shell` 컴포넌트에서 사이드바 열기 버튼을 TopBar에 전달하거나, TopBar에 이미 있는 로고 버튼이 사이드바를 연다.  
현재 TopBar line 34의 로고 버튼 onClick이 이미 `sidebarCollapsed ? setSidebarCollapsed(false) : setMode('home')` 처리 중 — 유지한다.

모바일에서 사이드바 닫기 버튼을 Sidebar 헤더에 추가한다:

```tsx
{/* 태블릿·모바일: 사이드바 내부 닫기 버튼 */}
<div className="lg:hidden flex items-center justify-between px-3 py-2 border-b border-zinc-100">
  <span className="text-sm font-semibold text-zinc-700">메뉴</span>
  <button
    onClick={() => setSidebarCollapsed(true)}
    className="btn-ghost p-1"
    aria-label="메뉴 닫기"
  >
    <Icon name="hamburger" size={16} />
  </button>
</div>
```

`{!sidebarCollapsed && (...)}` 블록 **최상단**에 삽입한다.

---

## Task R3 — SpecView GuidePanel 반응형

### 현재 문제
GuidePanel이 `style={{ width: '380px', minWidth: '320px', maxWidth: '700px' }}` 인라인으로 고정.  
모바일·태블릿에서 메인 콘텐츠 영역을 심하게 침범하거나 레이아웃이 깨짐.

### 목표 레이아웃

| 화면 | GuidePanel |
|------|-----------|
| PC (≥1024px) | 우측 고정 사이드 패널 (현재와 동일) |
| 태블릿 (768-1023px) | 우측 패널, 너비 300px로 축소. "가이드 패널" 토글 버튼으로 열기/닫기 |
| 모바일 (<768px) | 하단 드로어(bottom drawer). 탭 헤더만 표시, 탭 클릭 시 full-height 슬라이드업 |

### 실행

**R3-A. SpecView.tsx — GuidePanel 래퍼 반응형 처리**

GuidePanel이 렌더링되는 `{guideOpen && (phase === 'flow' || phase === 'done') && (` 부분을 찾아 교체한다.

현재:
```tsx
{guideOpen && (phase === 'flow' || phase === 'done') && (
  <GuidePanel
    key={`guide-panel-${guideStep}`}
    step={guideStep}
    ...
  />
)}
```

교체 후:
```tsx
{(phase === 'flow' || phase === 'done') && (
  <>
    {/* PC·태블릿: 우측 사이드 패널 */}
    <div className={clsx(
      'hidden md:flex transition-all duration-200',
      guideOpen ? 'flex' : 'hidden',
    )}>
      {guideOpen && (
        <GuidePanel
          key={`guide-panel-${guideStep}`}
          step={guideStep}
          {...나머지 props}
        />
      )}
    </div>

    {/* 모바일: 하단 드로어 */}
    <div className={clsx(
      'md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-ck-border transition-transform duration-300 shadow-2xl',
      guideOpen ? 'translate-y-0' : 'translate-y-full',
    )}
    style={{ maxHeight: '75vh' }}>
      {/* 드로어 핸들 */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-ck-border cursor-pointer"
        onClick={() => setGuideOpen(p => !p)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto" />
        </div>
        <span className="text-sm font-semibold text-ck-text">
          {STEP_LABEL[guideStep] ?? 'AI 가이드'} 
        </span>
        <button className="text-ck-muted text-xs">닫기</button>
      </div>
      <div className="overflow-y-auto scroll-thin" style={{ maxHeight: 'calc(75vh - 48px)' }}>
        {guideOpen && (
          <GuidePanel
            key={`guide-panel-mobile-${guideStep}`}
            step={guideStep}
            {...나머지 props}
          />
        )}
      </div>
    </div>
  </>
)}
```

**R3-B. GuidePanel aside — 인라인 style 반응형으로 교체**

GuidePanel 함수 내부의 `<aside ref={panelRef} ... style={{ width: '380px', minWidth: '320px', maxWidth: '700px', position: 'relative' }}>` 를 찾아 교체한다:

```tsx
<aside
  ref={panelRef}
  className={clsx(
    'border-l border-ck-border bg-white flex flex-col overflow-hidden shrink-0',
    // PC: 고정 너비 + 리사이즈 가능
    'lg:w-[380px] lg:min-w-[320px] lg:max-w-[700px]',
    // 태블릿: 축소 너비
    'md:w-[300px] md:min-w-[280px]',
    // 모바일: full width (드로어에서 사용)
    'w-full',
  )}
  style={{ position: 'relative' }}
>
```

**R3-C. GuidePanel 토글 버튼 (태블릿용)**

SpecView의 메인 콘텐츠 영역 오른쪽 상단(액션바)에 GuidePanel 토글 버튼을 추가한다:

```tsx
{/* 태블릿에서만 GuidePanel 토글 버튼 표시 */}
{(phase === 'flow' || phase === 'done') && (
  <button
    onClick={() => setGuideOpen(p => !p)}
    className={clsx(
      'hidden md:flex lg:hidden items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
      guideOpen
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'border-ck-border text-ck-muted hover:border-blue-300',
    )}
  >
    <Icon name="panel" size={13} />
    {guideOpen ? 'AI 패널 닫기' : 'AI 패널'}
  </button>
)}
```

**R3-D. 모바일: 드로어 열기 플로팅 버튼**

모바일에서 GuidePanel이 닫힌 상태일 때 화면 하단에 플로팅 버튼을 표시한다:

```tsx
{/* 모바일: GuidePanel 열기 플로팅 버튼 */}
{(phase === 'flow' || phase === 'done') && !guideOpen && (
  <button
    onClick={() => setGuideOpen(true)}
    className="md:hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg active:scale-95 transition-all"
  >
    <Icon name="panel" size={15} />
    AI 가이드
  </button>
)}
```

---

## Task R4 — SpecEditorView 우측 AI 패널 반응형

### 현재 구조
`src/views/SpecEditorView.tsx` — `③ 본문 + 우측 패널` (line 482-) 레이아웃:
```
[섹션 탭] [본문 스크롤 영역] [우측 AI 패널]
```

### 실행

**R4-A. 우측 패널 래퍼 반응형 클래스 추가**

SpecEditorView.tsx에서 `flex-1 flex overflow-hidden min-h-0` div(line 483)의 우측 패널 부분을 찾는다.  
우측 패널(`aside` 또는 패널 wrapper div)에 다음 클래스를 적용한다:

```tsx
{/* 우측 AI 패널 */}
<div className={clsx(
  'flex flex-col border-l border-zinc-200 bg-white overflow-hidden shrink-0 transition-all duration-200',
  // PC: 항상 표시, 고정 너비
  'lg:w-[360px] lg:flex',
  // 태블릿: 토글 가능, 접힌 상태에서는 숨김
  panelOpen ? 'md:w-[300px] md:flex' : 'md:hidden',
  // 모바일: 패널 숨김 (하단 드로어로 처리)
  'hidden',
)}>
  {/* 기존 우측 패널 내용 유지 */}
</div>
```

**R4-B. 툴바에 패널 토글 버튼 추가 (태블릿)**

SpecEditorView 편집 툴바(line 402-465)의 우측 버튼 그룹에 추가한다:

```tsx
{/* 태블릿: AI 패널 토글 */}
<button
  onClick={() => setPanelOpen(p => !p)}
  className={clsx(
    'hidden md:flex lg:hidden items-center gap-1 px-2.5 py-1.5 rounded text-xs2 transition-colors',
    panelOpen ? 'bg-blue-50 text-blue-700' : 'text-zinc-600 hover:bg-zinc-100',
  )}
  title="AI 패널 토글"
>
  <Icon name="panel" size={13} />
  AI
</button>
```

`panelOpen` state를 컴포넌트에 추가한다:
```typescript
const [panelOpen, setPanelOpen] = useState(true);
```

**R4-C. 모바일: 선택 블록 시 하단 AI 드로어**

모바일에서 블록을 클릭(selectBlock)하면 하단 드로어로 AI 패널이 나타나야 한다.  
SpecEditorView 렌더 최하단에 추가한다:

```tsx
{/* 모바일: AI 패널 하단 드로어 */}
{sel && (
  <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-200 shadow-2xl"
    style={{ maxHeight: '50vh' }}>
    <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100">
      <span className="text-sm font-semibold">
        AI 수정 — {EDITOR_SECTIONS.find(s => s.id === sel.sid)?.short}
      </span>
      <button onClick={() => setSel(null)} className="text-zinc-400 hover:text-zinc-700 text-lg leading-none">✕</button>
    </div>
    <div className="overflow-y-auto scroll-thin p-3" style={{ maxHeight: 'calc(50vh - 44px)' }}>
      {/* AI 채팅/수정안 영역 — 기존 우측 패널의 panelTab==='ai' 내용을 여기에 복사하여 렌더링 */}
      {/* 구체적으로: chatMessages 렌더링 + chatInput 입력창 */}
    </div>
  </div>
)}
```

---

## Task R5 — 메인 콘텐츠 뷰 반응형

### 실행

**R5-A. SpecView 액션바 (상단 도구막대) 모바일 축소**

SpecView.tsx에서 Action Bar `div`를 찾아 반응형 처리한다.  
버튼 텍스트 레이블을 모바일에서 숨기고 아이콘만 표시:

```tsx
{/* PC에서만 텍스트, 모바일에서는 아이콘 */}
<button className="flex items-center gap-1 px-2.5 py-1.5 ...">
  <Icon name="preview" size={14} />
  <span className="hidden sm:inline">미리보기</span>
</button>
```

**R5-B. SpecView 메인 영역 — 분석 완료 카드 모바일 단일 열**

Step별 확정 카드들이 grid 또는 flex로 나열되어 있으면 모바일에서 단일 열로:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
```

**R5-C. PreviewModal 반응형**

`src/components/PreviewModal.tsx`에서 모달 컨테이너를 찾아 모바일 대응한다:

```tsx
{/* 모달 내부 컨테이너 */}
<div className={clsx(
  'bg-white flex flex-col overflow-hidden',
  // PC: 최대 너비 제한
  'lg:rounded-xl lg:max-w-4xl lg:max-h-[90vh] lg:w-full',
  // 모바일: full screen
  'max-lg:w-screen max-lg:h-screen max-lg:rounded-none',
)}>
```

**R5-D. ProjectDetailView, LibraryView, HomeView — 카드 그리드 반응형**

`src/views/HomeView.tsx`, `ProjectDetailView.tsx`, `LibraryView.tsx`에서 카드 그리드를 찾아 반응형 columns를 적용한다:

```tsx
{/* 프로젝트 카드 그리드 */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
```

---

## Task R6 — DrawingEditorModal 반응형

### 실행

**R6-A. `src/features/drawing-workflow/DrawingEditorModal.tsx` — 모달 컨테이너**

모달 최상위 컨테이너 div를 찾아 교체한다.  
현재 `fixed inset-0 z-50 flex items-center justify-center ...` 패턴이면:

```tsx
{/* 모달 오버레이 */}
<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
  {/* 모달 본체 */}
  <div className={clsx(
    'bg-white flex flex-col overflow-hidden',
    // 모바일: 하단에서 올라오는 시트, full-width
    'w-full max-h-[95vh] rounded-t-2xl sm:rounded-xl',
    // 태블릿·PC: 중앙 모달
    'sm:w-[90vw] sm:max-w-5xl sm:max-h-[90vh] sm:h-auto',
    // PC: 고정 높이
    'lg:h-[85vh]',
  )}>
```

**R6-B. 내부 레이아웃 모바일 스택**

DrawingEditorModal 내부의 좌/우 2열 레이아웃(이미지 + 컨트롤)이 있으면 모바일에서 세로 스택으로:

```tsx
<div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
  {/* 도면 영역 */}
  <div className="flex-1 md:flex-none md:w-[60%] min-h-0 overflow-hidden">
  {/* 컨트롤 영역 */}
  <div className="md:w-[40%] border-t md:border-t-0 md:border-l border-ck-border overflow-y-auto">
```

---

## Task R7 — 검색 뷰 반응형

**R7-A. `src/views/SearchView.tsx` (특허 검색)**

필터 사이드바와 결과 목록의 2열 레이아웃을 반응형으로:

```tsx
<div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
  {/* 필터 패널 */}
  <div className={clsx(
    'border-b lg:border-b-0 lg:border-r border-ck-border shrink-0',
    'lg:w-[280px] lg:overflow-y-auto',
    // 모바일: 필터 접기/펼치기
    filterOpen ? 'h-auto' : 'h-12 overflow-hidden',
  )}>
  {/* 결과 목록 */}
  <div className="flex-1 overflow-y-auto">
```

---

## Task R8 — 터치 UX 개선

### 실행

**R8-A. 모바일 탭 영역 최소 터치 크기 보장**

작은 버튼(16px 이하)을 모바일에서 44px 터치 영역으로 확장한다.  
`src/views/SpecView.tsx`, `src/views/SpecEditorView.tsx`의 아이콘 버튼들:

```tsx
{/* 기존 */}
<button className="p-1 ...">

{/* 수정 후: 모바일 터치 영역 확대 */}
<button className="p-1 md:p-1 p-2.5 ...">
```

**R8-B. 스크롤 가능 영역 overscroll-behavior 추가**

모바일에서 당겨서 새로고침 방지:

```tsx
<div className="flex-1 overflow-y-auto scroll-thin overscroll-contain">
```

SpecView의 `flowRef` div, SpecEditorView의 `centerRef` div에 `overscroll-contain` 클래스를 추가한다.

**R8-C. 모바일 input 폰트 크기 16px 이상 (zoom 방지)**

iOS에서 input 클릭 시 자동 zoom 방지. `tailwind.config.js`에 플러그인 없이, 직접 input 클래스에 `text-base`(16px)를 모바일에서 적용:

```tsx
<input
  className="... text-base sm:text-sm ..."
/>
```

SpecView.tsx의 직접입력 폼(`diTitle`, `diField`, `diContent`, `diProblem`, `diKeywords` textarea/input), Sidebar.tsx의 검색 input, Task 7의 작업 검색 input 모두 적용한다.

---

## Task R9 — 반응형 CSS 최종 정리

**R9-A. `tailwind.config.js` — 불필요한 커스텀 너비 주석 추가**

변경하지는 않되, 사용 중인 커스텀 값을 확인한다:
- `w-nav` = 260px (Sidebar PC 확장)
- `w-nav-c` = 72px (Sidebar PC 축소)
- `h-topbar` = 48px (TopBar 고정 높이)

이 값들은 유지한다.

**R9-B. 반응형 확인 클래스 일관성**

전체 파일에서 `max-md:` prefix와 `md:` prefix가 혼재하지 않도록 통일한다:
- 모바일 전용 → base 클래스 (prefix 없음)
- 태블릿 이상 → `md:` prefix
- PC 이상 → `lg:` prefix
- `max-md:`, `max-lg:` 는 특정 크기 이하에서만 적용할 때 사용 (예외적으로 허용)

---

## 빌드 및 검증

```bash
cd c:\project\06_AXP\react-app
npm run build
```

### 브라우저 반응형 검증 (Chrome DevTools → Toggle device toolbar)

**모바일 (375×812 — iPhone SE)**
- [ ] 사이드바가 화면에 없음 (숨김 상태)
- [ ] TopBar: 로고 + 모드명만 표시, 햄버거로 사이드바 열림
- [ ] 사이드바 열기 → 전체 화면 오버레이, 탭 선택 시 자동 닫힘
- [ ] SpecView: 단일 열, "AI 가이드" 플로팅 버튼 표시
- [ ] "AI 가이드" 탭 → 하단 드로어 슬라이드업
- [ ] SpecEditorView: 블록 클릭 → 하단 AI 드로어 표시
- [ ] PreviewModal: 전체 화면
- [ ] DrawingEditorModal: 하단 시트로 올라옴
- [ ] input 클릭 시 zoom 없음

**태블릿 (768×1024 — iPad)**
- [ ] 사이드바: icon-only, 탭 클릭 시 오버레이 확장
- [ ] TopBar: 도움말 버튼 표시
- [ ] SpecView: GuidePanel 우측 300px 패널 (토글 버튼 있음)
- [ ] SpecEditorView: AI 패널 토글 버튼 동작
- [ ] DrawingEditorModal: 중앙 모달 (90vw)

**PC (1280×900)**
- [ ] 사이드바: 260px 확장 / 72px 축소 토글
- [ ] SpecView: GuidePanel 우측 380px 패널
- [ ] SpecEditorView: AI 패널 항상 표시
- [ ] 전체 레이아웃 기존과 동일

### 회귀 검증 (반응형 추가 후 기존 기능 확인)
- [ ] 사이드바 Ctrl+B 단축키 동작 (PC)
- [ ] GuidePanel 리사이즈 핸들 동작 (PC)
- [ ] GuidePanel key prop(`guide-panel-${guideStep}`) 유지 (Task 3)
- [ ] SpecView 상태 저장/복원 동작 (Task 1)
