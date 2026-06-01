import { useEffect, useState } from 'react';
import { PATENT_SEED } from '../data/patentSeed';
import { PatentDetail } from '../components/PatentDetail';
import { LibrarySaveModal } from '../components/LibrarySaveModal';
import { PatentInput } from './PatentInput';
import { PatentResults } from './PatentResults';
import { PaperInput } from './PaperInput';
import { PaperResults } from './PaperResults';
import { useStore } from '../store';
import type { PatentResult, PaperResult } from '../types';

// 원본: 특허/논문 탭은 작업 타입으로 결정되므로 제거됨
type SearchType = 'patent' | 'paper';
type Stage = 'input' | 'results' | 'detail';

export function SearchView() {
  const { tasks, activeTaskId } = useStore();
  const activeTask = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;
  const searchType: SearchType = activeTask?.type === 'paper_search' ? 'paper' : 'patent';
  const [stage, setStage] = useState<Stage>('input');
  const [detailIdx, setDetailIdx] = useState(0);
  const [saveCtx, setSaveCtx] = useState<{ type: 'patent' | 'paper'; data: PatentResult | PaperResult } | null>(null);

  // activeTask 변경 시 입력 단계로 리셋
  useEffect(() => {
    if (!activeTask) return;
    setStage('input');
  }, [activeTask?.id, activeTask?.type]);

  const openSavePatent = (idx: number) => {
    setSaveCtx({ type: 'patent', data: PATENT_SEED[idx] });
  };
  const openSavePaper = (p: PaperResult) => {
    setSaveCtx({ type: 'paper', data: p });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* 원본: 특허/논문 탭 없음 — task type으로 자동 분기 */}
      {stage === 'input' && searchType === 'patent' && (
        <PatentInput onRun={() => setStage('results')} />
      )}
      {stage === 'input' && searchType === 'paper' && (
        <PaperInput onRun={() => setStage('results')} />
      )}
      {stage === 'results' && searchType === 'patent' && (
        <PatentResults
          onModify={() => setStage('input')}
          onOpenDetail={(i) => { setDetailIdx(i); setStage('detail'); }}
          onSave={openSavePatent}
        />
      )}
      {stage === 'results' && searchType === 'paper' && (
        <PaperResults onModify={() => setStage('input')} onSave={openSavePaper} />
      )}
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

