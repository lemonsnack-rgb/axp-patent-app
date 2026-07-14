// 특허 검색 결과 — 논문 검색과 동일 구성: 고정 툴바 + 필터 + 체크박스 일괄저장 + 테이블 + 우측 오버레이 드로어
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { PATENT_SEED } from '../data/patentSeed';
import { PATENT_FACET_GROUPS_BASE, IPC_FACET_ITEMS, type FacetGroup, type FacetItem } from '../data/facetGroups';
import { PatentDetail, parseKeywords, KW_COLORS } from '../components/PatentDetail';
import { Icon } from '../components/Icon';
import { toast, Button } from '@muhayu/axp-ui';
import { getPatentStatusDesc } from '../utils/badgeUtils';
import { downloadPatentPdf } from '../features/patentPdf';
import { Badge } from '../components/ui';
import type { PatentResult } from '../types';
import type { MetaFilter } from '../features/search';

// 정렬은 날짜 필드만 제공 — 출원일 외 공개일·등록일도 선택 가능
type DateField = 'applicationDate' | 'publicationDate' | 'registerDate';
const DATE_FIELDS: { key: DateField; label: string }[] = [
  { key: 'applicationDate', label: '출원일' },
  { key: 'publicationDate', label: '공개일' },
  { key: 'registerDate', label: '등록일' },
];

interface AppliedFilter { facetKey: string; title: string; label: string; mode?: 'main' | 'all' }

// 중복제거 모드 — 검색은 문헌번호 기준. 동일 출원번호(1건의 출원)가 공개+등록 문헌으로 함께 잡힐 수 있어
// 출원번호로 묶어 한 건만 남긴다. reg=등록 우선 / pub=공개 우선 / none=사용안함.
type DedupMode = 'none' | 'reg' | 'pub';

// 등록계 문헌 여부(등록특허공보). 등록·소멸은 등록문헌, 그 외는 공개문헌.
const isRegisteredDoc = (p: PatentResult) => p.status === '등록' || p.status === '소멸';

function applyDedup(items: PatentResult[], mode: DedupMode): PatentResult[] {
  if (mode === 'none') return items;
  const winner = new Map<string, PatentResult>();
  for (const p of items) {
    const key = p.applicationNo || p.number;
    const cur = winner.get(key);
    if (!cur) { winner.set(key, p); continue; }
    const pReg = isRegisteredDoc(p), curReg = isRegisteredDoc(cur);
    if (mode === 'reg' && pReg && !curReg) winner.set(key, p);
    else if (mode === 'pub' && !pReg && curReg) winner.set(key, p);
  }
  return items.filter(p => winner.get(p.applicationNo || p.number) === p);
}

// 메타필터(국가·문헌종류·상태·기간)를 결과에 적용 [검색-41].
function applyMetaFilter(items: PatentResult[], meta?: MetaFilter | null): PatentResult[] {
  if (!meta) return items;
  return items.filter(p => {
    if (meta.countries.length > 0 && !meta.countries.includes(p.country)) return false;
    if (!meta.statusAll) {
      const picked = [...meta.statusActive, ...meta.statusInactive];
      if (picked.length > 0 && !picked.includes(p.status)) return false;
    }
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
        case 'doc_kind':
          return f.label === '등록특허' ? isRegisteredDoc(p) : !isRegisteredDoc(p);
        case 'ipc_top': {
          const sub = f.label.split(' ')[0];   // 라벨 선두 토큰 = IPC 서브클래스(예: 'H04L')
          // Main=최신 대표 IPC(p.ipc)만 / All=개정이력·부가 포함 전체 IPC(p.ipcList 중 하나라도)
          const codes = f.mode === 'main'
            ? [p.ipc]
            : (p.ipcList && p.ipcList.length ? p.ipcList : [p.ipc]);
          return codes.some(c => (c || '').startsWith(sub));
        }
        case 'trial':
          return f.label === '있음'
            ? !(p.trial?.includes('없음') ?? true)
            : (p.trial?.includes('없음') ?? true);
        default: return true;
      }
    })
  );
}

