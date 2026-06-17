# 특허 검색 플로우 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검색어 입력 → 검색결과 → 상세페이지 플로우를 두 참고 UI 기반으로 개편한다.

**Architecture:**
- SearchView가 `searchQuery` 문자열을 소유하고 PatentInput → PatentResults → PatentDetail로 흘려보낸다.
- **기존 stage 기반 플로우(input → results → detail) 유지.** 코드 구조 대규모 변경 없음.
- PatentResults: 기존 상단 필터 바 구조 유지 + 목록을 카드 → **테이블** 뷰로 교체 + 페이지네이션 추가.
- PatentDetail: keywert.com 참고 — 키워드 하이라이터 바 + 앵커 탭 + 좌본문/우도면 2-column.

**참고 디자인:**
- 검색결과: `http://10.77.0.244:8010/patents` — 테이블 목록 / 컬럼 구성 / 페이지네이션 참고
- 상세페이지: `https://www.keywert.com/detail?...` — 키워드 바 + sticky 탭 + 2-column 참고

**MVP 구조 원칙:**
- 필터(패싯)는 **상단**에 위치. 좌측 사이드 패널로 이동 금지.
- PatentInput: 검색 설정(국가·문헌종류·상태·기간·검색범위·검색식) 그대로 유지.
- PatentResults: sri-header + **상단 필터 바(기존)** + 드로어 + 테이블 결과 + 우측 인라인 미리보기.
- 기존 SlidingView / GalleryView 유지 (삭제 금지).

**Tech Stack:** React 18, TypeScript, Tailwind CSS (신규 패키지 없음)

---

## ⚠️ MVP 디자인 시스템 — 반드시 준수

> 기존 컴포넌트와 **동일한 클래스/토큰**을 사용. 임의 인라인 스타일 또는 새 색상값 추가 금지.

### 컴포넌트 클래스

```
버튼: .btn-primary  — brand-400(#3B8EF5) 배경, rounded-lg
      .btn-outline  — 흰 배경 zinc 테두리, hover: brand
      .btn-ghost    — 투명 배경
      .btn-sm / .btn-xs  — 크기 수식어

카드:  .card        — bg-white border-neutral-150 rounded-xl shadow-card
배지:  .badge + .badge-blue / .badge-green / .badge-amber / .badge-gray / .badge-violet
입력:  .input       — border-neutral-200 rounded-lg, focus: brand-400 ring
스크롤: .scroll-thin
```

### 색상 토큰

```
blue-* = brand-* (tailwind.config.js 동일 매핑)
브랜드 primary:   blue-400 / brand-400 (#3B8EF5)
브랜드 dark:      blue-700 (#003A8C)  — 기존 active 토글에 사용됨
배경 강조:        blue-50  (#EBF3FE)
중립:             gray-*/zinc-*  (동일 팔레트)
```

### 타이포그래피

```
text-xs2   11px  — 보조 메타
text-sm2   12px  — 라벨, 칩
text-md2   13px  — 보조 본문
text-base2 14px  — 기본 본문
```

### 기존 패턴 (복사 우선)

```tsx
// 체크박스
<input type="checkbox" className="form-checkbox text-blue-700 rounded w-3 h-3" />

// 활성 탭 언더라인
'border-b-2 border-blue-400 text-blue-700 bg-blue-50/50'

// 비활성 탭
'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'

// 선택된 테이블 행
'bg-blue-50 border-l-2 border-l-blue-600'

// 카드 hover
'hover:border-blue-400'
```

> `style={{}}` 인라인 스타일은 KW_COLORS(키워드 pills) 같이 **동적 색상**이 필요한 경우에만 허용.

---

## 파일 구조

| 파일 | 변경 | 역할 |
|------|------|------|
| `src/views/SearchView.tsx` | Modify | searchQuery 상태 추가, PatentDetail에 전달 |
| `src/views/PatentInput.tsx` | Modify | `onRun(query: string)` 시그니처 변경 |
| `src/views/PatentResults.tsx` | Modify | ListResults → TableResults, Pagination 추가 |
| `src/components/PatentDetail.tsx` | Modify | keywert 스타일 재설계 |

---

## Task 1: SearchView + PatentInput — searchQuery 상태 연결

**Files:**
- Modify: `react-app/src/views/PatentInput.tsx`
- Modify: `react-app/src/views/SearchView.tsx`

- [ ] **Step 1: PatentInput Props 시그니처 변경**

`src/views/PatentInput.tsx` (line ~38):

```tsx
// 변경 전
interface Props { onRun: () => void }

// 변경 후
interface Props { onRun: (query: string) => void }
```

- [ ] **Step 2: 일반모드 검색 버튼 — formula 전달**

`src/views/PatentInput.tsx` (line ~354, `mode === 'builder'` 블록):

```tsx
// 변경 전
<button className="btn-primary btn-sm text-sm2" onClick={onRun}>검색</button>

// 변경 후
<button className="btn-primary btn-sm text-sm2" onClick={() => onRun(formula)}>검색</button>
```

- [ ] **Step 3: 편집기모드 검색 버튼 — formulaText 전달**

`src/views/PatentInput.tsx` (line ~397, `mode === 'formula'` 블록):

```tsx
// 변경 전
<button className="btn-primary btn-sm text-sm2" onClick={onRun}>검색</button>

// 변경 후
<button className="btn-primary btn-sm text-sm2" onClick={() => onRun(formulaText)}>검색</button>
```

- [ ] **Step 4: SearchView — searchQuery 상태 추가**

`src/views/SearchView.tsx` state 블록:

```tsx
// 기존 state 다음에 한 줄 추가
const [stage, setStage] = useState<Stage>('input');
const [detailIdx, setDetailIdx] = useState(0);
const [searchQuery, setSearchQuery] = useState('');   // 추가
const [saveCtx, setSaveCtx] = useState<...>(null);
```

- [ ] **Step 5: PatentInput onRun 핸들러 업데이트**

