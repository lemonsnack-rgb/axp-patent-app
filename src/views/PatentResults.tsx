// 특허 검색 결과 — sri-header + filter-bar(7그룹) + 모든 필터 드로어(Sheet 4) + 적용필터 칩 + 2-Column
import { useState, useRef } from 'react';
import clsx from 'clsx';
import { PATENT_SEED } from '../data/patentSeed';
import { PATENT_FACET_GROUPS_BASE, PATENT_FACET_GROUPS_EXT } from '../data/facetGroups';
import { Icon } from '../components/Icon';
import type { PatentResult } from '../types';

type SortKey = 'recent' | 'cited' | 'grade' | 'relevance';
type ViewMode = 'list' | 'sliding' | 'gallery';

interface AppliedFilter { facetKey: string; title: string; label: string }

function applyFacetFilters(items: PatentResult[], filters: AppliedFilter[]): PatentResult[] {
  if (!filters.length) return items;
  return items.filter(p =>
    filters.every(f => {
      if (f.label === '전체') return true;
      switch (f.facetKey) {
        case 'country':      return p.country === f.label;
        case 'right_status': return p.status === f.label;
        case 'app_year': {
          const yr = p.applicationDate?.slice(0, 4) ?? '';
          return f.label === '2020 이전' ? parseInt(yr) <= 2020 : yr === f.label;
        }
        case 'applicant_top': return p.applicant.includes(f.label);
        case 'ipc_top': {
          const prefix = f.label.split(' ')[0].replace('-', ' ');
          return p.ipc.startsWith(prefix);
        }
        case 'trial_dispute':
          return f.label === '있음'
            ? (p.dispute?.includes('있음') ?? false)
            : (p.dispute?.includes('없음') ?? false);
        default: return true;
      }
    })
  );
}

interface Props {
  onModify: () => void;
  onOpenDetail: (idx: number) => void;
  onSave: (idx: number) => void;
  searchQuery?: string;
}

