// 논문 검색 결과 — sri-header + filter-bar + FilterDrawer + 적용필터칩 + 2-Column
import { useState } from 'react';
import clsx from 'clsx';
import { PAPER_SEED } from '../data/patentSeed';
import { PAPER_FACET_GROUPS } from '../data/facetGroups';
import { Icon } from '../components/Icon';
import type { PaperResult } from '../types';

type SortKey = 'match' | 'cited' | 'recent';
type ViewMode = 'list' | 'gallery';

interface AppliedFilter { facetKey: string; title: string; label: string }

interface Props {
  onModify: () => void;
  onSave: (p: PaperResult) => void;
}

export function PaperResults({ onModify, onSave }: Props) {
  const [sort, setSort] = useState<SortKey>('match');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Record<string, string[]>>({});
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilter[]>([]);
  const [selectedCard, setSelectedCard] = useState<number | null>(0);
  const [appliedFilterRowVisible, setAppliedFilterRowVisible] = useState(false);

  const data = PAPER_SEED;
  const count = 243;
  const appliedQuery = 'TI=(autonomous driving) AND AB=(lidar OR 라이다)';

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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── sri-header ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white shrink-0 flex-wrap">
        <span className="badge badge-gray font-bold text-md2">{count.toLocaleString()}건</span>
        <span
          className="text-xs2 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono cursor-pointer hover:bg-blue-100 transition-colors max-w-xs truncate"
          title={appliedQuery}
        >
          {appliedQuery}
        </span>
        <button onClick={onModify} className="btn-outline btn-xs">
          <Icon name="edit" size={11} /> 검색조건 수정
        </button>
        <span className="flex-1" />
        <select
          className="input py-1 text-sm2 w-28"
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
        >
          <option value="match">매칭순</option>
          <option value="cited">피인용 많은 순</option>
          <option value="recent">최신순</option>
        </select>
        {/* 뷰 토글 */}
        {(['list', 'gallery'] as ViewMode[]).map(v => (
          <button
            key={v}
            onClick={() => setViewMode(v)}
            className={clsx(
              'btn-outline btn-xs',
              viewMode === v && 'bg-blue-50 border-blue-400 text-blue-700',
            )}
          >
            {v === 'list' ? '리스트' : '갤러리(스크리닝)'}
          </button>
        ))}
      </div>

      {/* ── filter-bar ── */}
      <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-gray-100 bg-gray-50 shrink-0 flex-wrap">
        <span className="text-xs2 text-gray-500 font-semibold mr-1">필터</span>
        {PAPER_FACET_GROUPS.map(g => (
          <button
            key={g.key}
            onClick={() => setDrawerOpen(o => !o)}
            className={clsx(
              'btn-outline btn-xs text-xs2',
              (pendingFilters[g.key] || []).length > 0 && 'border-blue-400 text-blue-700 bg-blue-50',
            )}
          >
            {g.title}
            {(pendingFilters[g.key] || []).length > 0 && (
              <span className="ml-1 badge badge-blue text-xs2">{(pendingFilters[g.key] || []).length}</span>
            )}
          </button>
        ))}
        <button
          onClick={() => setDrawerOpen(o => !o)}
          className={clsx('btn-outline btn-xs text-xs2', drawerOpen && 'border-blue-400 text-blue-700 bg-blue-50')}
        >
          모든 필터
        </button>
        <button onClick={resetFilters} className="btn-outline btn-xs text-xs2 text-gray-400">필터 초기화</button>
        <span className="flex-1" />
        <span className="text-xs2 text-gray-400">20개씩 보기</span>
        <button className="btn-outline btn-xs text-xs2">BibTeX</button>
        <button className="btn-outline btn-xs text-xs2">CSV 다운</button>
      </div>

      {/* ── FilterDrawer ── */}
      {drawerOpen && (
        <div className="border-b border-gray-200 bg-white shrink-0">
          <div className="p-4 overflow-y-auto max-h-80 scroll-thin">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {PAPER_FACET_GROUPS.map(g => (
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
              <button className="btn-outline btn-xs" onClick={cancelFilters}>취소</button>
              <button className="btn-primary btn-sm text-xs2" onClick={applyFilters}>적용</button>
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
      {viewMode === 'list' ? (
        <ListResults data={data} selectedCard={selectedCard} onSelect={setSelectedCard} onSave={onSave} />
      ) : (
        <GalleryResults data={data} onSave={onSave} />
      )}
    </div>
  );
}

// ── 2-Column 리스트 + 상세 패널 ──
function ListResults({
  data, selectedCard, onSelect, onSave,
}: {
  data: PaperResult[];
  selectedCard: number | null;
  onSelect: (i: number) => void;
  onSave: (p: PaperResult) => void;
}) {
  const selected = selectedCard != null ? data[selectedCard] : null;

  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      {/* 목록 컬럼 */}
      <div className={clsx(
        'flex-1 overflow-y-auto scroll-thin p-3 bg-gray-50 min-w-0',
        selected && 'max-w-[55%]',
      )}>
        {data.map((p, i) => (
          <div
            key={p.id}
            onClick={() => onSelect(i)}
            className={clsx(
              'card p-3 mb-2 cursor-pointer transition-all hover:shadow-sm',
              selectedCard === i && 'ring-2 ring-blue-500 bg-blue-50/30',
            )}
          >
            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <div className={clsx(
                  'text-base2 font-semibold leading-snug mb-1',
                  selectedCard === i ? 'text-blue-700' : 'text-gray-800 hover:text-blue-700',
                )}>
                  {p.title}
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
                  <div className="text-sm2 text-gray-600 line-clamp-2">{p.abstract}</div>
                )}
                {p.doi && (
                  <div className="text-xs2 text-blue-500 mt-1 font-mono">DOI: {p.doi}</div>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); onSave(p); }}
                className="btn-outline btn-xs h-fit shrink-0"
                title="라이브러리 저장"
              >
                <Icon name="star" size={11} /> 저장
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 우측 인라인 상세 패널 */}
      {selected && (
        <PaperInlineDetail
          paper={selected}
          posLabel={`${(selectedCard ?? 0) + 1} / ${data.length}`}
          onClose={() => onSelect(-1)}
          onSave={() => onSave(selected)}
          onPrev={selectedCard != null && selectedCard > 0 ? () => onSelect(selectedCard - 1) : undefined}
          onNext={selectedCard != null && selectedCard < data.length - 1 ? () => onSelect(selectedCard + 1) : undefined}
        />
      )}
    </div>
  );
}

// ── 논문 인라인 상세 패널 ──
function PaperInlineDetail({
  paper, posLabel, onClose, onSave, onPrev, onNext,
}: {
  paper: PaperResult;
  posLabel: string;
  onClose: () => void;
  onSave: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <aside className="w-[45%] min-w-[320px] max-w-[520px] border-l border-gray-200 bg-white flex flex-col overflow-hidden shrink-0">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 shrink-0 bg-gray-50">
        <button
          onClick={onPrev}
          disabled={!onPrev}
          className="btn-outline btn-xs px-1.5 disabled:opacity-30"
          title="이전 (←)"
        >◀</button>
        <button
          onClick={onNext}
          disabled={!onNext}
          className="btn-outline btn-xs px-1.5 disabled:opacity-30"
          title="다음 (→)"
        >▶</button>
        <span className="text-xs2 text-gray-400 font-mono">{posLabel}</span>
        <span className="flex-1" />
        <button onClick={onSave} className="btn-primary btn-xs">
          <Icon name="star" size={11} /> 저장
        </button>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
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

        {/* AI 요약 */}
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 mb-4">
          <div className="text-xs2 font-semibold text-blue-700 mb-1">🧠 AI 요약</div>
          <p className="text-sm2 text-blue-900">
            {paper.title.includes('Survey') || paper.title.includes('Comprehensive')
              ? '딥러닝 기반 3D 객체 감지 기법의 최신 동향을 종합적으로 분석하며, LiDAR 포인트 클라우드 처리의 핵심 발전 방향을 제시한다.'
              : paper.citationCount && paper.citationCount > 100
              ? `높은 피인용 수(${paper.citationCount})로 해당 분야의 핵심 참고문헌으로 자리잡음. 자율주행 인식 시스템의 기초 방법론을 제시한다.`
              : '자율주행 환경에서 센서 융합 기반 객체 인식 정확도 향상을 위한 새로운 접근법을 제안한다.'}
          </p>
        </div>

        {/* 액션 */}
        <div className="flex gap-2 flex-wrap">
          <button className="btn-outline btn-sm text-xs2">
            <Icon name="link" size={11} /> 전체 보기 ↗
          </button>
          <button onClick={onSave} className="btn-outline btn-sm text-xs2">
            <Icon name="star" size={11} /> 라이브러리 저장
          </button>
          <button className="btn-outline btn-sm text-xs2">
            <Icon name="clipboard" size={11} /> 인용 복사
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── 갤러리 뷰 ──
function GalleryResults({
  data, onSave,
}: {
  data: PaperResult[];
  onSave: (p: PaperResult) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto scroll-thin p-4 bg-gray-50">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {data.map(p => (
          <div key={p.id} className="card p-3 flex flex-col gap-2 hover:shadow-sm transition-shadow cursor-pointer">
            {/* 상단: 저널 배지 */}
            <div className="flex items-center gap-2">
              {p.journal && (
                <span className="badge badge-gray text-xs2 truncate max-w-[140px]">{p.journal}</span>
              )}
              {p.year && <span className="text-xs2 text-gray-400">{p.year}</span>}
              {p.citationCount != null && (
                <span className="ml-auto text-xs2 font-semibold text-amber-600">인용 {p.citationCount}</span>
              )}
            </div>

            {/* 제목 */}
            <div className="text-sm2 font-semibold text-gray-800 leading-snug line-clamp-3">{p.title}</div>

            {/* 저자 */}
            <div className="text-xs2 text-gray-500 truncate">{p.authors}</div>

            {/* 초록 요약 */}
            {p.abstract && (
              <div className="text-xs2 text-gray-600 line-clamp-3 flex-1">{p.abstract}</div>
            )}

            {/* 액션 */}
            <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-gray-100">
              <button className="btn-outline btn-xs text-xs2 flex-1">→ 인용사용</button>
              <button
                onClick={e => { e.stopPropagation(); onSave(p); }}
                className="btn-outline btn-xs text-xs2"
              >
                <Icon name="star" size={10} />
              </button>
              <button className="btn-outline btn-xs text-xs2 text-red-400 hover:border-red-400">👎</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