```tsx
// 변경 전
{stage === 'input' && searchType === 'patent' && (
  <PatentInput onRun={() => setStage('results')} />
)}

// 변경 후
{stage === 'input' && searchType === 'patent' && (
  <PatentInput onRun={(query) => { setSearchQuery(query); setStage('results'); }} />
)}
```

- [ ] **Step 6: PatentDetail에 searchQuery prop 전달**

```tsx
// 변경 전
{stage === 'detail' && searchType === 'patent' && (
  <PatentDetail
    data={PATENT_SEED[detailIdx]}
    onBack={() => setStage('results')}
    posLabel={`${detailIdx + 1} / ${PATENT_SEED.length}`}
    onSave={() => openSavePatent(detailIdx)}
    onPrev={detailIdx > 0 ? () => setDetailIdx(detailIdx - 1) : undefined}
    onNext={detailIdx < PATENT_SEED.length - 1 ? () => setDetailIdx(detailIdx + 1) : undefined}
  />
)}

// 변경 후 (searchQuery 한 줄 추가)
{stage === 'detail' && searchType === 'patent' && (
  <PatentDetail
    data={PATENT_SEED[detailIdx]}
    searchQuery={searchQuery}
    onBack={() => setStage('results')}
    posLabel={`${detailIdx + 1} / ${PATENT_SEED.length}`}
    onSave={() => openSavePatent(detailIdx)}
    onPrev={detailIdx > 0 ? () => setDetailIdx(detailIdx - 1) : undefined}
    onNext={detailIdx < PATENT_SEED.length - 1 ? () => setDetailIdx(detailIdx + 1) : undefined}
  />
)}
```

- [ ] **Step 7: 빌드 확인**

```bash
cd react-app && npm run build
```
Expected: 빌드 성공 (타입 에러 없음)

- [ ] **Step 8: Commit**

```bash
git add react-app/src/views/PatentInput.tsx react-app/src/views/SearchView.tsx
git commit -m "feat: wire searchQuery through PatentInput → SearchView → PatentDetail"
```

---

## Task 2: PatentResults — 테이블 뷰 + 페이지네이션

**Files:**
- Modify: `react-app/src/views/PatentResults.tsx`

> **변경 범위 최소화 원칙:**
> - `sri-header`, `sri-filter-bar`, `FilterDrawer`, 적용 필터 칩 행 — **그대로 유지**
> - 기존 `ListResults` 컴포넌트만 `TableResults`로 교체
> - `SlidingView`, `GalleryView` — **유지**
> - 레이아웃 구조(상단 필터 + 하단 결과) — **유지**

---

### 2-A: Pagination 컴포넌트 추가

- [ ] **Step 1: PatentResults.tsx 파일 하단(GalleryView 다음)에 Pagination 추가**

```tsx
// ── 페이지네이션 ──
function Pagination({ current, total, onChange }: {
  current: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const [jump, setJump] = useState('');
  if (total <= 1) return null;

  const start = Math.max(1, Math.min(current - 2, total - 4));
  const pages = Array.from({ length: Math.min(5, total) }, (_, i) => start + i);

  return (
    <div className="inline-flex items-center gap-1 text-sm2">
      <button
        onClick={() => onChange(Math.max(1, current - 1))}
        disabled={current === 1}
        className="px-1.5 py-0.5 border border-gray-300 rounded-md text-gray-500 hover:border-blue-400 disabled:opacity-30"
      >‹</button>
      {pages.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={clsx(
            'w-7 h-6 rounded-md border text-sm2 font-mono',
            p === current
              ? 'bg-blue-400 text-white border-blue-400'
              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400',
          )}
        >{p}</button>
      ))}
      <button
        onClick={() => onChange(Math.min(total, current + 1))}
        disabled={current === total}
        className="px-1.5 py-0.5 border border-gray-300 rounded-md text-gray-500 hover:border-blue-400 disabled:opacity-30"
      >›</button>
      <span className="text-xs2 text-gray-400 ml-1">이동</span>
      <input
        type="number"
        min={1}
        max={total}
        value={jump}
        onChange={e => setJump(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const p = parseInt(jump);
            if (p >= 1 && p <= total) { onChange(p); setJump(''); }
          }
        }}
        className="w-12 px-1 py-0.5 border border-gray-300 rounded-md text-xs2 font-mono text-center outline-none focus:border-blue-400"
        placeholder="—"
      />
      <span className="text-xs2 text-gray-400">/ {total}쪽</span>
    </div>
  );
}
```

---

### 2-B: TableResults 컴포넌트 추가 (ListResults 대체)

- [ ] **Step 2: 기존 `ListResults` 함수 전체를 `TableResults`로 교체**

참고 컬럼: `http://10.77.0.244:8010/patents` — No | 상태 | 문헌번호 | 문헌일 | 출원일 ↓ | 발명의 명칭 | 출원인 | 만료일

기존 `ListResults` 함수 전체 삭제 후 아래로 교체:

