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
  onOpenDetail?: (id: string) => void;   // 새 탭으로 전체 보기
  searchQuery?: string;
  onRefine?: (term: string) => void;
  onCrossSearch?: (keywords: string) => void;   // 검색식 이월 → 특허 [검색-212]
}

export function PaperResults({ onModify, onSave, onOpenDetail, searchQuery, onRefine, onCrossSearch }: Props) {
  const [sort, setSort] = useState<SortKey>('recent');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Record<string, string[]>>({});
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilter[]>([]);
  const [selectedCard, setSelectedCard] = useState<number | null>(0);
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
      {/* ── sri-header ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white shrink-0 flex-wrap">
        <Badge color="neutral" className="font-bold text-md2">{count.toLocaleString()}건</Badge>
        <span
          className="text-xs2 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono cursor-pointer hover:bg-blue-100 transition-colors max-w-xs truncate"
          title={appliedQuery}
        >
          {appliedQuery}
        </span>
        <Button variant="outlined" color="primary" size="xs" onClick={onModify}>
          <Icon name="edit" size={11} /> 검색조건 수정
        </Button>
        {onRefine && (
          <input
            value={refineTerm}
            onChange={e => setRefineTerm(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && refineTerm.trim()) { onRefine(refineTerm.trim()); setRefineTerm(''); } }}
            placeholder="결과 내 검색 + (Enter)"
            title="현재 검색식에 AND로 추가해 결과를 좁힙니다"
            className="shrink-0 w-44 px-2 py-1 border border-gray-200 rounded text-sm2 outline-none focus:border-blue-400"
          />
        )}
        {onCrossSearch && searchQuery && (
          <Button variant="text" color="primary" size="xs" className="shrink-0 text-amber-600"
            title="이 검색 키워드로 특허 검색 (검색식 이월)"
            onClick={() => onCrossSearch(parseKeywords(searchQuery).join(' '))}>
            → 특허로
          </Button>
        )}
        <span className="flex-1" />
        <select
          className="input py-1 text-sm2 w-36"
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
        >
          <option value="match">매칭순</option>
          <option value="recent">발행연도(최신)</option>
          <option value="old">발행연도(오래된)</option>
        </select>
      </div>

      {/* ── filter-bar ── */}
      <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-gray-100 bg-gray-50 shrink-0 flex-wrap">
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
              'text-xs2',
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
          className={clsx('text-xs2', drawerOpen && openGroup === null && 'border-blue-400 text-blue-700 bg-blue-50')}
        >
          모든 필터
        </Button>
        <Button variant="outlined" color="primary" size="xs" onClick={resetFilters} className="text-xs2 text-gray-400">필터 초기화</Button>
        <span className="flex-1" />
        <select
          value={perPage}
          onChange={e => { setPerPage(Number(e.target.value) as 20 | 50 | 100); setPage(1); }}
          className="input text-sm2 py-0.5 h-7 w-28"
        >
          <option value={20}>20개씩 보기</option>
          <option value={50}>50개씩 보기</option>
          <option value={100}>100개씩 보기</option>
        </select>
        <Button
          variant="outlined" color="primary" size="xs" className="text-xs2"
          disabled={data.length === 0}
          title={data.length === 0 ? '결과가 없습니다' : `${data.length}건 CSV 다운로드`}
          onClick={() => {
            const header = '제목,저자,저널,발행연도,피인용수,DOI';
            const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
            const csv = [header, ...data.map(p => [
              esc(p.title), esc(p.authors), esc(p.journal ?? ''), p.year ?? '', p.citationCount ?? '', esc(p.doi ?? ''),
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
                          <span className="text-sm2 text-gray-700 group-hover:text-blue-700 transition-colors flex-1">
                            {item.label}
                          </span>
                          {item.count != null && (
                            <span className="text-xs2 text-gray-400">{item.count.toLocaleString()}</span>
                          )}
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
          <ListResults data={pageData} selectedCard={selectedCard} onSelect={setSelectedCard} onSave={onSave} onOpenDetail={onOpenDetail} searchQuery={searchQuery} />
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 py-3 border-t border-gray-100 bg-white text-sm2">
              <button
                onClick={() => { setPage(p => Math.max(1, p - 1)); setSelectedCard(0); }}
                disabled={safePage === 1}
                className="px-2 py-0.5 border border-gray-300 rounded-md text-gray-500 hover:border-blue-400 disabled:opacity-30"
              >‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => { setPage(p); setSelectedCard(0); }}
                  className={clsx('w-7 h-6 rounded-md border text-sm2 font-mono',
                    p === safePage ? 'bg-blue-400 text-white border-blue-400' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}
                >{p}</button>
              ))}
              <button
                onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setSelectedCard(0); }}
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

// ── 2-Column 리스트 + 상세 패널 ──
function ListResults({
  data, selectedCard, onSelect, onSave, onOpenDetail, searchQuery,
}: {
  data: PaperResult[];
  selectedCard: number | null;
  onSelect: (i: number) => void;
  onSave: (p: PaperResult) => void;
  onOpenDetail?: (id: string) => void;
  searchQuery?: string;
}) {
  const selected = selectedCard != null ? data[selectedCard] : null;

  return (
    <div className="flex items-start">
      {/* 목록 컬럼 (페이지 전체 스크롤) */}
      <div className={clsx(
        'p-3 bg-gray-50 min-w-0 flex-1',
        selected && 'max-w-[55%]',
      )}>
        {data.map((p, i) => (
          <Card
            key={p.id}
            onClick={() => onSelect(i)}
            hoverable
            selected={selectedCard === i}
            className="!p-3 mb-2"
          >
            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <div className={clsx(
                  'text-base2 font-semibold leading-snug mb-1',
                  selectedCard === i ? 'text-blue-700' : 'text-gray-800 hover:text-blue-700',
                )}>
                  {highlightText(p.title, searchQuery)}
                </div>
                <div className="text-sm2 text-gray-500 mb-1">
                  {p.authors}
                  {p.year && <span> · {p.year}</span>}
                  {p.journal && <span> · <span className="text-gray-600">{p.journal}</span></span>}
                  {p.citationCount != null && (
                    <span className="ml-2 text-xs2 text-amber-600 font-medium">
                      인용 {p.citationCount}
                    </span>
                  )}
                </div>
                {p.abstract && (
                  <div className="text-sm2 text-gray-600 line-clamp-2">{highlightText(p.abstract, searchQuery)}</div>
                )}
                {p.doi && (
                  <div className="text-xs2 text-blue-500 mt-1 font-mono">DOI: {p.doi}</div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Button
                  variant="outlined"
                  color="primary"
                  size="xs"
                  onClick={e => { e.stopPropagation(); onSave(p); }}
                  className="h-fit"
                  title="라이브러리 저장"
                >
                  <Icon name="star" size={11} /> 저장
                </Button>
                {onOpenDetail && (
                  <button
                    onClick={e => { e.stopPropagation(); onOpenDetail(p.id); }}
                    className="text-gray-400 hover:text-brand-400 text-xs2 font-semibold"
                    title="새 탭에서 전체 보기"
                  >↗ 새 탭</button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 우측 인라인 상세 패널 */}
      {selected && (
        <PaperInlineDetail
          paper={selected}
          posLabel={`${(selectedCard ?? 0) + 1} / ${data.length}`}
          preview
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
  paper, posLabel, onClose, onSave, onPrev, onNext, onOpenDetail, preview,
}: {
  paper: PaperResult;
  posLabel: string;
  onClose: () => void;
  onSave: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onOpenDetail?: () => void;   // 새 탭 전체보기 (미리보기에서만)
  preview?: boolean;
}) {
  return (
    <aside className="w-[45%] min-w-[320px] max-w-[520px] border-l border-gray-200 bg-white flex flex-col overflow-hidden shrink-0 sticky top-0 self-start h-[calc(100vh-52px)]">
      {/* 헤더 */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 shrink-0 bg-gray-50">
        {preview && <span className="text-xs2 font-semibold text-gray-500 bg-gray-200 rounded px-1.5 py-0.5 shrink-0">미리보기</span>}
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

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto scroll-thin p-4">
        {/* 제목 */}
        <h3 className="text-base2 font-semibold text-gray-900 leading-snug mb-3">{paper.title}</h3>

        {/* 서지사항 */}
        <div className="text-sm2 text-gray-600 space-y-1 mb-4 bg-gray-50 rounded-lg p-3">
          <div><span className="font-medium text-gray-700">저자:</span> {paper.authors}</div>
          {paper.journal && <div><span className="font-medium text-gray-700">저널:</span> {paper.journal}</div>}
          {paper.year && <div><span className="font-medium text-gray-700">발행년도:</span> {paper.year}</div>}
          {paper.doi && <div><span className="font-medium text-gray-700">DOI:</span> <span className="font-mono text-blue-600">{paper.doi}</span></div>}
          {paper.citationCount != null && (
            <div><span className="font-medium text-gray-700">피인용수:</span> <span className="font-semibold text-amber-600">{paper.citationCount.toLocaleString()}</span></div>
          )}
        </div>

        {/* 초록 */}
        {paper.abstract && (
          <div className="mb-4">
            <div className="text-xs2 font-semibold text-gray-500 uppercase tracking-wide mb-1.5">초록 (Abstract)</div>
            <p className="text-sm2 text-gray-700 leading-relaxed">{paper.abstract}</p>
          </div>
        )}

        {/* 액션 */}
        <div className="flex gap-2 flex-wrap">
          {paper.doi && (
            <Button
              variant="outlined" color="primary" size="sm" className="text-xs2"
              onClick={() => window.open(`https://doi.org/${paper.doi}`, '_blank', 'noopener,noreferrer')}
              title={`원문 보기 (DOI: ${paper.doi})`}
            >
              <Icon name="link" size={11} /> 원문 ↗
            </Button>
          )}
          <Button variant="outlined" color="primary" size="sm" onClick={onSave} className="text-xs2">
            <Icon name="star" size={11} /> 라이브러리 저장
          </Button>
          <Button
            variant="outlined" color="primary" size="sm" className="text-xs2"
            onClick={() => {
              const cite = `${paper.authors} (${paper.year ?? 'n.d.'}). ${paper.title}.${paper.journal ? ` ${paper.journal}.` : ''}${paper.doi ? ` https://doi.org/${paper.doi}` : ''}`;
              navigator.clipboard?.writeText(cite).then(
                () => toast.success('인용 정보가 복사되었습니다.'),
                () => toast('복사에 실패했습니다.'),
              );
            }}
            title="인용 정보를 클립보드에 복사"
          >
            <Icon name="clipboard" size={11} /> 인용 복사
          </Button>
        </div>
      </div>
    </aside>
  );
}
