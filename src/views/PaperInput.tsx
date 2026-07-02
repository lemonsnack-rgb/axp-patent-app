// 논문 검색 입력 — 특허(PatentInput)와 대칭: 단일 검색식 + 범위탭 + 검색필드 패널 + 검색 히스토리
// 자체 구축 DB 기준(외부 PubMed/Scopus 아님). 필드: 제목/초록/키워드/전문/저자.
import { useState, useRef, useImperativeHandle, useEffect, forwardRef } from 'react';
import clsx from 'clsx';
import { Button } from '@muhayu/axp-ui';
import { accumulateQuery, applyScope, type SFieldInput } from '../features/search';
import { useStore } from '../store';
import { Icon } from '../components/Icon';

interface PField { code: string; label: string; value: string; hint?: string }

const DEFAULT_FIELDS: PField[] = [
  { code: 'TI',  label: '제목',   value: '', hint: '예: 그래핀 and 배터리 | "신경망"' },
  { code: 'AB',  label: '초록',   value: '', hint: '예: 그래핀 and 배터리' },
  { code: 'KWD', label: '키워드', value: '', hint: '예: 리튬*' },
  { code: 'DSC', label: '전문',   value: '', hint: '제목·초록·본문 전체' },
  { code: 'AP',  label: '저자',   value: '', hint: '예: 김한국 | 이*' },
];

// 범위탭 — 데모 papers 기준
type PaperScope = 'TI_AB' | 'TI_AB_FULL';
const SCOPE_TABS: { id: PaperScope; label: string }[] = [
  { id: 'TI_AB',      label: '제목+초록' },
  { id: 'TI_AB_FULL', label: '제목+초록+전문' },
];

const PERIODS = [
  { id: 'all', label: '전체' },
  { id: '1y',  label: '최근 1년' },
  { id: '5y',  label: '최근 5년' },
  { id: '10y', label: '최근 10년' },
];

interface Props {
  onRun: (execQuery: string) => void;
  carryQuery?: string | null;   // 특허→논문 검색식 이월 [검색-212]
  onCarryConsumed?: () => void;
}
export interface PaperInputHandle { refine: (term: string) => void }

function histTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const PaperInput = forwardRef<PaperInputHandle, Props>(function PaperInput({ onRun, carryQuery, onCarryConsumed }, ref) {
  const { searchHistory, searchHistoryAdd, searchHistoryRemove, searchHistoryClear, searchHistoryTogglePin } = useStore();
  const paperHistory = searchHistory
    .filter(e => e.kind === 'paper')
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const [historyOpen, setHistoryOpen] = useState(true);

  const [scope, setScope] = useState<PaperScope>('TI_AB');
  const [periodChip, setPeriodChip] = useState('all');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [formulaText, setFormulaText] = useState('');
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [histPage, setHistPage] = useState(1);
  const [fields, setFields] = useState<PField[]>(DEFAULT_FIELDS);

  const updateField = (idx: number, value: string) =>
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, value } : f));

  const toFieldInputs = (): SFieldInput[] =>
    fields.map(f => ({ code: f.code, type: 'text' as const, value: f.value }));

  const handleSearch = () => {
    // 목업: 검색어가 없어도 검색 버튼만 누르면 전체 결과가 나오도록 허용
    const fieldInputs = toFieldInputs();
    const accumulated = accumulateQuery(formulaText, fieldInputs);
    setFormulaText(accumulated);
    setFields(prev => prev.map(f => ({ ...f, value: '' })));
    setFieldsOpen(false);
    const execQuery = applyScope(accumulated, scope);
    searchHistoryAdd('paper', execQuery);
    onRun(execQuery);
  };

  // 목업: 검색어 무관하게 검색 버튼은 항상 활성화
  const canSearch = true;

  const resetAll = () => {
    setFormulaText('');
    setFields(DEFAULT_FIELDS.map(f => ({ ...f, value: '' })));
  };

  const rerun = (q: string) => {
    setFormulaText(q);
    setFields(prev => prev.map(f => ({ ...f, value: '' })));
    setFieldsOpen(false);
    searchHistoryAdd('paper', q);
    onRun(q);
  };

  const live = useRef<{ formulaText: string; scope: PaperScope; add: typeof searchHistoryAdd; onRun: Props['onRun'] }>(null!);
  live.current = { formulaText, scope, add: searchHistoryAdd, onRun };
  useImperativeHandle(ref, () => ({
    refine: (term: string) => {
      const t = term.trim();
      if (!t) return;
      const s = live.current;
      const accumulated = s.formulaText.trim() ? `${s.formulaText} AND (${t})` : `(${t})`;
      setFormulaText(accumulated);
      setFields(prev => prev.map(f => ({ ...f, value: '' })));
      setFieldsOpen(false);
      const execQuery = applyScope(accumulated, s.scope);
      s.add('paper', execQuery);
      s.onRun(execQuery);
    },
  }), []);

  // 검색식 이월 수신 — 특허에서 넘어온 키워드로 즉시 검색 [검색-212]
  useEffect(() => {
    if (!carryQuery) return;
    setFormulaText(carryQuery);
    setFields(prev => prev.map(f => ({ ...f, value: '' })));
    const execQuery = applyScope(carryQuery, scope);
    searchHistoryAdd('paper', execQuery);
    onRun(execQuery);
    onCarryConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carryQuery]);

  return (
    <div className="bg-white">
      {/* 기간 */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-gray-200 flex-wrap">
        <span className="text-xs2 font-semibold text-gray-500 shrink-0">발행연도</span>
        {PERIODS.map(p => (
          <Chip key={p.id} active={periodChip === p.id} onClick={() => { setPeriodChip(p.id); setYearFrom(''); setYearTo(''); }}>{p.label}</Chip>
        ))}
        <div className="flex items-center gap-1.5">
          <input type="number" placeholder="YYYY" value={yearFrom} onChange={e => { setYearFrom(e.target.value); setPeriodChip(''); }}
            className="w-20 px-2 border border-gray-200 rounded text-xs2 h-7 outline-none focus:border-blue-400" />
          <span className="text-gray-400 text-xs2">~</span>
          <input type="number" placeholder="YYYY" value={yearTo} onChange={e => { setYearTo(e.target.value); setPeriodChip(''); }}
            className="w-20 px-2 border border-gray-200 rounded text-xs2 h-7 outline-none focus:border-blue-400" />
        </div>
      </div>

      {/* 검색식 영역 */}
      <div className="p-4 space-y-2">
        {/* 범위탭 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex border border-gray-200 rounded-md overflow-hidden">
            {SCOPE_TABS.map(tab => (
              <button key={tab.id} onClick={() => setScope(tab.id)}
                className={clsx('inline-flex items-center h-7 px-3 text-xs2 font-medium border-r border-gray-200 last:border-r-0 transition-colors',
                  scope === tab.id ? 'bg-brand-400 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 검색식 + 우측 액션 버튼 */}
        <div className="flex items-stretch gap-2">
          <textarea
            value={formulaText}
            onChange={e => setFormulaText(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder='예: 자율주행 and 라이다 | "object detection"'
            className="flex-1 min-w-0 resize-y rounded border border-gray-300 p-2 font-mono text-sm leading-6 outline-none focus:border-blue-500 placeholder:text-gray-400"
          />
          <div className="shrink-0 w-[88px] flex flex-col gap-1.5">
            <Button variant="filled" color="primary" size="sm" className="text-sm2 flex-1 !h-auto min-h-[36px]" disabled={!canSearch} onClick={handleSearch}>검색</Button>
            <Button variant="outlined" color="primary" size="sm" className="text-sm2 shrink-0" onClick={resetAll}>초기화</Button>
          </div>
        </div>
      </div>

      {/* 검색필드 패널 (검색창 바로 아래 — 입력이 검색식에 반영) */}
      <div className="border-t border-gray-200">
        <button onClick={() => setFieldsOpen(v => !v)}
          aria-expanded={fieldsOpen}
          className={clsx('w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm2 font-semibold border-b transition-colors',
            fieldsOpen ? 'text-gray-700 border-gray-100 hover:bg-gray-50' : 'text-brand-600 bg-blue-50 border-blue-100 hover:bg-blue-100')}>
          <span className="flex items-center gap-1.5 min-w-0">
            <Icon name="chevron-down" size={14} className={clsx('shrink-0 text-brand-400 transition-transform', fieldsOpen && 'rotate-180')} />
            항목별 검색필드
            {!fieldsOpen && <span className="text-xs2 font-normal text-gray-500 truncate">— 제목·초록·키워드·저자 등 필드별 입력</span>}
          </span>
          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-brand-300 bg-white text-xs2 font-semibold text-brand-500">
            {fieldsOpen ? '접기' : '펼쳐서 입력'}
            <Icon name="chevron-down" size={11} className={clsx('transition-transform', fieldsOpen && 'rotate-180')} />
          </span>
        </button>
        {fieldsOpen && (
          <div className="px-4 pb-3 pt-1 space-y-px">
            {fields.map((f, idx) => (
              <div key={f.code} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 group">
                <span className="text-xs2 font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0 min-w-[40px] text-center">{f.code}</span>
                <span className="text-sm2 text-gray-700 shrink-0 w-[72px]">{f.label}</span>
                <input type="text" value={f.value} onChange={e => updateField(idx, e.target.value)} placeholder={f.hint || ''}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-200 rounded text-sm2 outline-none focus:border-blue-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 검색 히스토리 (검색필드 아래) */}
      {paperHistory.length > 0 && (
        <div className="border-t border-gray-200">
          <button onClick={() => setHistoryOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm2 font-semibold text-gray-700 hover:bg-gray-50">
            <span className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs2">🕘</span>
              검색 히스토리
              <span className="text-xs2 font-medium text-brand-400 bg-blue-50 px-1.5 py-0 rounded-full leading-5">{paperHistory.length}</span>
            </span>
            <span className="text-gray-400 text-xs2">{historyOpen ? '▲' : '▼'}</span>
          </button>
          {historyOpen && (
            <div className="px-4 pb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs2 text-gray-400">검색식 최대 100개 누적</span>
                <button onClick={() => searchHistoryClear('paper')} className="text-xs2 text-gray-400 hover:text-red-500">전체 삭제</button>
              </div>
              {/* 컬럼 헤더 — 검색식 / 검색일시 구분 */}
              <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-200 text-xs2 font-semibold text-gray-400">
                <span className="w-4 shrink-0" />
                <span className="flex-1 min-w-0">검색식</span>
                <span className="w-28 shrink-0">검색일시</span>
                <span className="w-[52px] shrink-0 text-center">재검색</span>
                <span className="w-5 shrink-0" />
              </div>
              <div>
                {paperHistory.slice((histPage - 1) * 10, histPage * 10).map(e => (
                  <div key={e.id} className={clsx('group flex items-center gap-2 py-1.5 px-2 border-b border-gray-50 hover:bg-gray-50', e.pinned && 'bg-amber-50/40')}>
                    <button onClick={() => searchHistoryTogglePin(e.id)}
                      className={clsx('w-4 shrink-0 leading-none', e.pinned ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400')}
                      title={e.pinned ? '저장 해제' : '검색 저장 (★)'}>★</button>
                    <button onClick={() => rerun(e.query)} className="flex-1 min-w-0 text-left font-mono text-xs2 text-brand-400 truncate" title="이 검색식으로 재검색">{e.query}</button>
                    <span className="w-28 shrink-0 text-xs2 text-gray-400 font-mono">{histTime(e.at)}</span>
                    <button onClick={() => rerun(e.query)} className="w-[52px] shrink-0 text-xs2 px-2 py-0.5 border border-blue-200 bg-blue-50 text-brand-400 rounded hover:bg-blue-100 text-center">재검색</button>
                    <button onClick={() => searchHistoryRemove(e.id)} className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-500 rounded shrink-0 opacity-0 group-hover:opacity-100" title="삭제">×</button>
                  </div>
                ))}
              </div>
              {paperHistory.length > 10 && (
                <div className="flex items-center justify-center gap-1 pt-2 text-sm2">
                  <button onClick={() => setHistPage(p => Math.max(1, p - 1))} disabled={histPage === 1} className="px-1.5 py-0.5 border border-gray-300 rounded text-gray-500 hover:border-blue-400 disabled:opacity-30">‹</button>
                  {Array.from({ length: Math.ceil(paperHistory.length / 10) }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setHistPage(p)} className={clsx('w-6 h-6 rounded border text-xs2 font-mono', p === histPage ? 'bg-blue-400 text-white border-blue-400' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}>{p}</button>
                  ))}
                  <button onClick={() => setHistPage(p => Math.min(Math.ceil(paperHistory.length / 10), p + 1))} disabled={histPage >= Math.ceil(paperHistory.length / 10)} className="px-1.5 py-0.5 border border-gray-300 rounded text-gray-500 hover:border-blue-400 disabled:opacity-30">›</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 안내 */}
      {paperHistory.length === 0 && (
        <div className="flex items-center justify-center py-10 text-gray-400">
          <div className="text-center max-w-lg">
            <p className="text-sm2 font-medium mb-1">논문 검색식을 입력하고 [검색] 버튼을 누르세요</p>
            <p className="text-xs2 text-gray-300">
              자체 구축 논문 DB 검색 · 불리언 연산자(AND/OR/NOT), 와일드카드(*) 지원
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      aria-pressed={!!active}
      className={clsx('inline-flex items-center gap-0.5 h-7 rounded-full border transition-colors font-medium px-3 text-xs2',
        active ? 'bg-brand-400 text-white border-brand-400' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-brand-400')}>
      {/* 색상 외 선택 표시(WCAG 1.4.1) — 활성 시 체크 */}
      {active && <span aria-hidden className="-ml-0.5 leading-none font-bold">✓</span>}
      {children}
    </button>
  );
}