```tsx
// ── 테이블 목록 뷰 (참고: 선행기술조사 결과 화면) ──
function TableResults({ data, selectedCard, onSelectCard, onOpenDetail, onSave, page, onPageChange, totalCount }: {
  data: PatentResult[];
  selectedCard: number | null;
  onSelectCard: (i: number) => void;
  onOpenDetail: (i: number) => void;
  onSave: (i: number) => void;
  page: number;
  onPageChange: (p: number) => void;
  totalCount: number;
}) {
  const perPage = 20;
  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* 결과 테이블 영역 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-gray-200">
        {/* 테이블 상단 바 */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm2 font-semibold text-gray-700">
              총 <span className="text-blue-700">{totalCount.toLocaleString()}</span>건
            </span>
            <Pagination current={page} total={totalPages} onChange={onPageChange} />
          </div>
          <div className="flex gap-1.5">
            <button className="btn-outline btn-xs">BibTeX</button>
            <button className="btn-outline btn-xs">CSV 다운</button>
            <button className="btn-outline btn-xs">컬럼</button>
          </div>
        </div>

        {/* 테이블 */}
        <div className="flex-1 overflow-y-auto scroll-thin bg-white">
          <table className="w-full text-sm2 border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-3 py-2 text-center font-semibold text-gray-500 border-r border-gray-100">No</th>
                <th className="w-14 px-2 py-2 text-center font-semibold text-gray-500 border-r border-gray-100">상태</th>
                <th className="w-40 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">문헌번호</th>
                <th className="w-24 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">문헌일</th>
                <th className="w-24 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">출원일 ↓</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">발명의 명칭</th>
                <th className="w-32 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">출원인</th>
                <th className="w-28 px-2 py-2 text-left font-semibold text-gray-500">만료일</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => {
                const rowNo = (page - 1) * perPage + i + 1;
                const isSelected = selectedCard === i;
                const statusClass =
                  d.status === '등록' ? 'badge-green' :
                  d.status === '심사중' || d.status === '출원' ? 'badge-amber' :
                  'badge-gray';
                return (
                  <tr
                    key={i}
                    onClick={() => onSelectCard(i)}
                    className={clsx(
                      'border-b border-gray-100 cursor-pointer transition-colors',
                      isSelected
                        ? 'bg-blue-50 border-l-2 border-l-blue-600'
                        : 'hover:bg-gray-50',
                    )}
                  >
                    <td className="px-3 py-2 text-center text-xs2 text-gray-400">{rowNo}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`badge text-xs2 ${statusClass}`}>{d.status}</span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-mono text-xs2 text-blue-700 leading-snug">{d.number}</div>
                    </td>
                    <td className="px-2 py-2 text-xs2 text-gray-600 font-mono">{d.publicationDate || '—'}</td>
                    <td className="px-2 py-2 text-xs2 text-gray-600 font-mono">{d.applicationDate}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={e => { e.stopPropagation(); onOpenDetail(i); }}
                        className="text-left text-sm2 text-gray-800 hover:text-blue-700 line-clamp-2 leading-snug font-medium w-full"
                        title={d.title}
                      >
                        {d.title}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-xs2 text-gray-600 truncate max-w-[120px]">{d.applicant}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs2 text-gray-600 font-mono">{d.expirationDate || '—'}</span>
                        <button
                          onClick={e => { e.stopPropagation(); onSave(i); }}
                          className="ml-1 text-gray-400 hover:text-yellow-500 shrink-0"
                          title="라이브러리 저장"
                        >
                          <Icon name="star" size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 하단 페이지네이션 */}
        <div className="flex justify-center py-2 border-t border-gray-100 bg-white shrink-0">
          <Pagination current={page} total={totalPages} onChange={onPageChange} />
        </div>
      </div>

      {/* 우측 인라인 미리보기 (기존 InlineDetail 그대로 사용) */}
      <div className={clsx('flex flex-col overflow-hidden transition-all', selectedCard !== null ? 'w-80 min-w-80' : 'w-0 min-w-0')}>
        {selectedCard !== null && (
          <>
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
              <span className="text-md2 font-bold text-gray-700 truncate">{data[selectedCard]?.number}</span>
              <button onClick={() => onSelectCard(-1)} className="btn-ghost p-1"><Icon name="close" size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto scroll-thin p-3 text-md2">
              <InlineDetail
                d={data[selectedCard]}
                onOpenDetail={() => onOpenDetail(selectedCard)}
                onSave={() => onSave(selectedCard)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

> **주의:** `onSelectCard(-1)` 은 인라인 닫기용. `selectedCard` state 타입은 `number | null` 이므로,  
> `setSelectedCard` 호출 시 닫기는 `null`로 처리해야 한다.  
> 위 코드에서 `onSelectCard(-1)` 대신 `PatentResults` 함수에 `closeInline = () => setSelectedCard(null)` 을 만들어 전달하는 방식도 가능.

---

### 2-C: PatentResults 함수에 state 추가 + ListResults 사용처 교체

- [ ] **Step 3: `PatentResults` 함수 state 블록에 `page` 추가**

기존 state 선언 다음:

```tsx
const [selectedCard, setSelectedCard] = useState<number | null>(0);
const [appliedFilterRowVisible, setAppliedFilterRowVisible] = useState(false);
const [page, setPage] = useState(1);   // 추가
```

- [ ] **Step 4: `viewMode === 'list'` 분기에서 `ListResults` → `TableResults`로 교체**

PatentResults return 블록 내부 결과 렌더링 부분:

```tsx
// 변경 전
{viewMode === 'list' && (
  <ListResults
    data={data}
    selectedCard={selectedCard}
    onSelectCard={setSelectedCard}
    onOpenDetail={onOpenDetail}
    onSave={onSave}
  />
)}

// 변경 후
{viewMode === 'list' && (
  <TableResults
    data={data}
    selectedCard={selectedCard}
    onSelectCard={(i) => setSelectedCard(i === -1 ? null : i)}
    onOpenDetail={onOpenDetail}
    onSave={onSave}
    page={page}
    onPageChange={setPage}
    totalCount={count}
  />
)}
```

- [ ] **Step 5: 빌드 확인 + 브라우저 확인**

```bash
cd react-app && npm run dev
```
Expected:
- 검색 결과가 테이블 형태로 표시 (No | 상태 | 문헌번호 | 문헌일 | 출원일 | 발명의 명칭 | 출원인 | 만료일)
- 상단 필터 바는 기존과 동일하게 유지
- 행 클릭 → 우측 인라인 미리보기 표시
- 발명의 명칭 클릭 → 상세 페이지 이동
- 상단/하단 페이지네이션 버튼 표시
- 슬라이딩/갤러리 모드 여전히 동작

- [ ] **Step 6: Commit**

```bash
git add react-app/src/views/PatentResults.tsx
git commit -m "feat: PatentResults table view with pagination"
```

---

### 2-D: 테이블 기능 보강 (perPage / 체크박스 / 정렬 / 하이라이트)

내부 데모(`http://10.77.0.244:8010/patents`)에서 확인된 4가지 기능을 추가한다.

