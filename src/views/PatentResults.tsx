// 특허 검색 결과 — sri-header + filter-bar(7그룹) + 모든 필터 드로어(Sheet 4) + 적용필터 칩 + 2-Column
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { PATENT_SEED } from '../data/patentSeed';
import { PATENT_FACET_GROUPS_BASE, PATENT_FACET_GROUPS_EXT, type FacetGroup } from '../data/facetGroups';
import { PatentDetail, parseKeywords, KW_COLORS } from '../components/PatentDetail';
import { Icon } from '../components/Icon';
import { toast, Button } from '@muhayu/axp-ui';
import { getPatentStatusBadgeColor } from '../utils/badgeUtils';
import { Badge } from '../components/ui';
import type { PatentResult } from '../types';
import type { MetaFilter } from '../features/search';

type SortKey = 'match' | 'recent' | 'old';
type ViewMode = 'list' | 'sliding';

interface AppliedFilter { facetKey: string; title: string; label: string }

// 메타필터(국가·문헌종류·상태·기간)를 결과에 적용 [검색-41].
function applyMetaFilter(items: PatentResult[], meta?: MetaFilter | null): PatentResult[] {
  if (!meta) return items;
  return items.filter(p => {
    // 국가: 선택된 국가가 있으면 그 중 하나여야 함
    if (meta.countries.length > 0 && !meta.countries.includes(p.country)) return false;
    // 상태: 전체가 아니면 active/inactive 선택값에 포함되어야 함
    if (!meta.statusAll) {
      const picked = [...meta.statusActive, ...meta.statusInactive];
      if (picked.length > 0 && !picked.includes(p.status)) return false;
    }
    // 기간(custom from~to, YYYYMMDD): 출원일 기준
    const yyyymmdd = (p.applicationDate || '').replace(/\D/g, '');
    if (meta.periodFrom && yyyymmdd && yyyymmdd < meta.periodFrom.replace(/\D/g, '')) return false;
    if (meta.periodTo && yyyymmdd && yyyymmdd > meta.periodTo.replace(/\D/g, '')) return false;
    return true;
  });
}

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
  meta?: MetaFilter | null;
  onRefine?: (term: string) => void;   // 결과 내 검색
  onCrossSearch?: (keywords: string) => void;   // 검색식 이월 → 논문 [검색-212]
}