interface Props {
  onModify: () => void;
  onOpenDetail: (patentNumber: string) => void;   // 새 탭으로 전체 보기
  onSave: (idx: number) => void;
  onSaveMany?: (patents: PatentResult[]) => void;   // 체크박스 일괄 저장
  searchQuery?: string;
  meta?: MetaFilter | null;
  onRefine?: (term: string) => void;   // 결과 내 검색
  onCrossSearch?: (keywords: string) => void;   // 검색식 이월 → 논문 [검색-212]
}

export function PatentResults({ onOpenDetail, onSave, onSaveMany, searchQuery, meta, onCrossSearch }: Props) {
  const [sortField, setSortField] = useState<DateField>('applicationDate');
  const [openFacet, setOpenFacet] = useState<string | null>(null);
  const [ipcMode, setIpcMode] = useState<'main' | 'all'>('all');   // IPC 패싯 Main/All 토글(기본 All)
  const [dedup, setDedup] = useState<DedupMode>('none');            // 중복제거(사용안함/등록 우선/공개 우선)
  const [pendingFilters, setPendingFilters] = useState<Record<string, string[]>>({});
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilter[]>([]);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);  // 기본: 목록만 노출
  const [appliedFilterRowVisible, setAppliedFilterRowVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<20 | 50 | 100 | 200>(20);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // 새 검색 시 패싯 해제 + 첫 페이지 + 선택/체크 초기화
  useEffect(() => {
    setPendingFilters({});
    setAppliedFilters([]);
    setAppliedFilterRowVisible(false);
    setPage(1);
    setSelectedCard(null);
    setChecked(new Set());
    setDedup('none');
    setIpcMode('all');
  }, [searchQuery]);

  // 결과 데이터 — 검색어 키워드 매칭 ∩ 메타필터 ∩ 패싯 → 정렬
  const queryKeywords = parseKeywords(searchQuery || '');
  const kwMatched = queryKeywords.length === 0
    ? PATENT_SEED
    : PATENT_SEED.filter(p => {
        const hay = `${p.title} ${p.abstract ?? ''} ${p.applicant} ${p.ipc} ${p.repClaim ?? ''} ${p.inventors ?? ''}`.toLowerCase();
        return queryKeywords.every(k => hay.includes(k.toLowerCase()));
      });
  const queryScoped = kwMatched.length > 0 ? kwMatched : PATENT_SEED;
  const metaScoped = applyMetaFilter(queryScoped, meta);
  const faceted = applyFacetFilters(metaScoped, appliedFilters);
  const filtered = applyDedup(faceted, dedup);   // 중복제거 적용(출원번호 기준)
  // 날짜 필드(출원일/공개일/등록일) 기준 정렬. 값 없는 항목은 뒤로.
  const data = [...filtered].sort((a, b) => {
    const va = (a[sortField] ?? '');
    const vb = (b[sortField] ?? '');
    if (!va && !vb) return 0;
    if (!va) return 1;
    if (!vb) return -1;
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  const count = data.length;

  // 오버레이 패널 키보드 네비게이션: ← 이전 / → 다음 / Esc 닫기
  useEffect(() => {
    if (selectedCard === null) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCard(c => (c != null && c < count - 1 ? c + 1 : c));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCard(c => (c != null && c > 0 ? c - 1 : c));
      } else if (e.key === 'Escape') {
        setSelectedCard(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedCard, count]);

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
    for (const g of PATENT_FACET_GROUPS_BASE) {
      for (const label of (pendingFilters[g.key] || [])) {
        if (g.key === 'ipc_top') {
          // IPC는 현재 토글(Main/All)을 함께 기록 → 매칭 의미·칩 라벨 구분
          newApplied.push({ facetKey: g.key, title: `IPC(${ipcMode === 'main' ? 'Main' : 'All'})`, label, mode: ipcMode });
        } else {
          newApplied.push({ facetKey: g.key, title: g.title, label });
        }
      }
    }
    setAppliedFilters(newApplied);
    setAppliedFilterRowVisible(newApplied.length > 0);
    setPage(1);
    setSelectedCard(null);
    setOpenFacet(null);
  };

  const removeAppliedFilter = (f: AppliedFilter) => {
    const next = appliedFilters.filter(x => !(x.facetKey === f.facetKey && x.label === f.label));
    setAppliedFilters(next);
    setAppliedFilterRowVisible(next.length > 0);
    setPendingFilters(prev => {
      const cur = prev[f.facetKey] || [];
      return { ...prev, [f.facetKey]: cur.filter(x => x !== f.label) };
    });
  };

  const resetFilters = () => {
    setPendingFilters({});
    setAppliedFilters([]);
    setAppliedFilterRowVisible(false);
  };

  const exportCsv = () => {
    const rows = checked.size > 0 ? Array.from(checked).map(i => data[i]).filter(Boolean) : data;
    const header = '문헌번호,발명의명칭,출원인,출원일,상태,IPC';
    const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const csv = [header, ...rows.map(d => [esc(d.number), esc(d.title), esc(d.applicant), d.applicationDate, d.status, esc(d.ipc)].join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'patents.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`${rows.length}건 CSV 다운로드`);
  };

  return (
    <div className="flex flex-col">
      {/* ── 상단 고정 툴바 (검색식·건수·필터·정렬) ── */}
      <div className="sticky top-0 z-20 bg-white shrink-0">
        {/* sri-header — 검색식(먼저) → 건수 */}
        <div data-spec="PAT-LST-010" className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white flex-wrap">
          <span className="text-xs2 text-gray-400 font-semibold shrink-0">검색식</span>
          <span
            className="inline-flex items-center h-7 text-xs2 px-2.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-mono cursor-pointer hover:bg-blue-100 transition-colors max-w-md truncate"
            title={appliedQuery}
          >
            {appliedQuery}
          </span>
          <Badge color="neutral" className="font-bold text-sm2 shrink-0">{count.toLocaleString()}건</Badge>
          {onCrossSearch && searchQuery && (
            <Button variant="text" color="primary" size="xs" className="shrink-0 text-amber-600 h-7"
              title="이 검색 키워드로 논문 검색 (검색식 이월)"
              onClick={() => onCrossSearch(parseKeywords(searchQuery).join(' '))}>
              → 논문으로
            </Button>
          )}
          <span className="flex-1" />
          {/* 중복제거 — 동일 출원번호(공개+등록 문헌)를 한 건으로. 문헌번호 기준 검색 특성 대응 */}
          <span data-spec="PAT-LST-080" className="inline-flex items-center gap-1 shrink-0">
            <span className="text-xs2 text-gray-400 mr-0.5" title="검색은 문헌번호 기준이라 동일 출원이 공개·등록 문헌으로 함께 잡힙니다. 출원번호로 묶어 한 건만 남깁니다.">중복제거</span>
            {([['none', '사용안함'], ['reg', '등록 우선'], ['pub', '공개 우선']] as [DedupMode, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setDedup(m); setPage(1); }}
                className={clsx(
                  'h-6 px-2 rounded text-xs2 border transition-colors',
                  dedup === m
                    ? 'bg-brand-400 text-white border-brand-400'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-brand-400',
                )}
              >{label}</button>
            ))}
          </span>
        </div>

        {/* filter-bar — 필터 칩 ... 정렬·페이지·CSV */}
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-gray-100 bg-gray-50 flex-wrap relative z-20">
          <span data-spec="PAT-LST-030" className="text-xs2 font-semibold text-gray-500 mr-1">필터</span>
          {PATENT_FACET_GROUPS_BASE.map(g => {
            const activeCount = appliedFilters.filter(f => f.facetKey === g.key).length;
            const isOpen = openFacet === g.key;
            return (
              <div key={g.key} className="relative">
                <button
                  onClick={() => setOpenFacet(isOpen ? null : g.key)}
                  className={clsx(
                    'inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs2 transition-all',
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
                    items={g.key === 'ipc_top' ? IPC_FACET_ITEMS[ipcMode] : undefined}
                    modeToggle={g.key === 'ipc_top' ? { mode: ipcMode, onChange: setIpcMode } : undefined}
                    selected={pendingFilters[g.key] || []}
                    onToggle={(label) => togglePendingFilter(g.key, label)}
                    onApply={applyFilters}
                    onClose={() => setOpenFacet(null)}
                  />
                )}
              </div>
            );
          })}
          <Button variant="outlined" color="primary" size="xs" onClick={resetFilters} className="text-xs2 h-7 text-gray-400">필터 초기화</Button>
          <span className="flex-1" />
          {/* 정렬: 날짜 필드 선택 + 방향 (출원일 외 공개일·등록일도 선택) */}
          <select
            data-spec="PAT-LST-040"
            className="h-7 px-2 w-24 border border-gray-200 rounded text-xs2 bg-white outline-none hover:border-gray-300 focus:border-blue-400"
            value={sortField}
            onChange={e => { setSortField(e.target.value as DateField); setPage(1); }}
            title="정렬 날짜 기준"
          >
            {DATE_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select
            className="h-7 px-2 w-24 border border-gray-200 rounded text-xs2 bg-white outline-none hover:border-gray-300 focus:border-blue-400"
            value={sortDir}
            onChange={e => { setSortDir(e.target.value as 'asc' | 'desc'); setPage(1); }}
            title="정렬 방향"
          >
            <option value="desc">최신순</option>
            <option value="asc">오래된순</option>
          </select>
          <select
            value={perPage}
            onChange={e => { setPerPage(Number(e.target.value) as 20 | 50 | 100 | 200); setPage(1); }}
            className="h-7 px-2 w-28 border border-gray-200 rounded text-xs2 bg-white outline-none hover:border-gray-300 focus:border-blue-400"
          >
            <option value={20}>20개씩 보기</option>
            <option value={50}>50개씩 보기</option>
            <option value={100}>100개씩 보기</option>
            <option value={200}>200개씩 보기</option>
          </select>
          <Button
            data-spec="PAT-LST-050"
            variant="outlined" color="primary" size="xs" className="text-xs2 h-7"
            disabled={count === 0}
            title={checked.size > 0 ? `${checked.size}건 CSV 다운로드` : `전체 ${count}건 CSV 다운로드`}
            onClick={exportCsv}
          >CSV 다운{checked.size > 0 ? ` (${checked.size})` : ''}</Button>
        </div>
      </div>

      {/* 팝오버 바깥 클릭 닫기 백드롭 */}
      {openFacet && <div className="fixed inset-0 z-10" onClick={() => setOpenFacet(null)} />}

      {/* 적용된 필터 칩 행 */}
      {appliedFilterRowVisible && appliedFilters.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-white border-b border-gray-100 flex-wrap shrink-0">
          <span className="text-xs2 font-semibold text-gray-500 mr-1">적용된 필터</span>
          {appliedFilters.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-full text-xs2 text-brand-400">
              {f.title}: {f.label}
              <button onClick={() => removeAppliedFilter(f)} className="hover:text-blue-900 ml-0.5">×</button>
            </span>
          ))}
          <button onClick={resetFilters} className="text-xs2 text-gray-400 hover:text-red-500 ml-1">전체 해제</button>
        </div>
      )}

      {/* ── 결과 본문 ── */}
      {count === 0 ? (
        <div data-spec="PAT-LST-070" className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 text-gray-400">
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
      ) : (
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
          onClearChecked={() => setChecked(new Set())}
          onSaveChecked={() => { onSaveMany?.(Array.from(checked).map(i => data[i]).filter(Boolean)); setChecked(new Set()); }}
        />
      )}
    </div>
  );
}