- [ ] **Step 7: `highlightText` 유틸 추가 (PatentResults.tsx — Pagination 함수 위에)**

```tsx
function highlightText(text: string, query?: string): React.ReactNode {
  if (!query || !query.trim()) return text;
  const words = query.trim().split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return text;
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((p, i) =>
        pattern.test(p)
          ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{p}</mark>
          : p,
      )}
    </>
  );
}
```

- [ ] **Step 8: PatentResults state 블록에 perPage / checked / sort 추가**

기존 `const [page, setPage] = useState(1);` 다음:

```tsx
const [page, setPage] = useState(1);
const [perPage, setPerPage] = useState<20|50|100|200>(20);
const [checked, setChecked] = useState<Set<number>>(new Set());
const [sortCol, setSortCol] = useState<'applicationDate'|'title'>('applicationDate');
const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
```

- [ ] **Step 9: sri-header 우측 버튼 그룹에 perPage 셀렉트 삽입**

`sri-header` className을 가진 div 내 오른쪽 버튼 그룹(기존 모드 전환 버튼 바로 앞)에 추가:

```tsx
<select
  value={perPage}
  onChange={e => { setPerPage(Number(e.target.value) as 20|50|100|200); setPage(1); }}
  className="input text-sm2 py-0.5 h-7 w-28"
>
  <option value={20}>20개씩 보기</option>
  <option value={50}>50개씩 보기</option>
  <option value={100}>100개씩 보기</option>
  <option value={200}>200개씩 보기</option>
</select>
```

- [ ] **Step 10: TableResults props 확장 + 내부 3곳 수정**

**A. Props 시그니처 교체** (`function TableResults({` 부분):

```tsx
// 변경 전
function TableResults({ data, selectedCard, onSelectCard, onOpenDetail, onSave, page, onPageChange, totalCount }: {
  data: PatentResult[];
  selectedCard: number | null;
  onSelectCard: (i: number) => void;
  onOpenDetail: (i: number) => void;
  onSave: (i: number) => void;
  page: number;
  onPageChange: (p: number) => void;
  totalCount: number;
})

// 변경 후
function TableResults({ data, selectedCard, onSelectCard, onOpenDetail, onSave, page, onPageChange, totalCount, searchQuery, checked, onToggleCheck, onToggleAll, sortCol, sortDir, onSort }: {
  data: PatentResult[];
  selectedCard: number | null;
  onSelectCard: (i: number) => void;
  onOpenDetail: (i: number) => void;
  onSave: (i: number) => void;
  page: number;
  onPageChange: (p: number) => void;
  totalCount: number;
  searchQuery?: string;
  checked: Set<number>;
  onToggleCheck: (i: number) => void;
  onToggleAll: (all: boolean) => void;
  sortCol: 'applicationDate'|'title';
  sortDir: 'asc'|'desc';
  onSort: (col: 'applicationDate'|'title') => void;
})
```

**B. `<thead>` 교체** — 체크박스 열 + 정렬 클릭 헤더 추가:

```tsx
// 변경 전
<thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
  <tr>
    <th className="w-10 px-3 py-2 text-center font-semibold text-gray-500 border-r border-gray-100">No</th>
    <th className="w-14 px-2 py-2 text-center font-semibold text-gray-500 border-r border-gray-100">상태</th>
    <th className="w-40 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">문헌번호</th>
    <th className="w-24 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">문헌일</th>
    <th className="w-24 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">출원일 ↓</th>
    <th className="px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">발명의 명칭</th>
    <th className="w-32 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">출원인</th>
    <th className="w-28 px-2 py-2 text-left font-semibold text-gray-500">만료일</th>
  </tr>
</thead>

// 변경 후
<thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
  <tr>
    <th className="w-8 px-2 py-2 text-center border-r border-gray-100">
      <input
        type="checkbox"
        className="form-checkbox text-blue-700 rounded w-3 h-3"
        checked={data.length > 0 && checked.size === data.length}
        onChange={e => onToggleAll(e.target.checked)}
      />
    </th>
    <th className="w-10 px-3 py-2 text-center font-semibold text-gray-500 border-r border-gray-100">No</th>
    <th className="w-14 px-2 py-2 text-center font-semibold text-gray-500 border-r border-gray-100">상태</th>
    <th className="w-40 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">문헌번호</th>
    <th className="w-24 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">문헌일</th>
    <th
      className="w-24 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100 cursor-pointer select-none hover:text-blue-700"
      onClick={() => onSort('applicationDate')}
    >
      출원일 {sortCol === 'applicationDate' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
    </th>
    <th
      className="px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100 cursor-pointer select-none hover:text-blue-700"
      onClick={() => onSort('title')}
    >
      발명의 명칭 {sortCol === 'title' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
    </th>
    <th className="w-32 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">출원인</th>
    <th className="w-28 px-2 py-2 text-left font-semibold text-gray-500">만료일</th>
  </tr>
</thead>
```

**C. `<tbody>` 각 행에 체크박스 td 추가 + 발명의 명칭 하이라이트 적용**:

```tsx
// 기존 <tr> 내 첫 번째 <td> 앞에 추가
<td className="px-2 py-2 text-center border-r border-gray-100" onClick={e => e.stopPropagation()}>
  <input
    type="checkbox"
    className="form-checkbox text-blue-700 rounded w-3 h-3"
    checked={checked.has(i)}
    onChange={() => onToggleCheck(i)}
  />
</td>

// 기존 발명의 명칭 <td> 내 버튼 텍스트 교체
// 변경 전: {d.title}
// 변경 후: {highlightText(d.title, searchQuery)}
```

**D. TableResults 호출부 교체** (`viewMode === 'list'` 분기):

