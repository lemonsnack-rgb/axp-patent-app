// 논문 검색 결과 — sri-header + filter-bar + FilterDrawer + 적용필터칩 + 2-Column
import { useState, useEffect, type ReactNode } from 'react';
import clsx from 'clsx';
import { PAPER_SEED } from '../data/patentSeed';
import { PAPER_FACET_GROUPS } from '../data/facetGroups';
import { Icon } from '../components/Icon';
import { parseKeywords, KW_COLORS } from '../components/PatentDetail';
import { Badge, Card } from '../components/ui';
import type { PaperResult } from '../types';
import { Button, toast } from '@muhayu/axp-ui';

type SortKey = 'match' | 'recent' | 'old';

interface AppliedFilter { facetKey: string; title: string; label: string }

interface Props {
  onModify: () => void;
  onSave: (p: PaperResult) => void;
  onSaveMany?: (papers: PaperResult[]) => void;   // 체크박스 일괄 저장
  onOpenDetail?: (id: string) => void;   // 새 탭으로 전체 보기
  searchQuery?: string;
  onRefine?: (term: string) => void;
  onCrossSearch?: (keywords: string) => void;   // 검색식 이월 → 특허 [검색-212]
}

export function PaperResults({ onModify, onSave, onSaveMany, onOpenDetail, searchQuery, onRefine, onCrossSearch }: Props) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>('recent');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Record<string, string[]>>({});
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilter[]>([]);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [appliedFilterRowVisible, setAppliedFilterRowVisible] = useState(false);
  const [refineTerm, setRefineTerm] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<20 | 50 | 100>(20);
  const [openGroup, setOpenGroup] = useState<string | null>(null); // 드로어에 표시할 그룹(null=전체)

  // 검색어 키워드 + 패싯(발행연도/저널명)으로 실제 필터링 [검색-100·154]
  const queryKeywords = parseKeywords(searchQuery || '');
  const yearFilters = appliedFilters.filter(f => f.facetKey === 'pub_year').map(f => f.label);
  const journalFilters = appliedFilters.filter(f => f.facetKey === 'journal').map(f => f.label);
  // 목업: 검색어가 매칭되지 않아도 결과가 비지 않도록 키워드 매칭 0건이면 전체로 폴백
  const kwMatched = queryKeywords.length === 0
    ? PAPER_SEED
    : PAPER_SEED.filter(p => {
        const hay = `${p.title} ${p.abstract ?? ''} ${p.authors} ${p.journal ?? ''}`.toLowerCase();
        return queryKeywords.every(k => hay.includes(k.toLowerCase()));
      });
  const kwScoped = kwMatched.length > 0 ? kwMatched : PAPER_SEED;
  const filtered = kwScoped.filter(p => {
    if (yearFilters.length > 0) {
      const ok = yearFilters.some(lbl => lbl === '2021 이전' ? !!(p.year && p.year <= 2021) : String(p.year ?? '') === lbl);
      if (!ok) return false;
    }
    if (journalFilters.length > 0 && !journalFilters.some(lbl => (p.journal ?? '') === lbl)) return false;
    return true;
  });
  // 매칭순은 검색 매칭 순서 유지, 그 외는 발행연도 기준 정렬
  const data = sort === 'match'
    ? filtered
    : [...filtered].sort((a, b) => {
        const ya = a.year ?? 0, yb = b.year ?? 0;
        return sort === 'old' ? ya - yb : yb - ya;
      });
  const count = data.length;
  const totalPages = Math.max(1, Math.ceil(count / perPage));
  const safePage = Math.min(page, totalPages);
  const pageData = data.slice((safePage - 1) * perPage, safePage * perPage);
  const appliedQuery = searchQuery && searchQuery.trim() ? searchQuery : '전체 검색';

  // 미리보기 패널 키보드 네비게이션: ← 이전 / → 다음 / Esc 닫기
  useEffect(() => {
    if (selectedCard === null) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCard(c => (c != null && c < pageData.length - 1 ? c + 1 : c));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCard(c => (c != null && c > 0 ? c - 1 : c));
      } else if (e.key === 'Escape') {
        setSelectedCard(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedCard, pageData.length]);

  const togglePendingFilter = (groupKey: string, label: string) => {
    setPendingFilters(prev => {
      const cur = prev[groupKey] || [];
      return cur.includes(label)
        ? { ...prev, [groupKey]: cur.filter(x => x !== label) }
        : { ...prev, [groupKey]: [...cur, label] };
    });
  };

  const applyFilters = () => {
    const next: AppliedFilter[] = [];
    for (const g of PAPER_FACET_GROUPS) {
      for (const label of (pendingFilters[g.key] || [])) {
        next.push({ facetKey: g.key, title: g.title, label });
      }
    }
    setAppliedFilters(next);
    setAppliedFilterRowVisible(next.length > 0);
    setDrawerOpen(false);
  };

  const cancelFilters = () => {
    const restored: Record<string, string[]> = {};
    appliedFilters.forEach(f => { restored[f.facetKey] = [...(restored[f.facetKey] || []), f.label]; });
    setPendingFilters(restored);
    setDrawerOpen(false);
  };

  const removeAppliedFilter = (f: AppliedFilter) => {
    const next = appliedFilters.filter(x => !(x.facetKey === f.facetKey && x.label === f.label));
    setAppliedFilters(next);
    setAppliedFilterRowVisible(next.length > 0);
    const restored: Record<string, string[]> = {};
    next.forEach(x => { restored[x.facetKey] = [...(restored[x.facetKey] || []), x.label]; });
    setPendingFilters(restored);
  };

  const resetFilters = () => {
    setPendingFilters({});
    setAppliedFilters([]);
    setAppliedFilterRowVisible(false);
  };

  return (
    <div className="flex flex-col">
      {/* ── 상단 고정 툴바 (검색 건수·검색필드·필터·정렬) ── */}
      <div className="sticky top-0 z-20 bg-white shrink-0">
      {/* ── sri-header ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white flex-wrap">
        {/* 검색식(먼저) → 건수 순서 */}
        <span className="text-xs2 text-gray-400 font-semibold shrink-0">검색식</span>
        <span
          className="inline-flex items-center h-7 text-xs2 px-2.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-mono cursor-pointer hover:bg-blue-100 transition-colors max-w-md truncate"
          title={appliedQuery}
        >
          {appliedQuery}
        </span>
        <Badge color="neutral" className="font-bold text-sm2 shrink-0">{count.toLocaleString()}건</Badge>
        <Button variant="outlined" color="primary" size="xs" className="h-7" onClick={onModify}>
          <Icon name="edit" size={11} /> 검색조건 수정
        </Button>
        {onRefine && (
          <input
            value={refineTerm}
            onChange={e => setRefineTerm(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && refineTerm.trim()) { onRefine(refineTerm.trim()); setRefineTerm(''); } }}
            placeholder="결과 내 검색 + (Enter)"
            title="현재 검색식에 AND로 추가해 결과를 좁힙니다"
            className="shrink-0 w-44 h-7 px-2 border border-gray-200 rounded text-xs2 outline-none focus:border-blue-400"
          />
        )}
        {onCrossSearch && searchQuery && (
          <Button variant="text" color="primary" size="xs" className="shrink-0 text-amber-600"
            title="이 검색 키워드로 특허 검색 (검색식 이월)"
            onClick={() => onCrossSearch(parseKeywords(searchQuery).join(' '))}>
            → 특허로
          </Button>
        )}
      </div>

      {/* ── filter-bar ── */}
      <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-gray-100 bg-gray-50 flex-wrap">
        <span className="text-xs2 text-gray-500 font-semibold mr-1">필터</span>
        {PAPER_FACET_GROUPS.map(g => (
          <Button
            key={g.key}
            variant="outlined"
            color="primary"
            size="xs"
            onClick={() => {
              // 같은 그룹 칩을 다시 누르면 닫기, 아니면 해당 그룹만 열기
              if (drawerOpen && openGroup === g.key) { setDrawerOpen(false); }
              else { setOpenGroup(g.key); setDrawerOpen(true); }
            }}
            className={clsx(
              'text-xs2 h-7',
              ((pendingFilters[g.key] || []).length > 0 || (drawerOpen && openGroup === g.key)) && 'border-blue-400 text-blue-700 bg-blue-50',
            )}
          >
            {g.title}
            {(pendingFilters[g.key] || []).length > 0 && (
              <Badge color="brand" className="ml-1 text-xs2">{(pendingFilters[g.key] || []).length}</Badge>
            )}
          </Button>
        ))}
        <Button
          variant="outlined"
          color="primary"
          size="xs"
          onClick={() => { if (drawerOpen && openGroup === null) { setDrawerOpen(false); } else { setOpenGroup(null); setDrawerOpen(true); } }}
          className={clsx('text-xs2 h-7', drawerOpen && openGroup === null && 'border-blue-400 text-blue-700 bg-blue-50')}
        >
          모든 필터
        </Button>
        <Button variant="outlined" color="primary" size="xs" onClick={resetFilters} className="text-xs2 h-7 text-gray-400">필터 초기화</Button>
        <span className="flex-1" />
        <select
          className="input text-xs2 h-7 w-32"
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          title="정렬 기준"
        >
          <option value="match">매칭순</option>
          <option value="recent">발행연도(최신)</option>
          <option value="old">발행연도(오래된)</option>
        </select>
        <select
          value={perPage}
          onChange={e => { setPerPage(Number(e.target.value) as 20 | 50 | 100); setPage(1); }}
          className="input text-xs2 h-7 w-28"
        >
          <option value={20}>20개씩 보기</option>
          <option value={50}>50개씩 보기</option>
          <option value={100}>100개씩 보기</option>
        </select>
        <Button
          variant="outlined" color="primary" size="xs" className="text-xs2 h-7"
          disabled={data.length === 0}
          title={data.length === 0 ? '결과가 없습니다' : `${data.length}건 CSV 다운로드`}
          onClick={() => {
            const header = '제목,저자,저널,발행연도,DOI';
            const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
            const csv = [header, ...data.map(p => [
              esc(p.title), esc(p.authors), esc(p.journal ?? ''), p.year ?? '', esc(p.doi ?? ''),
            ].join(','))].join('\n');
            const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'papers.csv';
            a.click();
            URL.revokeObjectURL(a.href);
            toast(`${data.length}건 CSV 다운로드`);
          }}
        >CSV 다운</Button>
      </div>
      </div>

      {/* ── FilterDrawer ── */}
      {drawerOpen && (
        <div className="border-b border-gray-200 bg-white shrink-0">
          <div className="p-4 overflow-y-auto max-h-80 scroll-thin">
            <div className={clsx('grid gap-x-8 gap-y-4', openGroup === null ? 'grid-cols-2' : 'grid-cols-1')}>
              {PAPER_FACET_GROUPS.filter(g => openGroup === null || g.key === openGroup).map(g => (
                <div key={g.key}>
                  <div className="text-xs2 font-semibold text-gray-600 mb-1.5">{g.title}</div>
                  <div className="space-y-1">
                    {g.items.map(item => {
                      const checked = (pendingFilters[g.key] || []).includes(item.label);
                      return (
                        <label key={item.label} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePendingFilter(g.key, item.label)}
                            className="rounded border-gray-300 text-blue-600"
                          />
                          <span className="text-sm2 text-gray-700 group-hover:text-blue-700 transition-colors">
                            {item.label}
                            {item.count != null && <span className="text-gray-400"> ({item.count.toLocaleString()}건)</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50">
            <span className="text-xs2 text-gray-500">선택한 필터는 [적용] 클릭 시 결과에 반영됩니다</span>
            <div className="flex gap-2">
              <Button variant="outlined" color="primary" size="xs" onClick={cancelFilters} className="text-xs2">취소</Button>
              <Button variant="filled" color="primary" size="xs" onClick={applyFilters} className="text-xs2">적용</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 적용된 필터 칩 행 ── */}
      {appliedFilterRowVisible && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100 bg-white shrink-0 flex-wrap">
          <span className="text-xs2 font-semibold text-gray-500 mr-1">적용된 필터</span>
          {appliedFilters.map(f => (
            <span
              key={f.facetKey + ':' + f.label}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs2 bg-blue-50 text-blue-700 border border-blue-200"
            >
              {f.title}: {f.label}
              <button onClick={() => removeAppliedFilter(f)} className="hover:text-red-500 ml-0.5">
                <Icon name="close" size={10} />
              </button>
            </span>
          ))}
          <button onClick={resetFilters} className="text-xs2 text-gray-400 hover:text-red-500 ml-1">전체 해제</button>
        </div>
      )}

      {/* ── 본문 ── */}
      {count === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 text-gray-400">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mb-3 text-gray-300">
            <circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" />
          </svg>
          <div className="text-base2 font-semibold text-gray-600 mb-1">결과 없음</div>
          <div className="text-sm2 text-gray-400">
            현재 검색식·필터 조건에 해당하는 논문이 없습니다.<br />
            검색식을 수정하거나 적용된 필터를 해제해 보세요.
          </div>
          {appliedFilters.length > 0 && (
            <Button variant="outlined" color="primary" size="sm" className="mt-3" onClick={resetFilters}>필터 초기화</Button>
          )}
        </div>
      ) : (
        <>
          <ListResults
            data={pageData}
            selectedCard={selectedCard}
            onSelect={setSelectedCard}
            onSave={onSave}
            onOpenDetail={onOpenDetail}
            searchQuery={searchQuery}
            checkedIds={checkedIds}
            onToggleId={id => setCheckedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })}
            onTogglePage={() => setCheckedIds(s => {
              const ids = pageData.map(p => p.id);
              const all = ids.every(id => s.has(id));
              const n = new Set(s);
              ids.forEach(id => all ? n.delete(id) : n.add(id));
              return n;
            })}
            onClearChecked={() => setCheckedIds(new Set())}
            onSaveChecked={() => { onSaveMany?.(data.filter(p => checkedIds.has(p.id))); setCheckedIds(new Set()); }}
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 py-3 border-t border-gray-100 bg-white text-sm2">
              <button
                onClick={() => { setPage(p => Math.max(1, p - 1)); setSelectedCard(null); }}
                disabled={safePage === 1}
                className="px-2 py-0.5 border border-gray-300 rounded-md text-gray-500 hover:border-blue-400 disabled:opacity-30"
              >‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => { setPage(p); setSelectedCard(null); }}
                  className={clsx('w-7 h-6 rounded-md border text-sm2 font-mono',
                    p === safePage ? 'bg-blue-400 text-white border-blue-400' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}
                >{p}</button>
              ))}
              <button
                onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setSelectedCard(null); }}
                disabled={safePage === totalPages}
                className="px-2 py-0.5 border border-gray-300 rounded-md text-gray-500 hover:border-blue-400 disabled:opacity-30"
              >›</button>
              <span className="text-xs2 text-gray-400 ml-2">{safePage} / {totalPages}쪽 · 총 {count}건</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// 검색식 키워드를 다색 하이라이트 (특허 결과와 동일) [검색-100]
function highlightText(text: string, query?: string): ReactNode {
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

// ── 리스트 + 우측 오버레이 상세 패널 ──
function ListResults({
  data, selectedCard, onSelect, onSave, onOpenDetail, searchQuery,
  checkedIds, onToggleId, onTogglePage, onClearChecked, onSaveChecked,
}: {
  data: PaperResult[];
  selectedCard: number | null;
  onSelect: (i: number) => void;
  onSave: (p: PaperResult) => void;
  onOpenDetail?: (id: string) => void;
  searchQuery?: string;
  checkedIds: Set<string>;
  onToggleId: (id: string) => void;
  onTogglePage: () => void;
  onClearChecked: () => void;
  onSaveChecked: () => void;
}) {
  const selected = selectedCard != null ? data[selectedCard] : null;
  const pageAllChecked = data.length > 0 && data.every(p => checkedIds.has(p.id));

  return (
    <div>
      {/* 목록 컬럼 — 패널은 오버레이라 목록 폭을 유지한다 */}
      <div className="p-3 bg-gray-50">
        {/* 선택 바 (체크박스 일괄 저장) */}
        <div className="flex items-center gap-2 px-1 pb-2">
          <label className="flex items-center gap-1.5 cursor-pointer text-sm2 text-gray-600 select-none">
            <input type="checkbox" checked={pageAllChecked} onChange={onTogglePage} className="rounded border-gray-300 text-blue-600" />
            전체 선택
          </label>
          {checkedIds.size > 0 && (
            <>
              <span className="text-sm2 font-semibold text-blue-700">{checkedIds.size}건 선택</span>
              <Button variant="filled" color="primary" size="xs" className="text-xs2" onClick={onSaveChecked}>
                <Icon name="star" size={11} /> 선택 저장
              </Button>
              <button onClick={onClearChecked} className="text-xs2 text-gray-400 hover:text-red-500">선택 해제</button>
            </>
          )}
        </div>
        {data.map((p, i) => (
          <Card
            key={p.id}
            onClick={() => onSelect(i)}
            hoverable
            selected={selectedCard === i}
            className="!p-3 mb-2"
          >
            <div className="flex gap-3">
              <input
                type="checkbox"
                checked={checkedIds.has(p.id)}
                onChange={() => onToggleId(p.id)}
                onClick={e => e.stopPropagation()}
                className="mt-1 shrink-0 rounded border-gray-300 text-blue-600 cursor-pointer"
                title="선택"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <div className={clsx(
                    'flex-1 min-w-0 text-base2 font-semibold leading-snug',
                    selectedCard === i ? 'text-blue-700' : 'text-gray-800 hover:text-blue-700',
                  )}>
                    {highlightText(p.title, searchQuery)}
                  </div>
                  {onOpenDetail && (
                    <button
                      onClick={e => { e.stopPropagation(); onOpenDetail(p.id); }}
                      className="shrink-0 inline-flex items-center gap-1 text-xs2 text-gray-400 hover:text-brand-400 mt-0.5"
                      title="새 탭에서 전체 보기"
                    >
                      새 탭에서 열기 <Icon name="link" size={11} />
                    </button>
                  )}
                </div>
                {p.titleEn && p.titleEn !== p.title && (
                  <div className="text-xs2 text-gray-400 line-clamp-1 mb-1">{p.titleEn}</div>
                )}
                <div className="text-sm2 text-gray-500 mb-1 mt-1">
                  {paperMetaLine(p)}
                </div>
                {p.abstract && (
                  <div className="text-sm2 text-gray-600 line-clamp-2">{highlightText(p.abstract, searchQuery)}</div>
                )}
                {p.doi && (
                  <div className="text-xs2 text-blue-500 mt-1 font-mono">DOI: {p.doi}</div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 우측 오버레이 상세 패널 (OpenAlex 방식 — 목록을 덮음) */}
      {selected && (
        <PaperInlineDetail
          paper={selected}
          posLabel={`${(selectedCard ?? 0) + 1} / ${data.length}`}
          onClose={() => onSelect(-1)}
          onSave={() => onSave(selected)}
          onOpenDetail={onOpenDetail ? () => onOpenDetail(selected.id) : undefined}
          onPrev={selectedCard != null && selectedCard > 0 ? () => onSelect(selectedCard - 1) : undefined}
          onNext={selectedCard != null && selectedCard < data.length - 1 ? () => onSelect(selectedCard + 1) : undefined}
        />
      )}
    </div>
  );
}

// ── 논문 인라인 상세 패널 ──
export function PaperInlineDetail({
  paper, posLabel, onClose, onSave, onPrev, onNext, onOpenDetail,
}: {
  paper: PaperResult;
  posLabel: string;
  onClose: () => void;
  onSave: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onOpenDetail?: () => void;   // 새 탭 전체보기
}) {
  const altTitle = paper.language === 'KO' ? paper.titleEn : paper.titleKo;
  return (
    <aside className="fixed top-[52px] right-0 bottom-0 z-40 w-[50%] min-w-[480px] max-w-[840px] border-l border-gray-200 bg-white flex flex-col overflow-hidden shadow-2xl">
      {/* 헤더 */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 shrink-0 bg-gray-50">
        <Button
          variant="outlined"
          color="primary"
          size="xs"
          onClick={onPrev}
          disabled={!onPrev}
          className="px-1.5 disabled:opacity-30"
          title="이전 (←)"
        >◀</Button>
        <Button
          variant="outlined"
          color="primary"
          size="xs"
          onClick={onNext}
          disabled={!onNext}
          className="px-1.5 disabled:opacity-30"
          title="다음 (→)"
        >▶</Button>
        <span className="text-xs2 text-gray-400 font-mono">{posLabel}</span>
        <span className="flex-1" />
        {onOpenDetail && (
          <Button variant="filled" color="primary" size="xs" onClick={onOpenDetail} title="새 탭에서 전체 보기">새 탭 ↗</Button>
        )}
        <Button variant="outlined" color="primary" size="xs" onClick={onSave}>
          <Icon name="star" size={11} /> 저장
        </Button>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1" title="닫기 (Esc)">
          <Icon name="close" size={14} />
        </button>
      </div>

      {/* 본문 — 상세페이지와 동일한 표시 방식(레이블:값 + 흰 카드) */}
      <div className="flex-1 overflow-y-auto scroll-thin p-3 bg-gray-50 space-y-3">
        {/* 콘텐츠 카드 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          {/* 제목 + 대등제목 + 링크 */}
          <header className="pb-3 mb-1 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 leading-snug">{paper.title}</h3>
            {altTitle && altTitle !== paper.title && (
              <div className="text-sm2 text-gray-500 mt-1 leading-snug">{altTitle}</div>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {paper.externalUrl && (
                <Button variant="filled" color="primary" size="sm" className="text-xs2 h-8"
                  onClick={() => window.open(paper.externalUrl, '_blank', 'noopener,noreferrer')}>
                  <Icon name="link" size={12} /> 원문 보기
                </Button>
              )}
              <button
                onClick={() => toast('내부 전용 본문 뷰어입니다 (데모). 실제 연동 시 본문이 표시됩니다.')}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded border border-gray-300 text-xs2 text-gray-600 hover:border-blue-400 hover:text-brand-400"
                title="기관 내부 이용자 전용 본문"
              >
                <Icon name="doc" size={12} /> 본문 보기 <span className="bg-gray-100 text-gray-500 rounded px-1">내부 전용</span>
              </button>
            </div>
          </header>
          {/* 메타데이터 — 상세페이지 순서 */}
          <dl className="divide-y divide-gray-100">
            <MetaRow label="저자명">
              {paper.authors || '-'}
              {paper.authorsEn && paper.authorsEn !== paper.authors && <span className="text-gray-400"> ({paper.authorsEn})</span>}
            </MetaRow>
            <MetaRow label="발행일">{pubDate(paper)}</MetaRow>
            {paper.paperType === 'thesis' ? (
              <MetaRow label="학위수여기관">{paper.institution || '-'}</MetaRow>
            ) : (
              <>
                <MetaRow label="저널명">{paper.journal || '-'}</MetaRow>
                <MetaRow label="저널명(영문)">{paper.journalEn || '-'}</MetaRow>
              </>
            )}
            <MetaRow label="분야">{paper.field || '-'}</MetaRow>
            <MetaRow label="키워드">
              {paper.keywords && paper.keywords.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {paper.keywords.map(k => <span key={k} className="text-xs2 px-2 py-0.5 bg-blue-50 text-brand-400 border border-blue-100 rounded-full">{k}</span>)}
                </div>
              ) : '-'}
            </MetaRow>
            <MetaRow label="초록" block>{paper.abstract || '-'}</MetaRow>
            <MetaRow label="영문초록" block>{paper.abstractEn || '-'}</MetaRow>
          </dl>
        </div>
        {/* 인용 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs2 font-bold text-gray-500 uppercase tracking-wide mb-3">인용</div>
          <div className="space-y-2">
            {citationList(paper).map(c => <CitationRow key={c.label} label={c.label} text={c.text} mono={c.mono} />)}
          </div>
        </div>
      </div>
    </aside>
  );
}

// 검색결과 논문 메타 라인 — 저자명, [저널명|학위수여기관] 권(호), 시작-끝, 발행연도(월)
// 없는 항목은 생략. 학위논문은 저널명 대신 학위수여기관 표시
function paperMetaLine(p: PaperResult): string {
  const parts: string[] = [];
  if (p.authors) parts.push(p.authors);
  const source = p.paperType === 'thesis' ? p.institution : p.journal;
  if (source) {
    let s = source;
    if (p.volume) s += ` ${p.volume}`;
    if (p.issue) s += `(${p.issue})`;
    parts.push(s);
  }
  if (p.startPage != null && p.endPage != null) parts.push(`${p.startPage}-${p.endPage}`);
  else if (p.startPage != null) parts.push(`${p.startPage}`);
  if (p.year != null) parts.push(p.month != null ? `${p.year}. ${p.month}` : `${p.year}`);
  return parts.join(', ');
}

// 발행일 — 발행연도(+월 함께 표시 가능)
function pubDate(p: PaperResult): string {
  if (p.year == null) return '-';
  return p.month != null ? `${p.year}. ${p.month}` : `${p.year}`;
}

function apaCitation(p: PaperResult): string {
  return `${p.authors} (${p.year ?? 'n.d.'}). ${p.title}.${p.journal ? ` ${p.journal}.` : ''}${p.doi ? ` https://doi.org/${p.doi}` : ''}`;
}
function mlaCitation(p: PaperResult): string {
  return `${p.authors}. "${p.title}." ${p.journal ?? ''}${p.journal ? ', ' : ''}${p.year ?? 'n.d.'}.`;
}
function chicagoCitation(p: PaperResult): string {
  return `${p.authors}. "${p.title}." ${p.journal ?? ''} (${p.year ?? 'n.d.'}).${p.doi ? ` https://doi.org/${p.doi}.` : ''}`;
}
function harvardCitation(p: PaperResult): string {
  return `${p.authors} (${p.year ?? 'n.d.'}) '${p.title}', ${p.journal ?? ''}.`;
}
function bibtexCitation(p: PaperResult): string {
  const key = (p.authors.split(/[,\s]/)[0] || 'ref') + (p.year ?? '');
  return `@article{${key},\n  title={${p.title}},\n  author={${p.authors}},\n  journal={${p.journal ?? ''}},\n  year={${p.year ?? ''}}${p.doi ? `,\n  doi={${p.doi}}` : ''}\n}`;
}
function citationList(p: PaperResult): { label: string; text: string; mono?: boolean }[] {
  return [
    { label: 'APA', text: apaCitation(p) },
    { label: 'MLA', text: mlaCitation(p) },
    { label: 'Chicago', text: chicagoCitation(p) },
    { label: 'Harvard', text: harvardCitation(p) },
    { label: 'BibTeX', text: bibtexCitation(p), mono: true },
  ];
}

function CitationRow({ label, text, mono }: { label: string; text: string; mono?: boolean }) {
  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-2 py-1 border-b border-gray-100">
        <span className="text-xs2 font-semibold text-gray-500">{label}</span>
        <button
          className="text-xs2 text-brand-400 hover:underline"
          onClick={() => navigator.clipboard?.writeText(text).then(
            () => toast.success(`${label} 인용 복사됨`),
            () => toast('복사에 실패했습니다.'),
          )}
        >복사</button>
      </div>
      <pre className={clsx('px-2 py-1.5 text-xs2 text-gray-700 whitespace-pre-wrap break-words', mono && 'font-mono')}>{text}</pre>
    </div>
  );
}

// 관련 논문 — 같은 분야 우선, 공유 키워드 수로 정렬 (자기 자신 제외)
// 관련 논문 = 검색결과 상위 N건 (유사도가 아닌 검색결과 순서)
function relatedPapers(paper: PaperResult, all: PaperResult[], n = 10): PaperResult[] {
  return all.filter(p => p.id !== paper.id).slice(0, n);
}

// ── 논문 전체 상세 (새 탭) — PC 우선 2단 레이아웃 + 모바일 반응형 ──
export function PaperDetailFull({ paper, onClose, onSave, onOpenRelated }: {
  paper: PaperResult;
  onClose: () => void;
  onSave: () => void;
  onOpenRelated?: (id: string) => void;
}) {
  const related = relatedPapers(paper, PAPER_SEED);
  // 대등제목 — 원문이 한글이면 영문, 영문이면 한글
  const altTitle = paper.language === 'KO' ? paper.titleEn : paper.titleKo;
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-50">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
        <Button variant="outlined" color="primary" size="sm" onClick={onClose}>탭 닫기</Button>
        <span className="flex-1" />
        <Button variant="filled" color="primary" size="sm" onClick={onSave}><Icon name="star" size={12} /> 라이브러리 저장</Button>
      </div>

      {/* 본문 — 중앙 정렬 + 데스크톱 2단 */}
      <div className="flex-1 overflow-y-auto scroll-thin">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <main className="lg:col-span-8 min-w-0 space-y-6">
          {/* 콘텐츠 카드 — 회색 페이지 위 흰색 영역(OpenAlex) */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 lg:p-8">
          {/* 제목 — 원제목(원문) + 대등제목(다른 언어). 레이블 없음 */}
          <header className="pb-4 mb-2 border-b border-gray-100">
            <h1 className="text-3xl font-bold text-gray-900 leading-tight text-balance">{paper.title}</h1>
            {altTitle && altTitle !== paper.title && (
              <div className="text-lg text-gray-500 mt-2 leading-snug">{altTitle}</div>
            )}
            {/* 링크 — 제목 하단 (원문/본문) */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {paper.externalUrl && (
                <Button variant="filled" color="primary" size="sm" className="text-xs2 h-8"
                  onClick={() => window.open(paper.externalUrl, '_blank', 'noopener,noreferrer')}>
                  <Icon name="link" size={12} /> 원문 보기
                </Button>
              )}
              <button
                onClick={() => toast('내부 전용 본문 뷰어입니다 (데모). 실제 연동 시 본문이 표시됩니다.')}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded border border-gray-300 text-xs2 text-gray-600 hover:border-blue-400 hover:text-brand-400"
                title="기관 내부 이용자 전용 본문"
              >
                <Icon name="doc" size={12} /> 본문 보기 <span className="bg-gray-100 text-gray-500 rounded px-1">내부 전용</span>
              </button>
            </div>
          </header>

          {/* 메타데이터 — OpenAlex 방식: 레이블 값 명시적 구분 */}
          <dl className="divide-y divide-gray-100">
            <MetaRow label="저자명">
              {paper.authors || '-'}
              {paper.authorsEn && paper.authorsEn !== paper.authors && <span className="text-gray-400"> ({paper.authorsEn})</span>}
            </MetaRow>
            <MetaRow label="발행일">{pubDate(paper)}</MetaRow>
            {paper.paperType === 'thesis' ? (
              <MetaRow label="학위수여기관">{paper.institution || '-'}</MetaRow>
            ) : (
              <>
                <MetaRow label="저널명">{paper.journal || '-'}</MetaRow>
                <MetaRow label="저널명(영문)">{paper.journalEn || '-'}</MetaRow>
              </>
            )}
            <MetaRow label="분야">{paper.field || '-'}</MetaRow>
            <MetaRow label="키워드">
              {paper.keywords && paper.keywords.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {paper.keywords.map(k => <span key={k} className="text-xs2 px-2 py-0.5 bg-blue-50 text-brand-400 border border-blue-100 rounded-full">{k}</span>)}
                </div>
              ) : '-'}
            </MetaRow>
            <MetaRow label="초록" block>{paper.abstract || '-'}</MetaRow>
            <MetaRow label="영문초록" block>{paper.abstractEn || '-'}</MetaRow>
          </dl>
          </div>

          {/* 관련 논문 — 검색결과 상위(한 줄씩), 하단 */}
          {related.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-xl p-6 lg:p-8">
              <h2 className="text-base2 font-bold text-gray-800 mb-3">관련 논문 <span className="text-sm2 font-normal text-gray-400">· 검색결과 상위 {related.length}건</span></h2>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                {related.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => onOpenRelated?.(r.id)}
                    disabled={!onOpenRelated}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-blue-50/40 transition-colors disabled:cursor-default group"
                  >
                    <span className="text-xs2 font-mono text-gray-400 w-5 shrink-0 pt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm2 font-semibold text-gray-800 group-hover:text-brand-400 truncate">{r.title}</div>
                      <div className="text-xs2 text-gray-500 truncate mt-0.5">
                        {paperMetaLine(r)}
                      </div>
                    </div>
                    {r.field && <span className="shrink-0 text-xs2 px-1.5 py-0.5 bg-blue-50 text-brand-400 rounded self-center">{r.field}</span>}
                    {onOpenRelated && <span className="shrink-0 text-xs2 text-gray-300 group-hover:text-brand-400 self-center">열기 →</span>}
                  </button>
                ))}
              </div>
            </section>
          )}
            </main>

            {/* 우측 — 인용정보 복사 영역 */}
            <aside className="lg:col-span-4 lg:sticky lg:top-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-xs2 font-bold text-gray-500 uppercase tracking-wide mb-3">인용</div>
                <div className="space-y-2">
                  {citationList(paper).map(c => <CitationRow key={c.label} label={c.label} text={c.text} mono={c.mono} />)}
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* 푸터 */}
        <PaperDetailFooter />
      </div>
    </div>
  );
}

// ── 레이블:값 행 (OpenAlex 방식 — 레이블과 값을 명시적으로 구분) ──
function MetaRow({ label, children, block }: { label: string; children: React.ReactNode; block?: boolean }) {
  // block=true: 장문(초록 등) — 레이블 위, 값은 전체 폭
  if (block) {
    return (
      <div className="py-3.5">
        <dt className="text-sm2 font-medium text-gray-400 mb-1.5">{label}</dt>
        <dd className="text-base2 text-gray-900 leading-relaxed whitespace-pre-line">{children}</dd>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row gap-1 sm:gap-6 py-3.5">
      <dt className="w-32 shrink-0 text-sm2 font-medium text-gray-400 sm:pt-0.5">{label}</dt>
      <dd className="flex-1 min-w-0 text-base2 text-gray-900 leading-relaxed">{children}</dd>
    </div>
  );
}

// ── 푸터 (카피킬러 푸터 반영) ──
function PaperDetailFooter() {
  const bottomLinks = ['개인정보 처리방침', '이용약관', '회사소개', '채용안내', '패밀리사이트'];
  const sns = ['Blog', 'Youtube', 'LinkedIn', 'Instagram'];
  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-10">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs2 text-gray-500 leading-relaxed">
          {/* 회사 정보 */}
          <div>
            <div className="font-bold text-gray-700 mb-1.5">㈜무하유</div>
            <div>서울시 성동구 성수일로 8길 5</div>
            <div>서울숲 SK V1 A동 2층 (04793)</div>
            <div className="mt-2">대표이사 신동호</div>
            <div>사업자등록번호 206-86-55577</div>
            <div>통신판매업신고번호 제2011-서울성동-0831호</div>
          </div>
          {/* 고객센터 */}
          <div>
            <div className="font-bold text-gray-700 mb-1.5">카피킬러 고객센터</div>
            <div>평일 10:00~17:00 (주말 및 공휴일 휴무)</div>
            <div className="text-brand-400">help@copykiller.com</div>
            <div className="mt-2 flex gap-2">
              <button className="hover:text-brand-400">문의하기</button>
              <span className="text-gray-300">·</span>
              <button className="hover:text-brand-400">원격지원</button>
              <span className="text-gray-300">·</span>
              <button className="hover:text-brand-400">기관/대학 도입문의</button>
            </div>
            <div className="mt-2">T. 02-6233-8400 &nbsp; F. 02-6233-8420</div>
            <div className="text-brand-400">marketing@muhayu.com</div>
          </div>
          {/* 콘텐츠 */}
          <div>
            <div className="font-bold text-gray-700 mb-1.5">콘텐츠</div>
            <div className="flex flex-wrap gap-3">
              {sns.map(s => <button key={s} className="hover:text-brand-400">{s}</button>)}
            </div>
          </div>
        </div>
        {/* 하단 링크 + 카피라이트 */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs2 text-gray-500">
          <nav className="flex items-center gap-1">
            {bottomLinks.map((l, i) => (
              <span key={l} className="flex items-center">
                {i > 0 && <span className="text-gray-300 mx-1.5">·</span>}
                <button className="hover:text-brand-400">{l}</button>
              </span>
            ))}
          </nav>
          <span className="text-gray-400">Copyright © MUHAYU Inc. All rights reserved. Since 2011</span>
        </div>
      </div>
    </footer>
  );
}