// ── 패싯 칩 스코프 팝오버 (해당 패싯 값+건수만) ──
function FacetPopover({ group, items: itemsOverride, modeToggle, selected, onToggle, onApply, onClose }: {
  group: FacetGroup;
  items?: FacetItem[];
  modeToggle?: { mode: 'main' | 'all'; onChange: (m: 'main' | 'all') => void };
  selected: string[];
  onToggle: (label: string) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const items = (itemsOverride ?? group.items).filter(it => it.label !== '전체');
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
      {modeToggle && (
        // IPC Main/All 토글 — Main=최신 대표 IPC만 / All=개정이력 포함 전체 IPC
        <div data-spec="PAT-LST-031" className="flex items-center gap-1 mb-1.5">
          {([['main', 'Main'], ['all', 'All']] as ['main' | 'all', string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => modeToggle.onChange(m)}
              title={m === 'main' ? '최신 대표 IPC만 집계' : '개정이력 포함 전체 IPC 집계'}
              className={clsx(
                'flex-1 h-6 rounded text-xs2 border transition-colors',
                modeToggle.mode === m
                  ? 'bg-blue-50 text-brand-400 border-blue-400 font-semibold'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-blue-400',
              )}
            >{label}</button>
          ))}
        </div>
      )}
      {searchable && (
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={`${group.title} 검색`}
          className="w-full mb-1.5 px-2 h-7 border border-gray-200 rounded text-xs2 outline-none focus:border-blue-400"
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
            <span className="truncate">{it.label}{it.count != null && <span className="text-gray-400"> ({it.count.toLocaleString()}건)</span>}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-1.5 pt-1.5 mt-1 border-t border-gray-100">
        <Button variant="outlined" color="primary" size="xs" onClick={onClose}>취소</Button>
        <Button variant="filled" color="primary" size="xs" onClick={onApply}>적용</Button>
      </div>
    </div>
  );
}

// ── 테이블 목록 + 우측 오버레이 상세 ──
function TableResults({ data, selectedCard, onSelectCard, onOpenDetail, onSave, page, onPageChange, totalCount, perPage, searchQuery, checked, onToggleCheck, onToggleAll, onClearChecked, onSaveChecked }: {
  data: PatentResult[];
  selectedCard: number | null;
  onSelectCard: (i: number) => void;
  onOpenDetail: (patentNumber: string) => void;
  onSave: (i: number) => void;
  page: number;
  onPageChange: (p: number) => void;
  totalCount: number;
  perPage: number;
  searchQuery?: string;
  checked: Set<number>;
  onToggleCheck: (i: number) => void;
  onToggleAll: (all: boolean) => void;
  onClearChecked: () => void;
  onSaveChecked: () => void;
}) {
  const totalPages = Math.ceil(totalCount / perPage);
  const startIdx = (page - 1) * perPage;
  const pageData = data.slice(startIdx, startIdx + perPage);
  const pageAllChecked = pageData.length > 0 && pageData.every((_, i) => checked.has(startIdx + i));

  return (
    <div>
      {/* 선택/페이지 바 — 일괄 저장은 체크 시 노출 (전체선택은 표 헤더 체크박스) */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
        {checked.size > 0 ? (
          <>
            <span className="text-sm2 font-semibold text-blue-700">{checked.size}건 선택</span>
            <Button data-spec="PAT-LST-060" variant="filled" color="primary" size="xs" className="text-xs2 h-7" onClick={onSaveChecked}>
              <Icon name="star" size={11} /> 선택 저장
            </Button>
            <button onClick={onClearChecked} className="text-xs2 text-gray-400 hover:text-red-500">선택 해제</button>
          </>
        ) : (
          <span className="text-xs2 text-gray-400">행을 클릭하면 우측에서 상세를 미리볼 수 있습니다 · 체크 후 일괄 저장</span>
        )}
        <span className="flex-1" />
        <Pagination current={page} total={totalPages} onChange={onPageChange} />
      </div>

      {/* 테이블 (데스크톱) — 모바일에선 카드 리스트로 대체 */}
      <div data-spec="PAT-LST-020" className="hidden md:block bg-white">
        <table className="w-full text-sm2 border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-8 px-2 py-2 text-center border-r border-gray-100" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="form-checkbox text-brand-400 rounded w-3.5 h-3.5"
                  checked={pageAllChecked}
                  onChange={e => onToggleAll(e.target.checked)}
                />
              </th>
              <th className="w-16 px-2 py-2 text-center font-semibold text-gray-500 border-r border-gray-100 whitespace-nowrap">상태</th>
              <th className="w-40 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100 whitespace-nowrap">문헌번호</th>
              <th className="w-14 px-2 py-2 text-center font-semibold text-gray-500 border-r border-gray-100 whitespace-nowrap">원문</th>
              <th className="px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100 whitespace-nowrap">발명의 명칭</th>
              <th className="w-32 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100 whitespace-nowrap">출원인</th>
              <th className="w-24 px-2 py-2 text-left font-semibold text-gray-500 border-r border-gray-100 whitespace-nowrap">출원일</th>
              <th className="w-28 px-2 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">IPC</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((d, i) => {
              const absIdx = startIdx + i;
              const isSelected = selectedCard === absIdx;
              return (
                <tr
                  key={absIdx}
                  data-spec="PAT-LST-021"
                  onClick={() => onSelectCard(absIdx)}
                  className={clsx(
                    'border-b border-gray-100 cursor-pointer transition-colors',
                    isSelected ? 'bg-blue-50 border-l-2 border-l-blue-600' : 'hover:bg-gray-50',
                  )}
                >
                  <td className="px-2 py-2 text-center border-r border-gray-100 align-top" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      data-spec="PAT-LST-022"
                      className="form-checkbox text-brand-400 rounded w-3.5 h-3.5 mt-0.5"
                      checked={checked.has(absIdx)}
                      onChange={() => onToggleCheck(absIdx)}
                    />
                  </td>
                  <td className="px-2 py-2 text-center align-top">
                    <span title={getPatentStatusDesc(d.status)} className="cursor-help text-xs2 whitespace-nowrap font-medium text-gray-600">{d.status}</span>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <span className="font-mono text-xs2 text-brand-400 leading-snug">{d.number}</span>
                  </td>
                  <td className="px-2 py-2 text-center align-top" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => downloadPatentPdf(d)}
                      className="inline-flex items-center justify-center text-red-500 hover:text-red-600"
                      title="특허 원문 PDF 다운로드"
                    ><Icon name="doc" size={15} /></button>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex items-start gap-1.5">
                      <button
                        onClick={e => { e.stopPropagation(); onSelectCard(absIdx); }}
                        className="flex-1 min-w-0 text-left text-sm2 text-gray-800 hover:text-brand-400 line-clamp-2 leading-snug font-medium"
                        title={`${d.title}\n(클릭: 우측 미리보기)`}
                      >
                        {highlightText(d.title, searchQuery)}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); onOpenDetail(d.number); }}
                        className="shrink-0 inline-flex items-center gap-1 text-xs2 text-gray-400 hover:text-brand-400 mt-0.5"
                        title="새 탭에서 전체 보기"
                      >새 탭에서 열기 <Icon name="link" size={11} /></button>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs2 text-gray-600 truncate max-w-[120px] align-top">{d.applicant}</td>
                  <td className="px-2 py-2 text-xs2 text-gray-600 font-mono align-top">{d.applicationDate}</td>
                  <td className="px-2 py-2 text-xs2 text-gray-600 font-mono align-top">{d.ipc}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 리스트 */}
      <div className="md:hidden bg-white divide-y divide-gray-100">
        {pageData.map((d, i) => {
          const absIdx = startIdx + i;
          const isSelected = selectedCard === absIdx;
          return (
            <div
              key={absIdx}
              onClick={() => onSelectCard(absIdx)}
              className={clsx('flex gap-2 px-3 py-2.5', isSelected ? 'bg-blue-50' : 'active:bg-gray-50')}
            >
              <input
                type="checkbox"
                onClick={e => e.stopPropagation()}
                checked={checked.has(absIdx)}
                onChange={() => onToggleCheck(absIdx)}
                className="mt-1 shrink-0 form-checkbox text-brand-400 rounded w-4 h-4"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span title={getPatentStatusDesc(d.status)} className="text-xs2 whitespace-nowrap font-medium text-gray-600">{d.status}</span>
                  <span className="font-mono text-xs2 text-brand-400">{d.number}</span>
                </div>
                <div className="text-sm2 font-medium text-gray-800 leading-snug">{highlightText(d.title, searchQuery)}</div>
                <div className="text-xs2 text-gray-500 truncate mt-0.5">{d.applicant} · {d.applicationDate} · {d.ipc}</div>
                <div className="flex items-center gap-3 mt-1.5">
                  <button onClick={e => { e.stopPropagation(); downloadPatentPdf(d); }} className="text-xs2 text-red-500 inline-flex items-center gap-0.5"><Icon name="doc" size={12} /> 원문 PDF</button>
                  <button onClick={e => { e.stopPropagation(); onOpenDetail(d.number); }} className="text-xs2 text-brand-400 inline-flex items-center gap-0.5">새 탭에서 열기 <Icon name="link" size={11} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 하단 페이지네이션 */}
      <div className="flex justify-center py-2 border-t border-gray-100 bg-white shrink-0">
        <Pagination current={page} total={totalPages} onChange={onPageChange} />
      </div>

      {/* 우측 오버레이 상세 패널 (OpenAlex 방식 — 목록을 덮음) */}
      {selectedCard !== null && data[selectedCard] && (
        <aside className="fixed top-[52px] right-0 bottom-0 z-40 w-full sm:w-[50%] sm:min-w-[480px] sm:max-w-[840px] border-l border-gray-200 bg-white flex flex-col overflow-hidden shadow-2xl">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
            <Button variant="outlined" color="primary" size="xs" className="px-1.5 disabled:opacity-30" disabled={selectedCard <= 0} onClick={() => onSelectCard(selectedCard - 1)} title="이전 (←)">◀</Button>
            <Button variant="outlined" color="primary" size="xs" className="px-1.5 disabled:opacity-30" disabled={selectedCard >= data.length - 1} onClick={() => onSelectCard(selectedCard + 1)} title="다음 (→)">▶</Button>
            <span className="text-xs2 text-gray-400 font-mono">{selectedCard + 1} / {data.length}</span>
            <span className="flex-1" />
            <Button variant="filled" color="primary" size="xs" onClick={() => onOpenDetail(data[selectedCard].number)} title="새 탭에서 전체 보기">새 탭 ↗</Button>
            <Button variant="outlined" color="primary" size="xs" onClick={() => onSave(selectedCard)} title="이 문헌을 내 라이브러리에 저장"><Icon name="star" size={11} /> 라이브러리 저장</Button>
            <button onClick={() => onSelectCard(-1)} className="text-gray-400 hover:text-gray-700 p-1 shrink-0" title="닫기 (Esc)"><Icon name="close" size={14} /></button>
          </div>
          <PatentDetail
            embedded
            data={data[selectedCard]}
            searchQuery={searchQuery}
            onBack={() => onSelectCard(-1)}
            onSave={() => onSave(selectedCard)}
          />
        </aside>
      )}
    </div>
  );
}

// ── 키워드 하이라이트 ──
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