```tsx
// 변경 전
<TableResults
  data={data}
  selectedCard={selectedCard}
  onSelectCard={(i) => setSelectedCard(i === -1 ? null : i)}
  onOpenDetail={onOpenDetail}
  onSave={onSave}
  page={page}
  onPageChange={setPage}
  totalCount={count}
/>

// 변경 후
<TableResults
  data={data}
  selectedCard={selectedCard}
  onSelectCard={(i) => setSelectedCard(i === -1 ? null : i)}
  onOpenDetail={onOpenDetail}
  onSave={onSave}
  page={page}
  onPageChange={setPage}
  totalCount={count}
  searchQuery={searchQuery}
  checked={checked}
  onToggleCheck={(i) => setChecked(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  })}
  onToggleAll={(all) => setChecked(all ? new Set(data.map((_, i) => i)) : new Set())}
  sortCol={sortCol}
  sortDir={sortDir}
  onSort={(col) => {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }}
/>
```

> `searchQuery` prop은 `SearchView.tsx`에서 흘러내려오는 값이다 — Task 1에서 이미 연결됨.  
> 단, `PatentResults.tsx`의 Props에 `searchQuery?: string`을 추가해야 한다.

- [ ] **Step 11: PatentResults Props에 `searchQuery` 추가**

```tsx
// 변경 전
function PatentResults({ onOpenDetail, onSave, count, data }: {
  onOpenDetail: (idx: number) => void;
  onSave: (idx: number) => void;
  count: number;
  data: PatentResult[];
})

// 변경 후
function PatentResults({ onOpenDetail, onSave, count, data, searchQuery }: {
  onOpenDetail: (idx: number) => void;
  onSave: (idx: number) => void;
  count: number;
  data: PatentResult[];
  searchQuery?: string;
})
```

SearchView에서 호출 시 `searchQuery={searchQuery}` prop 전달 (Task 1 SearchView 수정 시 같이 처리).

- [ ] **Step 12: 빌드 확인**

```bash
cd react-app && npm run build
```
Expected: 타입 에러 없음

- [ ] **Step 13: Commit**

```bash
git add react-app/src/views/PatentResults.tsx
git commit -m "feat: PatentResults perPage selector, checkbox, sort, keyword highlight"
```

---

## Task 3: PatentDetail — keywert 스타일 재설계

**Files:**
- Modify: `react-app/src/components/PatentDetail.tsx`

> **기존 helper 함수 전부 유지 (수정 금지):**  
> `Section`, `BibRow`, `InfoRow`, `Row`, `TextBlock`, `SubClaim`, `CiteBlock`,  
> `buildTimeline`, `addDays`, `Timeline`, `renderFamilyPills`  
>
> **변경 대상:** `PatentDetail` 함수의 Props, state, return JSX + 새 컴포넌트 3개 추가.

---

### 3-A: import 추가 + 유틸 상수 추가

- [ ] **Step 1: PatentDetail.tsx 상단 import 수정**

```tsx
// 변경 전
import type { PatentResult } from '../types';
import { Icon } from './Icon';

// 변경 후
import { useRef, useState } from 'react';
import clsx from 'clsx';
import type { PatentResult } from '../types';
import { Icon } from './Icon';
```

- [ ] **Step 2: 키워드 파서 + 색상 배열 추가 (import 바로 아래, `export function` 앞)**

```tsx
// 검색식에서 키워드 추출
function parseKeywords(query: string): string[] {
  if (!query) return [];
  const cleaned = query
    .replace(/[A-Z_]+=\(/g, ' ')
    .replace(/[A-Z_]+=/g, ' ')
    .replace(/\b(AND|OR|NOT|ADJ|NEAR|KEY)\b/gi, ' ')
    .replace(/[():*?"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...new Set(
    cleaned.split(' ').map(w => w.trim()).filter(w => w.length > 1)
  )].slice(0, 10);
}

// 키워드별 고유 색상 (동적 색상 → style={{}} 허용)
const KW_COLORS = [
  { dot: '#ef4444', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  { dot: '#f59e0b', bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  { dot: '#10b981', bg: '#f0fdf4', text: '#059669', border: '#a7f3d0' },
  { dot: '#3b82f6', bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  { dot: '#8b5cf6', bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  { dot: '#ec4899', bg: '#fdf2f8', text: '#db2777', border: '#fbcfe8' },
  { dot: '#06b6d4', bg: '#ecfeff', text: '#0891b2', border: '#a5f3fc' },
  { dot: '#84cc16', bg: '#f7fee7', text: '#65a30d', border: '#d9f99d' },
];
```

---

### 3-B: PatentDetail 함수 수정

- [ ] **Step 3: Props에 `searchQuery` 추가**

```tsx
// 변경 전
export function PatentDetail({ data, onBack, posLabel, onSave, onPrev, onNext }: {
  data: PatentResult; onBack: () => void; posLabel?: string;
  onSave?: () => void; onPrev?: () => void; onNext?: () => void;
})

// 변경 후
export function PatentDetail({ data, onBack, posLabel, onSave, onPrev, onNext, searchQuery }: {
  data: PatentResult; onBack: () => void; posLabel?: string;
  onSave?: () => void; onPrev?: () => void; onNext?: () => void;
  searchQuery?: string;
})
```

- [ ] **Step 4: 함수 내 state/ref 추가 (기존 `timeline`, `statusClass` 변수 다음)**

keywert 탭 구성 기준: `서지사항 | 인명정보 | 요약 | 상세설명 | 청구범위 | 패밀리정보 | 인용·피인용 | 분류코드 | 기타정보`  
— `도면의설명` 탭 없음 (도면은 우측 패널 전용). `기타정보` = 대리인 + 심판 통합.