export function PatentResults({ onModify, onOpenDetail, onSave, searchQuery }: Props) {
  const [sort, setSort] = useState<SortKey>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState<Record<string, boolean>>({});
  const [pendingFilters, setPendingFilters] = useState<Record<string, string[]>>({});
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilter[]>([]);
  const [extFilterValues, setExtFilterValues] = useState<Record<string, string>>({});
  const [selectedCard, setSelectedCard] = useState<number | null>(0);
  const [appliedFilterRowVisible, setAppliedFilterRowVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<20 | 50 | 100 | 200>(20);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [sortCol, setSortCol] = useState<'applicationDate' | 'title'>('applicationDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // 결과 데이터 — appliedFilters 기반 필터링
  const data = applyFacetFilters(PATENT_SEED, appliedFilters);
  const count = data.length;

  // 검색식 칩 (mockup)
  const appliedQuery = 'TI=(자율주행* OR autonomous driving) AND IPCM=G01S*';

  const togglePendingFilter = (groupKey: string, label: string) => {
    setPendingFilters(prev => {
      const cur = prev[groupKey] || [];
      return cur.includes(label)
        ? { ...prev, [groupKey]: cur.filter(x => x !== label) }
        : { ...prev, [groupKey]: [...cur, label] };
    });
  };

  const applyFilters = () => {
    const newApplied: AppliedFilter[] = [];
    // Base facet 그룹
    for (const g of PATENT_FACET_GROUPS_BASE) {
      for (const label of (pendingFilters[g.key] || [])) {
        newApplied.push({ facetKey: g.key, title: g.title, label });
      }
    }
    // Ext 필터 입력값
    for (const g of PATENT_FACET_GROUPS_EXT) {
      for (const item of g.items) {
        const val = extFilterValues[item.code || ''];
        if (val?.trim()) newApplied.push({ facetKey: g.key + ':' + item.code, title: item.label, label: val.trim() });
      }
    }
    setAppliedFilters(newApplied);
    setAppliedFilterRowVisible(newApplied.length > 0);
    setPage(1);
    setSelectedCard(null);
    setDrawerOpen(false);
  };

  const cancelFilters = () => {
    // pending → 현재 applied로 복원
    const restored: Record<string, string[]> = {};
    appliedFilters.forEach(f => {
      if (!f.facetKey.includes(':')) {
        restored[f.facetKey] = [...(restored[f.facetKey] || []), f.label];
      }
    });
    setPendingFilters(restored);
    setDrawerOpen(false);
  };

  const removeAppliedFilter = (f: AppliedFilter) => {
    const next = appliedFilters.filter(x => !(x.facetKey === f.facetKey && x.label === f.label));
    setAppliedFilters(next);
    setAppliedFilterRowVisible(next.length > 0);
    // pending도 동기화
    setPendingFilters(prev => {
      const cur = prev[f.facetKey] || [];
      return { ...prev, [f.facetKey]: cur.filter(x => x !== f.label) };
    });
  };

  const resetFilters = () => {
    setPendingFilters({});
    setAppliedFilters([]);
    setAppliedFilterRowVisible(false);
    setExtFilterValues({});
  };

  const pendingCount = Object.values(pendingFilters).flat().length + Object.values(extFilterValues).filter(v => v?.trim()).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── 1. sri-header ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white shrink-0 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="badge badge-gray font-bold text-md2">{count.toLocaleString()}건</span>
          {/* 적용된 검색식 칩 */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded text-sm2 text-blue-700 font-mono truncate max-w-xs">
            {appliedQuery}
          </span>
          <button onClick={onModify} className="btn-outline btn-xs shrink-0">
            <Icon name="edit" size={11} /> 검색조건 수정
          </button>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            className="input py-1 text-sm2 w-auto"
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
          >
            <option value="recent">최신순</option>
            <option value="cited">피인용 많은 순</option>
            <option value="grade">평가등급 높은 순</option>
            <option value="relevance">관련도 순</option>
          </select>
          <select
            value={perPage}
            onChange={e => { setPerPage(Number(e.target.value) as 20 | 50 | 100 | 200); setPage(1); }}
            className="input text-sm2 py-0.5 h-7 w-28"
          >
            <option value={20}>20개씩 보기</option>
            <option value={50}>50개씩 보기</option>
            <option value={100}>100개씩 보기</option>
            <option value={200}>200개씩 보기</option>
          </select>
          {/* 뷰 토글: 리스트 / 슬라이딩 / 갤러리 */}
          <div className="inline-flex border border-gray-300 rounded overflow-hidden">
            {([
              { key: 'list', title: '리스트' },
              { key: 'sliding', title: '슬라이딩 뷰' },
              { key: 'gallery', title: '갤러리(스크리닝)' },
            ] as const).map(v => (
              <button
                key={v.key}
                title={v.title}
                onClick={() => setViewMode(v.key)}
                className={clsx('px-2 py-1.5 flex items-center', viewMode === v.key ? 'bg-blue-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}
              >
                {v.key === 'list' && (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>
                  </svg>
                )}
                {v.key === 'sliding' && (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="11" width="18" height="6" rx="1"/>
                  </svg>
                )}
                {v.key === 'gallery' && (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. sri-filter-bar (7그룹 + 모든 필터) ── */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-100 bg-white shrink-0 flex-wrap">
        <span className="text-xs2 font-semibold text-gray-400 mr-1">필터</span>
        {PATENT_FACET_GROUPS_BASE.map(g => {
          const activeCount = (appliedFilters.filter(f => f.facetKey === g.key).length);
          return (
            <button
              key={g.key}
              onClick={() => setDrawerOpen(v => !v)}
              className={clsx(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-sm2 transition-all',
                activeCount > 0
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-700',
              )}
            >
              {g.title}
              {activeCount > 0 && <span className="bg-white/20 rounded-full px-1 text-xs2">{activeCount}</span>}
              <Icon name="chevron-down" size={11} />
            </button>
          );
        })}
        <button
          onClick={() => setDrawerOpen(v => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-sm2 text-gray-600 hover:border-blue-400 hover:text-blue-700"
        >
          <Icon name="hamburger" size={11} />
          모든 필터 {pendingCount > 0 && <span className="text-blue-700 font-bold">({pendingCount})</span>}
        </button>
        <button onClick={resetFilters} className="text-sm2 text-gray-400 hover:text-red-500 ml-1">필터 초기화</button>
      </div>

      {/* ── 3. 모든 필터 드로어 ── */}
      {drawerOpen && (
        <FilterDrawer
          pendingFilters={pendingFilters}
          extFilterValues={extFilterValues}
          onToggle={togglePendingFilter}
          onExtChange={(code, val) => setExtFilterValues(prev => ({ ...prev, [code]: val }))}
          expanded={drawerExpanded}
          onToggleExpand={(key) => setDrawerExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
          onApply={applyFilters}
          onCancel={cancelFilters}
          pendingCount={pendingCount}
        />
      )}

      {/* ── 4. 적용된 필터 칩 행 ── */}
      {appliedFilterRowVisible && appliedFilters.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-white border-b border-gray-100 flex-wrap shrink-0">
          <span className="text-sm2 font-semibold text-gray-500 mr-1">적용된 필터</span>
          {appliedFilters.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-full text-sm2 text-blue-700">
              {f.title}: {f.label}
              <button onClick={() => removeAppliedFilter(f)} className="hover:text-blue-900 ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}

      {/* ── 5. 결과 본문 ── */}
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
          perPage={perPage}
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
      )}
      {viewMode === 'sliding' && <SlidingView data={data} onOpenDetail={onOpenDetail} onSave={onSave} />}
      {viewMode === 'gallery' && <GalleryView data={data} onSave={onSave} />}
    </div>
  );
}

// ── 필터 드로어 (Sheet 4 9카테고리 + Base 7그룹 패싯) ──
function FilterDrawer({ pendingFilters, extFilterValues, onToggle, onExtChange, expanded, onToggleExpand, onApply, onCancel, pendingCount }: {
  pendingFilters: Record<string, string[]>;
  extFilterValues: Record<string, string>;
  onToggle: (groupKey: string, label: string) => void;
  onExtChange: (code: string, val: string) => void;
  expanded: Record<string, boolean>;
  onToggleExpand: (key: string) => void;
  onApply: () => void;
  onCancel: () => void;
  pendingCount: number;
}) {
  return (
    <div className="border-b border-gray-200 bg-gray-50 shrink-0 max-h-72 overflow-y-auto scroll-thin">
      <div className="p-3">
        {/* Base 7그룹 (패싯 스타일) */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {PATENT_FACET_GROUPS_BASE.map(g => (
            <div key={g.key} className="bg-white border border-gray-200 rounded-md p-2">
              <div
                className="flex items-center justify-between text-sm2 font-semibold text-gray-700 mb-1.5 cursor-pointer"
                onClick={() => onToggleExpand(g.key)}
              >
                <span>{g.title} {g.badge && <span className="text-xs2 text-gray-400">({g.badge})</span>}</span>
                <Icon name="chevron-down" size={10} className={clsx('transition-transform', expanded[g.key] && 'rotate-180')} />
              </div>
              <div className="space-y-0.5">
                {(expanded[g.key] ? g.items : g.items.slice(0, 5)).map((item, ii) => (
                  <label key={ii} className="flex items-center gap-1.5 text-sm2 text-gray-600 cursor-pointer hover:text-gray-800">
                    <input
                      type="checkbox"
                      className="form-checkbox text-blue-700 rounded w-3 h-3"
                      checked={(pendingFilters[g.key] || []).includes(item.label)}
                      onChange={() => onToggle(g.key, item.label)}
                    />
                    <span className="truncate">{item.label}</span>
                    {item.count != null && <span className="ml-auto text-xs2 text-gray-400">{item.count.toLocaleString()}</span>}
                  </label>
                ))}
                {!expanded[g.key] && g.items.length > 5 && (
                  <button onClick={() => onToggleExpand(g.key)} className="text-xs2 text-blue-600 hover:underline">
                    +{g.items.length - 5}개 더보기
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Ext 9카테고리 (전체 검색필터 — Sheet 4) */}
        <div className="border-t border-gray-200 pt-2.5">
          <div className="text-xs2 font-bold text-violet-700 mb-2">전체 검색필터 (Sheet 4 — 9카테고리)</div>
          <div className="grid grid-cols-2 gap-2">
            {PATENT_FACET_GROUPS_EXT.map(g => (
              <div key={g.key} className="bg-white border border-gray-200 rounded-md p-2">
                <div
                  className="flex items-center justify-between text-sm2 font-semibold text-gray-700 mb-1.5 cursor-pointer"
                  onClick={() => onToggleExpand('ext_' + g.key)}
                >
                  <span>{g.title}</span>
                  <Icon name="chevron-down" size={10} className={clsx('transition-transform', expanded['ext_' + g.key] && 'rotate-180')} />
                </div>
                {expanded['ext_' + g.key] && (
                  <div className="space-y-1">
                    {g.items.filter(it => it.isInput).map(item => (
                      <div key={item.code} className="flex items-center gap-1.5">
                        <span className="text-xs2 text-gray-500 w-28 shrink-0">{item.label}</span>
                        <input
                          type={item.kind === 'date-range' ? 'date' : 'text'}
                          className="flex-1 px-1.5 py-0.5 border border-gray-300 rounded text-xs2 outline-none focus:border-blue-500"
                          placeholder={item.kind === 'yesno' ? '있음/없음' : item.code}
                          value={extFilterValues[item.code || ''] || ''}
                          onChange={e => onExtChange(item.code || '', e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 드로어 푸터 */}
      <div className="sticky bottom-0 flex items-center justify-between px-4 py-2 bg-white border-t border-gray-200">
        <span className="text-sm2 text-gray-500">
          {pendingCount > 0 ? `${pendingCount}개 선택됨 — [적용] 클릭 시 결과에 반영됩니다` : '선택한 필터는 [적용] 클릭 시 결과에 반영됩니다'}
        </span>
        <div className="flex gap-1.5">
          <button className="btn-outline btn-xs" onClick={onCancel}>취소</button>
          <button className="btn-primary btn-sm text-sm2" onClick={onApply}>적용</button>
        </div>
      </div>
    </div>
  );
}

// ── 테이블 목록 뷰 (참고: 선행기술조사 결과 화면) ──
function TableResults({ data, selectedCard, onSelectCard, onOpenDetail, onSave, page, onPageChange, totalCount, perPage, searchQuery, checked, onToggleCheck, onToggleAll, sortCol, sortDir, onSort }: {
  data: PatentResult[];
  selectedCard: number | null;
  onSelectCard: (i: number) => void;
  onOpenDetail: (i: number) => void;
  onSave: (i: number) => void;
  page: number;
  onPageChange: (p: number) => void;
  totalCount: number;
  perPage: number;
  searchQuery?: string;
  checked: Set<number>;
  onToggleCheck: (i: number) => void;
  onToggleAll: (all: boolean) => void;
  sortCol: 'applicationDate' | 'title';
  sortDir: 'asc' | 'desc';
  onSort: (col: 'applicationDate' | 'title') => void;
}) {
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
                    <td className="px-2 py-2 text-center border-r border-gray-100" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="form-checkbox text-blue-700 rounded w-3 h-3"
                        checked={checked.has(i)}
                        onChange={() => onToggleCheck(i)}
                      />
                    </td>
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
                        {highlightText(d.title, searchQuery)}
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

function InlineDetail({ d, onOpenDetail, onSave }: { d: PatentResult; onOpenDetail: () => void; onSave: () => void }) {
  if (!d) return null;
  const statusClass = d.status === '등록' ? 'badge-green' : d.status === '심사중' ? 'badge-amber' : 'badge-gray';
  return (
    <div className="space-y-3">
      <div className="font-bold text-base2 text-gray-800 leading-snug">{d.title}</div>
      <div className="flex gap-1.5 flex-wrap">
        <span className={`badge ${statusClass}`}>{d.status}</span>
        <span className="badge badge-blue">{d.country}</span>
        {d.grade && <span className="badge badge-blue">평가 {d.grade}</span>}
      </div>
      <div className="space-y-1 text-sm2">
        <div><strong>출원인:</strong> {d.applicant}</div>
        {d.inventors && <div><strong>발명자:</strong> {d.inventors}</div>}
        <div><strong>출원번호:</strong> <span className="font-mono">{d.applicationNo}</span> ({d.applicationDate})</div>
        {d.publicationNo && <div><strong>공개번호:</strong> <span className="font-mono">{d.publicationNo}</span></div>}
        {d.registerNo && d.registerNo !== '-' && <div><strong>등록번호:</strong> <span className="font-mono">{d.registerNo}</span></div>}
        <div><strong>IPC:</strong> <span className="font-mono">{d.ipc}</span></div>
      </div>
      <div>
        <div className="text-xs2 font-bold text-gray-500 mb-1">요약</div>
        <div className="text-sm2 text-gray-700 leading-relaxed">{d.abstract}</div>
      </div>
      {d.repClaim && (
        <div>
          <div className="text-xs2 font-bold text-gray-500 mb-1">대표 청구항</div>
          <div className="text-sm2 bg-blue-50 px-3 py-2 rounded border-l-4 border-blue-500 text-gray-700 leading-relaxed">{d.repClaim.slice(0, 200)}…</div>
        </div>
      )}
      {d.aiPurpose && (
        <div className="bg-violet-50 border border-violet-200 rounded p-2.5 text-sm2">
          <div className="font-bold text-violet-700 mb-1">🧠 AI 요약</div>
          <div className="text-gray-700">{d.aiPurpose}</div>
        </div>
      )}
      <div className="flex gap-2 pt-1 border-t border-gray-100">
        <button onClick={onOpenDetail} className="btn-outline btn-xs flex-1">전체 보기 ↗</button>
        <button onClick={onSave} className="btn-outline btn-xs"><Icon name="star" size={11} /> 저장</button>
      </div>
    </div>
  );
}

// ── 슬라이딩 뷰 (미니목록 + 연속 스크롤 본문) ──
function SlidingView({ data, onOpenDetail, onSave }: { data: PatentResult[]; onOpenDetail: (i: number) => void; onSave: (i: number) => void }) {
  const [current, setCurrent] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const jumpTo = (i: number) => {
    setCurrent(i);
    const el = bodyRef.current?.querySelector(`[data-sliding-idx="${i}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* 미니목록 */}
      <div className="w-56 shrink-0 border-r border-gray-200 overflow-y-auto scroll-thin bg-white">
        {data.map((d, i) => (
          <button
            key={i}
            onClick={() => jumpTo(i)}
            className={clsx('w-full text-left px-3 py-2 border-b border-gray-100 text-sm2 hover:bg-gray-50',
              current === i && 'bg-blue-50 border-l-2 border-l-blue-700')}
          >
            <div className="font-mono text-blue-700 text-xs2">{d.number}</div>
            <div className="text-gray-700 text-xs2 truncate mt-0.5">{d.title}</div>
          </button>
        ))}
      </div>
      {/* 연속 스크롤 본문 */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto scroll-thin p-4 bg-gray-50 space-y-4">
        {data.map((d, i) => (
          <div
            key={i}
            data-sliding-idx={i}
            className="card p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-md2 text-blue-700">{d.number}</span>
              <span className={clsx('badge text-xs2', d.status === '등록' ? 'badge-green' : 'badge-amber')}>{d.status}</span>
              {d.grade && <span className="badge badge-blue text-xs2">평가 {d.grade}</span>}
              <div className="ml-auto flex gap-1.5">
                <button onClick={() => onOpenDetail(i)} className="btn-outline btn-xs">전체 보기</button>
                <button onClick={() => onSave(i)} className="btn-outline btn-xs"><Icon name="star" size={11} /> 저장</button>
                <button className="btn-primary btn-xs">→ 배경기술</button>
              </div>
            </div>
            <h3 className="text-base2 font-bold text-gray-800 mb-2 cursor-pointer hover:text-blue-700" onClick={() => onOpenDetail(i)}>{d.title}</h3>
            <div className="text-sm2 text-gray-500 mb-2">{d.applicant} · 출원일 {d.applicationDate} · IPC: <span className="font-mono">{d.ipc}</span></div>
            <div className="text-md2 text-gray-700 leading-relaxed">{d.abstract}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 키워드 하이라이트 ──
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

// ── 갤러리 뷰 (도면 테이블) ──
function GalleryView({ data, onSave }: { data: PatentResult[]; onSave: (i: number) => void }) {
  return (
    <div className="flex-1 overflow-y-auto scroll-thin p-4 bg-gray-50">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {data.map((d, i) => (
          <div key={i} className="card p-3">
            <div className="bg-gray-100 rounded h-40 flex items-center justify-center text-gray-400 mb-2">
              <div className="text-center">
                <Icon name="image" size={32} className="mx-auto mb-1" />
                <div className="text-xs2">{d.figures?.[0]?.label || 'FIG 1'}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-mono text-sm2 text-blue-700">{d.number}</span>
              <span className={clsx('badge text-xs2', d.status === '등록' ? 'badge-green' : 'badge-amber')}>{d.status}</span>
            </div>
            <div className="text-md2 font-semibold text-gray-800 line-clamp-2 mb-1">{d.title}</div>
            <div className="text-sm2 text-gray-500 truncate">{d.applicant}</div>
            <div className="flex gap-1.5 mt-2 pt-2 border-t border-gray-100">
              <button className="btn-primary btn-xs flex-1">→ 배경기술</button>
              <button onClick={() => onSave(i)} className="btn-outline btn-xs"><Icon name="star" size={11} /></button>
              <button className="btn-outline btn-xs text-red-500">👎</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
