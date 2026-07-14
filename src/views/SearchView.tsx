import { useEffect, useRef, useState } from 'react';
import { PATENT_SEED } from '../data/patentSeed';
import { LibrarySaveModal } from '../components/LibrarySaveModal';
import { openDetailTab } from '../features/detailTab';
import { PatentInput, type PatentInputHandle } from './PatentInput';
import { PatentResults } from './PatentResults';
import { PaperInput, type PaperInputHandle } from './PaperInput';
import { PaperResults } from './PaperResults';
import { SiteFooter } from '../components/SiteFooter';
import { useStore } from '../store';
import { toast } from '@muhayu/axp-ui';
import type { PatentResult, PaperResult } from '../types';
import type { MetaFilter } from '../features/search';

type SearchType = 'patent' | 'paper';

export function SearchView() {
  const { searchKind, setSearchKind, libraryAdd } = useStore();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [committedMeta, setCommittedMeta] = useState<MetaFilter | null>(null);
  const patentInputRef = useRef<PatentInputHandle>(null);
  const patentResultsRef = useRef<HTMLDivElement>(null);

  // 논문 검색 — 특허와 대칭(인라인)
  const [paperSearched, setPaperSearched] = useState(false);
  const [paperSearchQuery, setPaperSearchQuery] = useState('');
  const paperInputRef = useRef<PaperInputHandle>(null);
  const paperResultsRef = useRef<HTMLDivElement>(null);

  // 검색 실행 시 결과 영역으로 부드럽게 스크롤 (접지 않고 페이지 스크롤 이동) [검색-92]
  useEffect(() => {
    if (patentSearched && searchType === 'patent') {
      requestAnimationFrame(() => patentResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [patentSearched, searchQuery, searchType]);
  useEffect(() => {
    if (paperSearched && searchType === 'paper') {
      requestAnimationFrame(() => paperResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [paperSearched, paperSearchQuery, searchType]);

  const [saveCtx, setSaveCtx] = useState<{ type: 'patent' | 'paper'; data: PatentResult | PaperResult } | null>(null);

  useEffect(() => {
    setPatentSearched(false);
    setPaperSearched(false);
  }, [searchKind]);

  const openSavePatent = (idx: number) => {
    setSaveCtx({ type: 'patent', data: PATENT_SEED[idx] });
  };
  // 체크박스 일괄 저장 — 미분류로 바로 라이브러리에 추가
  const saveManyPatents = (patents: PatentResult[]) => {
    if (patents.length === 0) return;
    patents.forEach(p => libraryAdd({
      type: 'patent',
      refNumber: p.number,
      title: p.title,
      applicant: p.applicant,
      applicationDate: p.applicationDate,
      abstract: p.abstract,
      tags: [],
      favorite: false,
      data: p,
    }));
    toast(`${patents.length}건을 라이브러리에 저장했습니다`);
  };
  const openSavePaper = (p: PaperResult) => {
    setSaveCtx({ type: 'paper', data: p });
  };
  // 체크박스 일괄 저장 — 미분류로 바로 라이브러리에 추가
  const saveManyPapers = (papers: PaperResult[]) => {
    if (papers.length === 0) return;
    papers.forEach(p => libraryAdd({
      type: 'paper',
      refNumber: p.id,
      title: p.title,
      applicant: p.authors,
      applicationDate: String(p.year || ''),
      abstract: p.abstract,
      tags: [],
      favorite: false,
      data: p,
    }));
    toast(`${papers.length}건을 라이브러리에 저장했습니다`);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">

      {/* 특허 검색 — 입력 + 인라인 결과 (단일 페이지 스크롤) */}
      {searchType === 'patent' && (
        <div className="flex-1 overflow-y-auto scroll-thin flex flex-col">
          <h1 className="sr-only">특허 검색</h1>
          <PatentInput
            ref={patentInputRef}
            onRun={(q, meta) => { setSearchQuery(q); setCommittedMeta(meta); setPatentSearched(true); }}
            carryQuery={searchType === 'patent' ? carryQuery : null}
            onCarryConsumed={() => setCarryQuery(null)}
          />
          {patentSearched && (
            <div ref={patentResultsRef} className="flex flex-col">
              <PatentResults
                onModify={() => setPatentSearched(false)}
                onOpenDetail={no => openDetailTab('patent', no)}
                onSave={openSavePatent}
                onSaveMany={saveManyPatents}
                searchQuery={searchQuery}
                meta={committedMeta}
                onRefine={term => patentInputRef.current?.refine(term)}
                onCrossSearch={kws => crossSearch('paper', kws)}
              />
            </div>
          )}
          <SiteFooter />
        </div>
      )}

      {/* 논문 검색 — 입력 + 인라인 결과 (단일 페이지 스크롤) */}
      {searchType === 'paper' && (
        <div className="flex-1 overflow-y-auto scroll-thin flex flex-col">
          <h1 className="sr-only">논문 검색</h1>
          <PaperInput
            ref={paperInputRef}
            onRun={q => { setPaperSearchQuery(q); setPaperSearched(true); }}
            carryQuery={searchType === 'paper' ? carryQuery : null}
            onCarryConsumed={() => setCarryQuery(null)}
          />
          {paperSearched && (
            <div ref={paperResultsRef} className="flex flex-col">
              <PaperResults
                onModify={() => setPaperSearched(false)}
                onSave={openSavePaper}
                onSaveMany={saveManyPapers}
                onOpenDetail={id => openDetailTab('paper', id)}
                searchQuery={paperSearchQuery}
                onRefine={term => paperInputRef.current?.refine(term)}
                onCrossSearch={kws => crossSearch('patent', kws)}
              />
            </div>
          )}
          <SiteFooter />
        </div>
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