```tsx
const timeline = buildTimeline(data);
const statusClass = /* 기존 그대로 유지 */ ...;

// 추가
const [activeTab, setActiveTab] = useState('bib');
const [claimMode, setClaimMode] = useState<'independent'|'all'>('independent');
const [familyTab, setFamilyTab] = useState('all');
const secBib      = useRef<HTMLDivElement>(null);
const secPerson   = useRef<HTMLDivElement>(null);
const secAbstract = useRef<HTMLDivElement>(null);
const secDesc     = useRef<HTMLDivElement>(null);
const secClaim    = useRef<HTMLDivElement>(null);
const secFamily   = useRef<HTMLDivElement>(null);
const secCite     = useRef<HTMLDivElement>(null);
const secClass    = useRef<HTMLDivElement>(null);
const secEtc      = useRef<HTMLDivElement>(null);

const TABS = [
  { key: 'bib',      label: '서지사항',    ref: secBib },
  { key: 'person',   label: '인명정보',    ref: secPerson },
  { key: 'abstract', label: '요약',        ref: secAbstract },
  { key: 'desc',     label: '상세설명',    ref: secDesc },
  { key: 'claim',    label: '청구범위',    ref: secClaim },
  { key: 'family',   label: '패밀리정보',  ref: secFamily },
  { key: 'cite',     label: '인용·피인용', ref: secCite },
  { key: 'class',    label: '분류코드',    ref: secClass },
  { key: 'etc',      label: '기타정보',    ref: secEtc },
] as const;

const scrollToSection = (ref: React.RefObject<HTMLDivElement>, key: string) => {
  ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setActiveTab(key);
};
```

- [ ] **Step 5: PatentDetail return 블록 전체 교체**

기존 return 블록을 아래로 완전히 교체한다.  
내부 섹션(BibRow, InfoRow 테이블 등)은 현재 `PatentDetail.tsx`의 내용을 그대로 가져온다.