export function PatentResults({ onModify, onOpenDetail, onSave, searchQuery, meta, onRefine, onCrossSearch }: Props) {
  const [refineTerm, setRefineTerm] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openFacet, setOpenFacet] = useState<string | null>(null); // 칩별 스코프 팝오버
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

  // [검색-121·155] 새 검색(searchQuery 변경) 시 패싯 해제 + 첫 페이지
  useEffect(() => {
    setPendingFilters({});
    setAppliedFilters([]);
    setAppliedFilterRowVisible(false);
    setExtFilterValues({});
    setPage(1);
    setSelectedCard(0);
  }, [searchQuery]);

  // 결과 데이터 — 검색어 키워드 매칭 ∩ 메타필터 ∩ 패싯 → 정렬 [검색-90·100·154]
  const queryKeywords = parseKeywords(searchQuery || '');
  const queryScoped = queryKeywords.length === 0
    ? PATENT_SEED
    : PATENT_SEED.filter(p => {
        const hay = `${p.title} ${p.abstract ?? ''} ${p.applicant} ${p.ipc} ${p.repClaim ?? ''} ${p.inventors ?? ''}`.toLowerCase();
        return queryKeywords.every(k => hay.includes(k.toLowerCase()));
      });
  const metaScoped = applyMetaFilter(queryScoped, meta);
  const filtered = applyFacetFilters(metaScoped, appliedFilters);
  // 매칭순은 검색 매칭 순서를 유지하고, 그 외에는 컬럼/방향으로 정렬
  const data = sort === 'match'
    ? filtered
    : [...filtered].sort((a, b) => {
        const va = (a[sortCol] ?? '');
        const vb = (b[sortCol] ?? '');
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
  const count = data.length;

  // 적용된 실제 실행 검색식 칩
  const appliedQuery = searchQuery && searchQuery.trim() ? searchQuery : '전체 검색';

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
    setOpenFacet(null);
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
    setOpenFacet(null);
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
    <div className="flex flex-col">
      {/* ── 1. sri-header ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white shrink-0 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge color="neutral" className="font-bold text-md2">{count.toLocaleString()}건</Badge>
          {/* 적용된 검색식 칩 */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded text-sm2 text-brand-400 font-mono truncate max-w-xs">
            {appliedQuery}
          </span>
          <Button variant="outlined" color="primary" size="xs" className="shrink-0" onClick={onModify}>
            <Icon name="edit" size={11} /> 검색조건 수정
          </Button>
          {onRefine && (
            <input
              value={refineTerm}
              onChange={e => setRefineTerm(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && refineTerm.trim()) { onRefine(refineTerm.trim()); setRefineTerm(''); }
              }}
              placeholder="결과 내 검색 + (Enter)"
              title="현재 검색식에 AND로 추가해 결과를 좁힙니다"
              className="shrink-0 w-44 px-2 py-1 border border-gray-200 rounded text-sm2 outline-none focus:border-blue-400"
            />
          )}
          {onCrossSearch && searchQuery && (
            <Button variant="text" color="primary" size="xs" className="shrink-0 text-amber-600"
              title="이 검색 키워드로 논문 검색 (검색식 이월)"
              onClick={() => onCrossSearch(parseKeywords(searchQuery).join(' '))}>
              → 논문으로
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            className="input py-1 text-sm2 w-auto"
            value={sort}
            onChange={e => {
              const v = e.target.value as SortKey;
              setSort(v);
              setPage(1);
              if (v === 'match') return;            // 매칭순: 검색 매칭 순서 유지
              setSortCol('applicationDate');
              setSortDir(v === 'old' ? 'asc' : 'desc');
            }}
          >
            <option value="match">매칭순</option>
            <option value="recent">최신순</option>
            <option value="old">오래된순</option>
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
          {/* 뷰 토글: 리스트 / 슬라이딩 */}
          <div className="inline-flex border border-gray-300 rounded overflow-hidden">
            {([
              { key: 'list', title: '리스트', disabled: false },
              { key: 'sliding', title: '슬라이딩 뷰', disabled: false },
            ] as const).map(v => (
              <button
                key={v.key}
                title={v.disabled ? '준비 중' : v.title}
                disabled={v.disabled}
                onClick={() => !v.disabled && setViewMode(v.key)}
                className={clsx('px-2 py-1.5 flex items-center', v.disabled ? 'bg-white text-gray-300 cursor-not-allowed' : viewMode === v.key ? 'bg-brand-400 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}
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
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. sri-filter-bar (칩별 스코프 팝오버 + 모든 필터) ── */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-100 bg-white shrink-0 flex-wrap relative z-20">
        <span className="text-xs2 font-semibold text-gray-400 mr-1">필터</span>
        {PATENT_FACET_GROUPS_BASE.map(g => {
          const activeCount = (appliedFilters.filter(f => f.facetKey === g.key).length);
          const isOpen = openFacet === g.key;
          return (
            <div key={g.key} className="relative">
              <button
                onClick={() => { setOpenFacet(isOpen ? null : g.key); setDrawerOpen(false); }}
                className={clsx(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-sm2 transition-all',
                  activeCount > 0
                    ? 'bg-brand-400 text-white border-brand-400'
                    : isOpen
                      ? 'bg-blue-50 text-brand-400 border-blue-400'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-brand-400',
                )}
              >
                {g.title}
                {activeCount > 0 && <span className="bg-white/20 rounded-full px-1 text-xs2">{activeCount}</span>}
                <Icon name="chevron-down" size={11} className={clsx('transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <FacetPopover
                  group={g}
                  selected={pendingFilters[g.key] || []}
                  onToggle={(label) => togglePendingFilter(g.key, label)}
                  onApply={applyFilters}
                  onClose={() => setOpenFacet(null)}
                />
              )}
            </div>
          );
        })}
        <button
          onClick={() => { setDrawerOpen(v => !v); setOpenFacet(null); }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-300 rounded-md text-sm2 text-gray-600 hover:border-blue-400 hover:text-brand-400"
        >
          <Icon name="hamburger" size={11} />
          모든 필터 {pendingCount > 0 && <span className="text-brand-400 font-bold">({pendingCount})</span>}
        </button>
        <button onClick={resetFilters} className="text-sm2 text-gray-400 hover:text-red-500 ml-1">필터 초기화</button>
      </div>

      {/* 팝오버 바깥 클릭 닫기 백드롭 */}
      {openFacet && <div className="fixed inset-0 z-10" onClick={() => setOpenFacet(null)} />}

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
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-full text-sm2 text-brand-400">
              {f.title}: {f.label}
              <button onClick={() => removeAppliedFilter(f)} className="hover:text-blue-900 ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}

      {/* ── 5. 결과 본문 ── */}
      {count === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 text-gray-400">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mb-3 text-gray-300">
            <circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" />
          </svg>
          <div className="text-base2 font-semibold text-gray-600 mb-1">결과 없음</div>
          <div className="text-sm2 text-gray-400">
            현재 검색식·필터 조건에 해당하는 문헌이 없습니다.<br />
            검색식을 수정하거나 적용된 필터를 해제해 보세요.
          </div>
          {appliedFilters.length > 0 && (
            <Button variant="outlined" color="primary" size="sm" className="mt-3" onClick={resetFilters}>필터 초기화</Button>
          )}
        </div>
      ) : viewMode === 'list' ? (
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
          onToggleAll={(all) => {
            const start = (page - 1) * perPage;
            const pageIndices = data.slice(start, start + perPage).map((_, i) => start + i);
            setChecked(prev => {
              const next = new Set(prev);
              if (all) pageIndices.forEach(idx => next.add(idx));
              else pageIndices.forEach(idx => next.delete(idx));
              return next;
            });
          }}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={(col) => {
            setPage(1);
            if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
            else { setSortCol(col); setSortDir('desc'); }
          }}
        />
      ) : (
        <SlidingView data={data} onOpenDetail={onOpenDetail} onSave={onSave} />
      )}
    </div>
  );
}

// ── 패싯 칩 스코프 팝오버 (해당 패싯 값+건수만) ──
function FacetPopover({ group, selected, onToggle, onApply, onClose }: {
  group: FacetGroup;
  selected: string[];
  onToggle: (label: string) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const items = group.items.filter(it => it.label !== '전체');
  const searchable = items.length > 8;
  const shown = q.trim()
    ? items.filter(it => it.label.toLowerCase().includes(q.trim().toLowerCase()))
    : items;
  return (
    <div className="absolute z-30 top-full mt-1 left-0 w-64 bg-white border border-gray-200 rounded-lg shadow-card-deep p-2">
      <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b border-gray-100">
        <span className="text-sm2 font-semibold text-gray-700">{group.title}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xs2 leading-none">✕</button>
      </div>
      {searchable && (
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={`${group.title} 검색`}
          className="w-full mb-1.5 px-2 py-1 border border-gray-200 rounded text-xs2 outline-none focus:border-blue-400"
        />
      )}
      <div className="max-h-56 overflow-y-auto scroll-thin space-y-0.5">
        {shown.length === 0 && <div className="text-xs2 text-gray-400 px-1 py-2 text-center">일치 항목 없음</div>}
        {shown.map((it, i) => (
          <label key={i} className="flex items-center gap-1.5 px-1 py-1 rounded text-sm2 text-gray-600 cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              className="form-checkbox text-brand-400 rounded w-3 h-3"
              checked={selected.includes(it.label)}
              onChange={() => onToggle(it.label)}
            />
            <span className="truncate flex-1">{it.label}</span>
            {it.count != null && <span className="text-xs2 text-gray-400">{it.count.toLocaleString()}</span>}
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-1.5 pt-1.5 mt-1 border-t border-gray-100">
        <Button variant="outlined" color="primary" size="xs" onClick={onClose}>취소</Button>
        <Button variant="filled" color="primary" size="sm" className="text-sm2" onClick={onApply}>적용</Button>
      </div>
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
                      className="form-checkbox text-brand-400 rounded w-3 h-3"
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
          <Button variant="outlined" color="primary" size="xs" onClick={onCancel}>취소</Button>
          <Button variant="filled" color="primary" size="sm" className="text-sm2" onClick={onApply}>적용</Button>
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
  const startIdx = (page - 1) * perPage;
  const pageData = data.slice(startIdx, startIdx + perPage);

  return (
    <div className="flex items-start">
      {/* 결과 테이블 영역 */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200">
        {/* 테이블 상단 바 */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm2 font-semibold text-gray-700">
              총 <span className="text-brand-400">{totalCount.toLocaleString()}</span>건
            </span>
            <Pagination current={page} total={totalPages} onChange={onPageChange} />
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outlined" color="primary" size="xs"
              disabled={checked.size === 0}
              title={checked.size === 0 ? '항목을 선택하세요' : `${checked.size}건 CSV 다운로드`}
              onClick={() => {
                const rows = Array.from(checked).map(i => data[i]).filter(Boolean);
                const header = '문헌번호,발명의명칭,출원인,출원일,상태,IPC';
                const csv = [header, ...rows.map(d => [d.number, `"${d.title}"`, d.applicant, d.applicationDate, d.status, d.ipc].join(','))].join('\n');
                const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'patents.csv';
                a.click();
                URL.revokeObjectURL(a.href);
                toast(`${rows.length}건 CSV 다운로드`);
              }}
            >CSV 다운</Button>
            <Button variant="outlined" color="primary" size="xs" title="컬럼 설정 (준비 중)" disabled>컬럼</Button>
          </div>
        </div>

        {/* 테이블 (페이지 전체 스크롤 — 내부 스크롤 박스 없음 [검색-92]) */}
        <div className="bg-white">
          <table className="w-full text-sm2 border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8 px-2 py-2 text-center border-r border-gray-100">
                  <input
                    type="checkbox"
                    className="form-checkbox text-brand-400 rounded w-3 h-3"
                    checked={pageData.length > 0 && pageData.every((_, i) => checked.has(startIdx + i))}
                    onChange={e => onToggleAll(e.target.checked)}
                  />
                </th>
                <th className="w-10 px-3 py-2 text-center font-semibold text-gray-500 border-r border-gray-100">No</th>
                <th className="w-14 px-2 py-2 text-center font-semibold text-gray-500 border-r border-gray-100">상태</th>
                <th className="w-40 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">문헌번호</th>
                <th className="w-24 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">문헌일</th>
                <th
                  className="w-24 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100 cursor-pointer select-none hover:text-brand-400"
                  onClick={() => onSort('applicationDate')}
                >
                  출원일 {sortCol === 'applicationDate' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                </th>
                <th
                  className="px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100 cursor-pointer select-none hover:text-brand-400"
                  onClick={() => onSort('title')}
                >
                  발명의 명칭 {sortCol === 'title' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                </th>
                <th className="w-32 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100">출원인</th>
                <th className="w-28 px-2 py-2 text-left font-semibold text-gray-500">만료일</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((d, i) => {
                const absIdx = startIdx + i;
                const rowNo = absIdx + 1;
                const isSelected = selectedCard === absIdx;
                const statusColor = getPatentStatusBadgeColor(d.status);
                return (
                  <tr
                    key={absIdx}
                    onClick={() => onSelectCard(absIdx)}
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
                        className="form-checkbox text-brand-400 rounded w-3 h-3"
                        checked={checked.has(absIdx)}
                        onChange={() => onToggleCheck(absIdx)}
                      />
                    </td>
                    <td className="px-3 py-2 text-center text-xs2 text-gray-400">{rowNo}</td>
                    <td className="px-2 py-2 text-center">
                      <Badge color={statusColor} className="text-xs2">{d.status}</Badge>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-mono text-xs2 text-brand-400 leading-snug">{d.number}</div>
                    </td>
                    <td className="px-2 py-2 text-xs2 text-gray-600 font-mono">{d.publicationDate || '—'}</td>
                    <td className="px-2 py-2 text-xs2 text-gray-600 font-mono">{d.applicationDate}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={e => { e.stopPropagation(); onOpenDetail(absIdx); }}
                        className="text-left text-sm2 text-gray-800 hover:text-brand-400 line-clamp-2 leading-snug font-medium w-full"
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
                          onClick={e => { e.stopPropagation(); onSave(absIdx); }}
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

      {/* 우측 사이드 리더 (분할) — 풀 상세. sticky로 목록 스크롤 중에도 고정 */}
      <div className={clsx('flex flex-col transition-all border-l border-gray-200 sticky top-0 self-start', selectedCard !== null ? 'w-[460px] min-w-[460px] h-[calc(100vh-52px)] overflow-hidden' : 'w-0 min-w-0')}>
        {selectedCard !== null && data[selectedCard] && (
          <>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
              <Button variant="outlined" color="primary" size="xs" className="px-1.5 disabled:opacity-30" disabled={selectedCard <= 0} onClick={() => onSelectCard(selectedCard - 1)} title="이전">◀</Button>
              <Button variant="outlined" color="primary" size="xs" className="px-1.5 disabled:opacity-30" disabled={selectedCard >= data.length - 1} onClick={() => onSelectCard(selectedCard + 1)} title="다음">▶</Button>
              <span className="text-xs2 text-gray-400 font-mono">{selectedCard + 1} / {data.length}</span>
              <span className="font-mono text-sm2 text-brand-400 truncate ml-1">{data[selectedCard]?.number}</span>
              <span className="flex-1" />
              <Button variant="outlined" color="primary" size="xs" onClick={() => onOpenDetail(selectedCard)} title="새 탭에서 전체 보기">전체 보기 ↗</Button>
              <button onClick={() => onSelectCard(-1)} className="text-gray-400 hover:text-gray-700 p-1 shrink-0" title="닫기"><Icon name="close" size={14} /></button>
            </div>
            <PatentDetail
              embedded
              data={data[selectedCard]}
              searchQuery={searchQuery}
              onBack={() => onSelectCard(-1)}
              onSave={() => onSave(selectedCard)}
            />
          </>
        )}
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
            <div className="font-mono text-brand-400 text-xs2">{d.number}</div>
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
            className="bg-white rounded-xl border border-neutral-150 shadow-card p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-md2 text-brand-400">{d.number}</span>
              <Badge color={getPatentStatusBadgeColor(d.status)} className="text-xs2">{d.status}</Badge>
              {d.grade && <Badge color="brand" className="text-xs2">평가 {d.grade}</Badge>}
              <div className="ml-auto flex gap-1.5">
                <Button variant="outlined" color="primary" size="xs" onClick={() => onOpenDetail(i)}>전체 보기</Button>
                <Button variant="outlined" color="primary" size="xs" onClick={() => onSave(i)}><Icon name="star" size={11} /> 저장</Button>
              </div>
            </div>
            <h3 className="text-base2 font-bold text-gray-800 mb-2 cursor-pointer hover:text-brand-400" onClick={() => onOpenDetail(i)}>{d.title}</h3>
            <div className="text-sm2 text-gray-500 mb-2">{d.applicant} · 출원일 {d.applicationDate} · IPC: <span className="font-mono">{d.ipc}</span></div>
            <div className="text-md2 text-gray-700 leading-relaxed">{d.abstract}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 키워드 하이라이트 ──
// 검색식에서 키워드만 추출해(연산자·필드코드·괄호 제거) 키워드별 고유 색으로 하이라이트 (키워트식 다색)
function highlightText(text: string, query?: string): React.ReactNode {
  const kws = parseKeywords(query || '');
  if (!kws.length) return text;
  const escaped = kws.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((p, i) => {
        const idx = kws.findIndex(k => k.toLowerCase() === p.toLowerCase());
        if (idx < 0) return p;
        const c = KW_COLORS[idx % KW_COLORS.length];
        return <mark key={i} className="rounded px-0.5" style={{ backgroundColor: c.bg, color: c.text }}>{p}</mark>;
      })}
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
