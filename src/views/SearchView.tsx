import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { PATENT_SEED } from '../data/patentSeed';
import { PatentDetail } from '../components/PatentDetail';
import { LibrarySaveModal } from '../components/LibrarySaveModal';
import { PatentInput, type PatentInputHandle } from './PatentInput';
import { PatentResults } from './PatentResults';
import { PaperInput, type PaperInputHandle } from './PaperInput';
import { PaperResults } from './PaperResults';
import { useStore } from '../store';
import type { PatentResult, PaperResult } from '../types';
import type { MetaFilter } from '../features/search';

type SearchType = 'patent' | 'paper';

export function SearchView() {
  const { searchKind, setSearchKind } = useStore();
  const searchType: SearchType = searchKind;
  // 검색식 이월 — 특허↔논문 교차 시 키워드 이월 [검색-212]
  const [carryQuery, setCarryQuery] = useState<string | null>(null);
  const crossSearch = (toKind: 'patent' | 'paper', keywords: string) => {
    if (!keywords.trim()) return;
    setCarryQuery(keywords.trim());
    setSearchKind(toKind);
  };

  // 특허 검색 — 인라인 결과
  const [patentSearched, setPatentSearched] = useState(false);
  const [patentDetailOpen, setPatentDetailOpen] = useState(false);
  const [detailIdx, setDetailIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [committedMeta, setCommittedMeta] = useState<MetaFilter | null>(null);
  const patentInputRef = useRef<PatentInputHandle>(null);

  // 논문 검색 — 특허와 대칭(인라인)
  const [paperSearched, setPaperSearched] = useState(false);
  const [paperSearchQuery, setPaperSearchQuery] = useState('');
  const paperInputRef = useRef<PaperInputHandle>(null);

  const [saveCtx, setSaveCtx] = useState<{ type: 'patent' | 'paper'; data: PatentResult | PaperResult } | null>(null);

  useEffect(() => {
    setPatentSearched(false);
    setPatentDetailOpen(false);
    setPaperSearched(false);
  }, [searchKind]);

  const openSavePatent = (idx: number) => {
    setSaveCtx({ type: 'patent', data: PATENT_SEED[idx] });
  };
  const openSavePaper = (p: PaperResult) => {
    setSaveCtx({ type: 'paper', data: p });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">

      {/* 특허 검색 — 전체화면 상세 */}
      {searchType === 'patent' && patentDetailOpen && (
        <PatentDetail
          data={PATENT_SEED[detailIdx]}
          searchQuery={searchQuery}
          onBack={() => setPatentDetailOpen(false)}
          posLabel={`${detailIdx + 1} / ${PATENT_SEED.length}`}
          onSave={() => openSavePatent(detailIdx)}
          onPrev={detailIdx > 0 ? () => setDetailIdx(detailIdx - 1) : undefined}
          onNext={detailIdx < PATENT_SEED.length - 1 ? () => setDetailIdx(detailIdx + 1) : undefined}
        />
      )}

      {/* 특허 검색 — 입력 + 인라인 결과 */}
      {searchType === 'patent' && !patentDetailOpen && (
        <>
          {/* 검색 입력: 검색 전 전체 높이, 검색 후 상단 고정 */}
          <div className={clsx(
            'overflow-y-auto scroll-thin',
            patentSearched
              ? 'shrink-0 max-h-[280px] border-b border-gray-100'
              : 'flex-1'
          )}>
            <PatentInput
              ref={patentInputRef}
              onRun={(q, meta) => { setSearchQuery(q); setCommittedMeta(meta); setPatentSearched(true); }}
              carryQuery={searchType === 'patent' ? carryQuery : null}
              onCarryConsumed={() => setCarryQuery(null)}
            />
          </div>

          {/* 인라인 검색 결과 */}
          {patentSearched && (
            <PatentResults
              onModify={() => setPatentSearched(false)}
              onOpenDetail={i => { setDetailIdx(i); setPatentDetailOpen(true); }}
              onSave={openSavePatent}
              searchQuery={searchQuery}
              meta={committedMeta}
              onRefine={term => patentInputRef.current?.refine(term)}
              onCrossSearch={kws => crossSearch('paper', kws)}
            />
          )}
        </>
      )}

      {/* 논문 검색 — 입력 + 인라인 결과 (특허와 대칭) */}
      {searchType === 'paper' && (
        <>
          <div className={clsx(
            'overflow-y-auto scroll-thin',
            paperSearched ? 'shrink-0 max-h-[280px] border-b border-gray-100' : 'flex-1'
          )}>
            <PaperInput
              ref={paperInputRef}
              onRun={q => { setPaperSearchQuery(q); setPaperSearched(true); }}
              carryQuery={searchType === 'paper' ? carryQuery : null}
              onCarryConsumed={() => setCarryQuery(null)}
            />
          </div>
          {paperSearched && (
            <PaperResults
              onModify={() => setPaperSearched(false)}
              onSave={openSavePaper}
              searchQuery={paperSearchQuery}
              onRefine={term => paperInputRef.current?.refine(term)}
              onCrossSearch={kws => crossSearch('patent', kws)}
            />
          )}
        </>
      )}

      <LibrarySaveModal
        open={!!saveCtx}
        context={saveCtx ? (
          saveCtx.type === 'patent'
            ? {
                type: 'patent',
                refNumber: (saveCtx.data as PatentResult).number,
                title: (saveCtx.data as PatentResult).title,
                applicant: (saveCtx.data as PatentResult).applicant,
                applicationDate: (saveCtx.data as PatentResult).applicationDate,
                abstract: (saveCtx.data as PatentResult).abstract,
                data: saveCtx.data,
              }
            : {
                type: 'paper',
                refNumber: (saveCtx.data as PaperResult).id,
                title: (saveCtx.data as PaperResult).title,
                applicant: (saveCtx.data as PaperResult).authors,
                applicationDate: String((saveCtx.data as PaperResult).year || ''),
                abstract: (saveCtx.data as PaperResult).abstract,
                data: saveCtx.data,
              }
        ) : null}
        onClose={() => setSaveCtx(null)}
      />
    </div>
  );
}