```tsx
return (
  <div className="flex-1 flex flex-col bg-white overflow-hidden">

    {/* ── 상단 액션 바 (기존 유지) ── */}
    <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-2 shrink-0">
      <button onClick={onBack} className="btn-outline btn-sm">
        <Icon name="arrow-left" size={13} /> 검색결과로
      </button>
      {onPrev && <button onClick={onPrev} className="btn-outline btn-sm" title="이전">◀</button>}
      {posLabel && <span className="text-sm2 text-gray-500 font-mono">{posLabel}</span>}
      {onNext && <button onClick={onNext} className="btn-outline btn-sm" title="다음">▶</button>}
      <div className="ml-auto flex items-center gap-1.5">
        <button className="btn-primary btn-sm" onClick={() => alert('배경기술 참조 (mockup)')}>
          <Icon name="link" size={12} /> 배경기술 참조
        </button>
        <button className="btn-outline btn-sm" onClick={onSave}>
          <Icon name="star" size={11} /> 라이브러리 저장
        </button>
      </div>
    </div>

    {/* ── 키워드 하이라이터 바 (keywert 참고) ── */}
    {searchQuery && parseKeywords(searchQuery).length > 0 && (
      <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs2 font-semibold text-gray-400 shrink-0">키워드</span>
          {parseKeywords(searchQuery).map((kw, i) => {
            const c = KW_COLORS[i % KW_COLORS.length];
            return (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-sm2 font-medium"
                style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: c.dot }}
                />
                {kw}
                <span className="text-xs2 opacity-60 font-mono ml-0.5">0/0</span>
                <span className="flex gap-0.5 ml-0.5">
                  <button className="text-xs2 opacity-50 hover:opacity-100 leading-none">↑</button>
                  <button className="text-xs2 opacity-50 hover:opacity-100 leading-none">↓</button>
                </span>
              </span>
            );
          })}
          <button className="ml-auto text-xs2 text-gray-400 hover:text-gray-600 shrink-0">- 접기</button>
        </div>
      </div>
    )}

    {/* ── 탭 + 2-column 본문 ── */}
    <div className="flex-1 flex min-h-0 overflow-hidden">

      {/* 좌: 앵커 탭 + 스크롤 본문 */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Sticky 앵커 탭 바 */}
        <div className="sticky top-0 z-20 flex items-center gap-0 bg-white border-b border-gray-200 overflow-x-auto scroll-thin shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => scrollToSection(tab.ref, tab.key)}
              className={clsx(
                'px-3 py-2 text-sm2 font-medium whitespace-nowrap border-b-2 transition-colors shrink-0',
                activeTab === tab.key
                  ? 'border-blue-400 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 스크롤 본문 */}
        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-4">

          {/* 타이틀 */}
          <div className="mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`badge ${statusClass}`}>● {data.status}</span>
              <span className="badge badge-blue">{data.country}</span>
              <span className="font-mono text-md2 font-semibold text-gray-600">{data.number}</span>
              {data.grade && <span className="badge badge-blue">평가 {data.grade}</span>}
            </div>
            <h2 className="text-xl font-bold text-gray-800 leading-snug">{data.title}</h2>
          </div>

          {/* 서지사항 */}
          <div ref={secBib}>
            <Section title="서지사항" icon="cal">
              <table className="w-full text-md2">
                <tbody>
                  <BibRow k="문헌번호" v={data.number} mono k2="(문헌일)" v2={data.publicationDate || '—'} />
                  <BibRow k="출원번호" v={data.applicationNo} mono k2="(출원일)" v2={data.applicationDate || '—'} />
                  <BibRow k="공개/공고번호" v={data.publicationNo} mono k2="(공개/공고일)" v2={data.publicationDate || '—'} />
                  <BibRow k="등록번호" v={data.registerNo && data.registerNo !== '-' ? data.registerNo : '—'} mono k2="(등록일)" v2={data.registerDate && data.registerDate !== '-' ? data.registerDate : '—'} />
                </tbody>
              </table>
              <div className="mt-3.5">
                <div className="text-xs2 font-semibold text-gray-500 mb-2">타임라인</div>
                <Timeline items={timeline} />
              </div>
            </Section>
          </div>

          {/* 인명정보 */}
          <div ref={secPerson}>
            <Section title="인명정보" icon="user">
              <table className="w-full text-md2">
                <tbody>
                  <InfoRow k="출원인" v={data.applicant || '—'} />
                  <InfoRow k="출원인 주소" v={data.applicantAddress || '—'} muted={!data.applicantAddress} />
                  <InfoRow k={data.country === 'JP' ? '출원인식별기호 (JP)' : '특허고객번호 (KR)'} v={data.applicantCode || '—'} mono />
                  <InfoRow k="발명자" v={data.inventors || '—'} />
                  <InfoRow k="발명자 주소" v={data.inventorAddress || '(예시) 동일 — 출원인 주소'} muted />
                </tbody>
              </table>
            </Section>
          </div>

          {/* 요약 */}
          <div ref={secAbstract}>
            <Section title="요약" icon="doc">
              <TextBlock>{data.abstract || '—'}</TextBlock>
            </Section>
          </div>

          {/* 상세설명 */}
          <div ref={secDesc}>
            <Section title="상세설명" icon="book">
              <TextBlock>{data.description || '(데모) 상세설명 원문이 표시되는 영역입니다. 발명의 배경, 기술적 과제, 해결수단, 효과 등 본문 전체가 노출됩니다.'}</TextBlock>
            </Section>
          </div>

          {/* 청구범위 */}
          <div ref={secClaim}>
            <Section title="청구범위" icon="target">
              <div className="flex items-center gap-1 mb-2.5">
                <button
                  onClick={() => setClaimMode('independent')}
                  className={clsx('px-2.5 py-0.5 rounded text-sm2 font-medium border', claimMode === 'independent' ? 'bg-blue-400 text-white border-blue-400' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}
                >독립항</button>
                <button
                  onClick={() => setClaimMode('all')}
                  className={clsx('px-2.5 py-0.5 rounded text-sm2 font-medium border', claimMode === 'all' ? 'bg-blue-400 text-white border-blue-400' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}
                >전체청구항</button>
              </div>
              <div className="border border-blue-200 rounded-lg p-3.5 bg-white">
                <div className="text-md2 font-semibold text-blue-700 mb-1.5">독립항 — 제1항</div>
                <div className="text-base2 text-gray-700 leading-relaxed bg-blue-50 px-3 py-2 rounded border-l-4 border-blue-500">
                  {data.repClaim}
                </div>
                {claimMode === 'all' && (
                  <div className="mt-2.5 space-y-1.5">
                    <SubClaim n={2}>제2항에 있어서, … (예시)</SubClaim>
                    <SubClaim n={3}>제3항에 있어서, … (예시)</SubClaim>
                  </div>
                )}
              </div>
            </Section>
          </div>

          {/* 패밀리정보 — 국가 탭 필터 */}
          <div ref={secFamily}>
            <Section title="패밀리 정보" icon="grid">
              {(() => {
                const families = renderFamilyPills(data.family);
                const total = families.reduce((s, [, n]) => s + n, 0);
                const filtered = familyTab === 'all' ? families : families.filter(([cc]) => cc === familyTab);
                return (
                  <>
                    <div className="flex items-center gap-0 border-b border-gray-100 mb-3 overflow-x-auto scroll-thin">
                      {[['all', `전체(${total})`] as [string, string], ...families.map(([cc, n]) => [cc, `${cc}(${n})`] as [string, string])].map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setFamilyTab(key)}
                          className={clsx(
                            'px-3 py-1.5 text-sm2 font-medium whitespace-nowrap border-b-2 transition-colors shrink-0',
                            familyTab === key
                              ? 'border-blue-400 text-blue-700'
                              : 'border-transparent text-gray-500 hover:text-gray-700',
                          )}
                        >{label}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {filtered.map(([cc, n]) => (
                        <span key={cc} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-md2 text-blue-700">
                          <strong className="font-mono">{cc}</strong> <span>{n}건</span>
                        </span>
                      ))}
                    </div>
                  </>
                );
              })()}
            </Section>
          </div>

          {/* 인용·피인용 — 비특허 인용 별도 섹션 */}
          <div ref={secCite}>
            <Section title="인용·피인용" icon="link">
              <CiteBlock title={`인용 (${data.citing}건)`} patentCount={Math.max(1, (data.citing||0) - 2)} nplCount={2} />
              <div className="mt-3">
                <CiteBlock title={`피인용 (${data.cited}건)`} patentCount={Math.max(1, (data.cited||0) - 1)} nplCount={1} />
              </div>
              <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-1.5 text-sm2 font-semibold text-gray-600 border-b border-gray-200">비특허 인용</div>
                <table className="w-full text-sm2">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-2 py-1.5 text-left text-xs2 font-semibold text-gray-500">No</th>
                      <th className="px-2 py-1.5 text-left text-xs2 font-semibold text-gray-500">카테고리</th>
                      <th className="px-2 py-1.5 text-left text-xs2 font-semibold text-gray-500">단계</th>
                      <th className="px-2 py-1.5 text-left text-xs2 font-semibold text-gray-500">출처</th>
                      <th className="px-2 py-1.5 text-left text-xs2 font-semibold text-gray-500">내용</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-2 py-1.5 text-xs2 text-gray-400">1</td>
                      <td className="px-2 py-1.5 text-xs2 text-gray-600">선행</td>
                      <td className="px-2 py-1.5 text-xs2 text-gray-600">심사</td>
                      <td className="px-2 py-1.5 text-xs2 text-gray-600">조사자</td>
                      <td className="px-2 py-1.5 text-xs2 text-gray-600">(예시) 비특허 문헌 인용</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>
          </div>

          {/* 분류코드 */}
          <div ref={secClass}>
            <Section title="분류코드" icon="tag">
              <table className="w-full text-md2">
                <tbody>
                  <InfoRow k="Original IPC" v={data.ipc || '—'} mono />
                  <InfoRow k="Original CPC" v={data.cpc || '—'} mono />
                </tbody>
              </table>
            </Section>
          </div>

          {/* 기타정보 — 대리인 + 심판/소송 + 특허평가 통합 */}
          <div ref={secEtc}>
            <Section title="기타정보" icon="briefcase">
              <table className="w-full text-md2 mb-3">
                <tbody>
                  <InfoRow k="대리인" v={data.agent || '—'} muted={!data.agent} />
                  <InfoRow k="대리인 주소" v={data.agentAddress || '—'} muted={!data.agentAddress} />
                </tbody>
              </table>
              {((data.trial && data.trial !== '심판 없음') || (data.dispute && data.dispute !== '분쟁 없음')) && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="text-sm2 font-semibold text-gray-500 mb-2">심판/소송 정보</div>
                  {data.trial && data.trial !== '심판 없음' && <Row k="심판" v={data.trial} />}
                  {data.dispute && data.dispute !== '분쟁 없음' && <Row k="분쟁" v={data.dispute} />}
                </div>
              )}
              {data.grade && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="text-sm2 font-semibold text-gray-500 mb-2">특허평가</div>
                  <div className="flex items-center gap-2 text-md2">
                    <span className="text-gray-500 w-24">평가등급</span>
                    <span className="badge badge-blue">{data.grade}</span>
                  </div>
                </div>
              )}
            </Section>
          </div>

        </div>
      </div>

      {/* 우: 도면 패널 */}
      <div className="w-56 shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-200 bg-white shrink-0">
          <span className="text-sm2 font-bold text-gray-600">도면</span>
          <span className="ml-1.5 text-xs2 text-gray-400">({(data.figures || []).length})</span>
        </div>
        <DrawingsPanel figures={data.figures} />
      </div>

    </div>
  </div>
);
```

---

### 3-C: DrawingsPanel 컴포넌트 추가

- [ ] **Step 6: 파일 하단(기존 helper 함수들 다음)에 DrawingsPanel 추가**

```tsx
// ── 우측 도면 패널 (keywert 참고) ──
function DrawingsPanel({ figures }: { figures?: { label: string; desc: string }[] }) {
  const figs = figures || [];
  const [selected, setSelected] = useState(0);

  if (figs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-gray-300 px-4">
        <Icon name="image" size={28} className="mb-2" />
        <div className="text-sm2 text-center">도면 없음</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto scroll-thin p-3">
      {/* 메인 도면 */}
      <div className="card h-44 flex flex-col items-center justify-center mb-2 shrink-0 p-2">
        <Icon name="image" size={24} className="text-gray-300 mb-1" />
        <div className="text-xs2 font-semibold text-gray-500">{figs[selected]?.label}</div>
        <div className="text-xs2 text-gray-400 mt-0.5 px-2 text-center line-clamp-2">{figs[selected]?.desc}</div>
      </div>

      {/* 썸네일 그리드 (3열) */}
      <div className="grid grid-cols-3 gap-1">
        {figs.map((f, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={clsx(
              'bg-gray-100 rounded-md h-14 flex flex-col items-center justify-center p-1 transition-all',
              selected === i ? 'ring-2 ring-blue-400 bg-blue-50' : 'hover:bg-gray-200',
            )}
          >
            <Icon name="image" size={12} className={selected === i ? 'text-blue-400' : 'text-gray-400'} />
            <div className="text-xs2 text-gray-500 mt-0.5 font-mono truncate w-full text-center leading-tight">
              {f.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 빌드 확인 + 브라우저 확인**

```bash
cd react-app && npm run dev
```
Expected:
1. 상세 페이지 상단 — 검색 키워드 pill 바 (searchQuery 있을 때)
2. sticky 앵커 탭 바 스크롤 동작 확인
3. 탭 클릭 → 해당 섹션 smooth scroll + 탭 활성화
4. 우측 도면 패널 — `.card` 메인 도면 + 썸네일 그리드 (3열)
5. 썸네일 클릭 시 메인 도면 교체
6. "검색결과로" / ◀▶ 버튼 정상 동작
7. 기존 서지사항, 인명정보, 청구범위 등 내용 모두 표시

- [ ] **Step 8: Commit**

```bash
git add react-app/src/components/PatentDetail.tsx
git commit -m "feat: PatentDetail keywert-style — keyword bar, anchor tabs, drawings panel"
```

---

## Task 4: 전체 플로우 E2E 확인

- [ ] **Step 1: 개발 서버 실행**

```bash
cd react-app && npm run dev
```

- [ ] **Step 2: 플로우 순서대로 확인**

1. 사이드바 → `특허 검색` 작업 선택
2. PatentInput: 검색어 입력 (예: `TI:(배터리) AND CL:(전해질)`) → `검색` 클릭 → PatentResults 진입
3. PatentResults:
   - 상단 필터 바(기존 칩) 표시 확인
   - 테이블 컬럼 확인: 체크박스 | No | 상태 | 문헌번호 | 문헌일 | 출원일 ↕ | 발명의 명칭 ↕ | 출원인 | 만료일
   - 발명의 명칭 셀에 검색어 키워드 **노란 하이라이트** 표시 확인
   - 출원일 / 발명의 명칭 헤더 클릭 → 정렬 방향(↑/↓) 전환 확인
   - 체크박스 개별/전체 선택 확인
   - perPage 셀렉트 (20/50/100/200) 변경 확인
   - 행 클릭 → 우측 InlineDetail 표시
   - 슬라이딩/갤러리 뷰 토글 동작 확인
4. `발명의 명칭` 클릭 → PatentDetail 진입
5. PatentDetail:
   - 키워드 pill 바 표시 (검색어 기준)
   - sticky 탭 바 9개: 서지사항 | 인명정보 | 요약 | 상세설명 | 청구범위 | 패밀리정보 | 인용·피인용 | 분류코드 | 기타정보
   - 탭 클릭 → 해당 섹션으로 smooth scroll
   - 청구범위 탭: `독립항` / `전체청구항` 토글 클릭 확인
   - 패밀리정보 탭: 국가 탭 클릭 → 해당 국가만 필터 확인
   - 인용·피인용: 비특허 인용 테이블(카테고리/단계/출처) 표시 확인
   - 기타정보 탭: 대리인 + 심판/특허평가 정보 표시 확인
   - 우측 도면 썸네일 그리드 클릭 → 메인 도면 교체 확인
6. `검색결과로` → PatentResults 복귀
7. `검색조건 수정` → PatentInput 복귀

- [ ] **Step 3: 프로덕션 빌드 성공 확인**

```bash
cd react-app && npm run build
```
Expected: 빌드 성공, 타입 에러 없음
