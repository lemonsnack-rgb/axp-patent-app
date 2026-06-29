// 특허 검색 입력 영역 — 데모(http://10.77.0.244:8010/patents) 방식
// Config 2줄 압축 + 검색필드 그룹 탭 (텍스트/분류코드/인명/번호/일자)
import { useState, useRef, useImperativeHandle, useEffect, forwardRef } from 'react';
import clsx from 'clsx';
import { toast, Button } from '@muhayu/axp-ui';
import { FinderModal, type FinderType } from '../components/FinderModal';
import {
  COUNTRY_LIST, COUNTRY_ADDITIONAL, PATENT_PERIODS,
  PATENT_DOC_KINDS, PATENT_STATUS_ACTIVE, PATENT_STATUS_INACTIVE,
} from '../data/patentFields';
import { accumulateQuery, applyScope, hasSearchInput, type ScopeTab, type SFieldInput, type MetaFilter } from '../features/search';
import { useStore } from '../store';

// ── 검색필드 타입 ──────────────────────────────────────────────
interface SField {
  code: string;
  label: string;
  value: string;
  type: 'text' | 'date-range' | 'ipc';
  ipcScope?: 'all' | 'current';
  finderType?: FinderType;
  finderLabel?: string;
  hint?: string;
  dateFrom?: string;
  dateTo?: string;
}

const DEFAULT_FIELDS: SField[] = [
  { code: 'TI',   label: '발명의 명칭',       value: '', type: 'text',       hint: '예: 하이브리드 and 자동차 | *수소 자동차*' },
  { code: 'AB',   label: '요약',              value: '', type: 'text',       hint: '예: 하이브리드 and 자동차 | "전기 자동차"' },
  { code: 'CL',   label: '대표청구항',        value: '', type: 'text',       hint: '하이브리드 and 자동차' },
  { code: 'CLI',  label: '독립청구항',        value: '', type: 'text' },
  { code: 'CLA',  label: '전체청구항',        value: '', type: 'text' },
  { code: 'DSC',  label: '상세설명',          value: '', type: 'text',       hint: '딥러닝 and 검색 and 알고리즘' },
  { code: 'IPCR', label: 'IPC (Main)',        value: '', type: 'ipc',  ipcScope: 'all', finderType: 'ipc', finderLabel: 'IPC 코드찾기', hint: 'H04L-009/18% | G06F*' },
  { code: 'CPCR', label: 'CPC (Main)',        value: '', type: 'ipc',  ipcScope: 'all', finderType: 'ipc', finderLabel: 'CPC 코드찾기', hint: 'C12P-0007/02% | C01C*' },
  { code: 'AP',   label: '출원인',            value: '', type: 'text',       hint: '엘지* | 119990527105' },
  { code: 'APD',  label: '출원인 주소',       value: '', type: 'text',       hint: '서울 | 용산' },
  { code: 'INV',  label: '발명자',            value: '', type: 'text',       hint: '김한국 | 김만*' },
  { code: 'AG',   label: '대리인',            value: '', type: 'text',       hint: '특허법인* | 김남구' },
  { code: 'AN',   label: '출원번호',          value: '', type: 'text',       hint: '1020080012345' },
  { code: 'PN',   label: '공개번호/특허번호', value: '', type: 'text',       hint: '1020100012345' },
  { code: 'RN',   label: '등록번호',          value: '', type: 'text',       hint: '1012345670000' },
  { code: 'AD',   label: '출원일',            value: '', type: 'date-range', dateFrom: '', dateTo: '', hint: '20080101 ~ 20081231' },
  { code: 'PD',   label: '공개일/특허일',     value: '', type: 'date-range', dateFrom: '', dateTo: '' },
  { code: 'RD',   label: '등록일',            value: '', type: 'date-range', dateFrom: '', dateTo: '' },
];

// ── 검색필드 그룹 탭 ─────────────────────────────────────────
const FIELD_GROUPS = [
  { id: '텍스트',   codes: ['TI', 'AB', 'CL', 'CLI', 'CLA', 'DSC'] },
  { id: '분류코드', codes: ['IPCR', 'CPCR'] },
  { id: '인명',     codes: ['AP', 'APD', 'INV', 'AG'] },
  { id: '번호',     codes: ['AN', 'PN', 'RN'] },
  { id: '일자',     codes: ['AD', 'PD', 'RD'] },
] as const;

// ── 토크나이저 ────────────────────────────────────────────────
type TokenType = 'field' | 'operator' | 'colon' | 'paren' | 'keyword' | 'space';
interface Token { type: TokenType; text: string }

const FIELD_RE = /^(TI|AB|CL[AI1]?|DSC|KEY|WPS|AP[D]?|INV|AG|AN|PN|RN|AD|PD|RD|IPC[RM]?|CPC[RM]?|TI_AB_CLI|TI_AB_CLA|DOCN|IDX)$/i;
// 진단용 — 위 필드 + 범위코드(KEY_CLI/KEY_CLA) 포함
const KNOWN_FIELD_RE = /^(TI|AB|CL[AI1]?|DSC|KEY(_CLI|_CLA)?|WPS|AP[D]?|INV|AG|AN|PN|RN|AD|PD|RD|IPC[RM]?|CPC[RM]?|TI_AB_CLI|TI_AB_CLA|DOCN|IDX)$/i;
const OP_RE    = /^(and|or|not|adj\d*|near\d*)$/i;

// 편집기모드 실시간 진단 — 경고만, 실행은 막지 않는다 [검색-11·12]
function diagnose(text: string): string[] {
  const w: string[] = [];
  let depth = 0, parenBad = false;
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth < 0) { parenBad = true; break; } }
  }
  if (parenBad || depth !== 0) w.push('괄호 ( ) 짝이 맞지 않습니다.');
  const unknown = new Set<string>();
  for (const m of text.match(/([A-Za-z_][A-Za-z0-9_]*)\s*[:=]/g) || []) {
    const code = m.replace(/\s*[:=]$/, '');
    if (!KNOWN_FIELD_RE.test(code)) unknown.add(code);
  }
  if (unknown.size) w.push(`알 수 없는 필드: ${[...unknown].join(', ')}`);
  return w;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /([A-Za-z_][A-Za-z0-9_]*)|([가-힣])|([:()\[\]*?!|"])|(\s+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const [, word, hangul, special, space, other] = m;
    if (word) {
      if (FIELD_RE.test(word))    tokens.push({ type: 'field',    text: word });
      else if (OP_RE.test(word))  tokens.push({ type: 'operator', text: word });
      else                        tokens.push({ type: 'keyword',  text: word });
    } else if (hangul) {
      tokens.push({ type: 'keyword', text: hangul });
    } else if (special) {
      if (special === ':')                          tokens.push({ type: 'colon',   text: special });
      else if (special === '(' || special === ')')  tokens.push({ type: 'paren',   text: special });
      else                                          tokens.push({ type: 'keyword', text: special });
    } else if (space) {
      tokens.push({ type: 'space', text: space });
    } else if (other) {
      tokens.push({ type: 'keyword', text: other });
    }
  }
  return tokens;
}

const TOKEN_CLS: Record<TokenType, string> = {
  field:    'text-brand-400 font-medium',
  operator: 'text-brand-400 font-medium',
  colon:    'text-red-600',
  paren:    'text-slate-500',
  keyword:  'text-red-600',
  space:    'text-slate-700',
};

// ── FormulaEditor ─────────────────────────────────────────────
function FormulaEditor({ value, onChange, rows = 3, placeholder = '' }: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const tokens = tokenize(value);
  return (
    <div className="relative font-mono text-sm leading-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words rounded border border-transparent p-2 leading-6 text-transparent select-none overflow-hidden"
      >
        {tokens.map((tok, i) => <span key={i}>{tok.text}</span>)}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words rounded border border-transparent p-2 leading-6 select-none overflow-hidden"
      >
        {tokens.map((tok, i) => (
          <span key={i} className={TOKEN_CLS[tok.type]}>{tok.text}</span>
        ))}
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
        placeholder={placeholder}
        className="relative w-full resize-y rounded border border-gray-300 bg-transparent p-2 leading-6 text-transparent caret-gray-900 outline-none focus:border-blue-500 placeholder:text-gray-400"
      />
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────
interface Props {
  onRun: (execQuery: string, meta: MetaFilter) => void;
  carryQuery?: string | null;   // 논문→특허 검색식 이월 [검색-212]
  onCarryConsumed?: () => void;
}

// 결과 화면의 "결과 내 검색"이 호출할 수 있도록 노출하는 핸들
export interface PatentInputHandle { refine: (term: string) => void }

// ── 스코프 탭 ────────────────────────────────────────────────
const KEY_TABS: { id: ScopeTab; label: string }[] = [
  { id: 'KEY_CLI', label: '명칭+요약+독립청구항' },
  { id: 'KEY_CLA', label: '명칭+요약+전체청구항' },
  { id: 'DSC',     label: '상세설명' },
];

// ── Main ──────────────────────────────────────────────────────
export const PatentInput = forwardRef<PatentInputHandle, Props>(function PatentInput({ onRun, carryQuery, onCarryConsumed }, ref) {
  const { searchHistory, searchHistoryAdd, searchHistoryRemove, searchHistoryClear, searchHistoryTogglePin } = useStore();
  // 저장(pinned)된 검색을 상단에, 나머지는 최신순(삽입순) 유지
  const patentHistory = searchHistory
    .filter(e => e.kind === 'patent')
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const [historyOpen, setHistoryOpen] = useState(false);

  // 국가
  const [countries, setCountries] = useState<Record<string, boolean>>({ KR: true, US: true });
  const [extraCountries, setExtraCountries] = useState<string[]>([]);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [pickerSel, setPickerSel] = useState<Record<string, boolean>>({});

  // 문헌종류
  const [docKinds, setDocKinds] = useState<string[]>(['공개', '등록']);

  // 기간
  const [periodChip, setPeriodChip] = useState<string>('5y');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');

  // 상태정보
  const [statusAll, setStatusAll] = useState(true);
  const [statusActive, setStatusActive] = useState<string[]>([]);
  const [statusInactive, setStatusInactive] = useState<string[]>([]);

  // 스코프 탭
  const [keyTab, setKeyTab] = useState<ScopeTab>('KEY_CLI');

  // 입력모드
  const [mode, setMode] = useState<'normal' | 'editor'>('normal');

  // 검색식
  const [formulaText, setFormulaText] = useState('');

  // 검색필드 섹션 — 기본 접힘
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [fieldGroup, setFieldGroup] = useState<string>('텍스트');
  const [fields, setFields] = useState<SField[]>(DEFAULT_FIELDS);

  // 파인더
  const [finderOpen, setFinderOpen] = useState<{ type: FinderType; fieldIdx: number } | null>(null);
  const [addFieldOpen, setAddFieldOpen] = useState(false);

  // 국가 핸들러
  const toggleCountry = (code: string) => setCountries(prev => ({ ...prev, [code]: !prev[code] }));
  const removeExtraCountry = (cc: string) => setExtraCountries(prev => prev.filter(c => c !== cc));
  const applyCountryPicker = () => {
    const selected = Object.keys(pickerSel).filter(k => pickerSel[k]);
    setExtraCountries(prev => Array.from(new Set([...prev, ...selected])));
    setCountryPickerOpen(false);
    setPickerSel({});
    if (selected.length) toast(`추가 국가 ${selected.length}개 적용`);
  };

  const toggleDocKind = (k: string) => setDocKinds(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  const togglePeriod = (p: string) => { setPeriodChip(prev => prev === p ? '' : p); setPeriodFrom(''); setPeriodTo(''); };
  const onCustomDate = () => setPeriodChip('');

  const toggleAllStatus = () => {
    const newAll = !statusAll;
    setStatusAll(newAll);
    if (newAll) { setStatusActive([]); setStatusInactive([]); }
  };
  const toggleStatusActive = (s: string) => {
    setStatusAll(false);
    setStatusActive(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };
  const toggleStatusInactive = (s: string) => {
    setStatusAll(false);
    setStatusInactive(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  // 검색필드 핸들러
  const updateField = (idx: number, patch: Partial<SField>) =>
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));

  // [검색-40·41] 현재 메타필터 선택값 묶음
  const buildMeta = (): MetaFilter => ({
    countries: Object.keys(countries).filter(k => countries[k]),
    docKinds,
    statusAll, statusActive, statusInactive,
    periodChip, periodFrom, periodTo,
  });

  const handleSearch = () => {
    // [검색-51] 검색식·필드 모두 비면 실행하지 않음 (버튼도 disabled)
    const fieldInputs: SFieldInput[] = fields.map(f => ({
      code: f.code, type: f.type, value: f.value, dateFrom: f.dateFrom, dateTo: f.dateTo,
    }));
    if (!hasSearchInput(formulaText, fieldInputs)) return;

    // [검색-60~63] 필드 절을 기존 검색식에 AND 누적 → 입력창에 반영
    const accumulated = accumulateQuery(formulaText, fieldInputs);
    setFormulaText(accumulated);

    // [검색-62] 검색 후 필드 입력값만 비움 (필드 구성은 유지 [검색-70])
    setFields(prev => prev.map(f => ({ ...f, value: '', dateFrom: '', dateTo: '' })));

    // [검색-72] 검색 후 검색필드 패널 자동 접힘
    setFieldsOpen(false);

    // [검색-20~22] 범위탭을 선두 자유검색어에만 적용한 "실행 검색식"
    const execQuery = applyScope(accumulated, keyTab);

    searchHistoryAdd('patent', execQuery);
    onRun(execQuery, buildMeta());
  };

  // 검색 히스토리 항목 재실행 — 저장된 실행 검색식을 그대로 다시 조회
  const rerun = (q: string) => {
    setFormulaText(q);
    setFields(prev => prev.map(f => ({ ...f, value: '', dateFrom: '', dateTo: '' })));
    setFieldsOpen(false);
    searchHistoryAdd('patent', q);
    onRun(q, buildMeta());
  };

  // 결과 내 검색 — 현재 검색식에 (term)을 AND로 덧붙여 다시 조회
  const live = useRef<{ formulaText: string; keyTab: ScopeTab; buildMeta: () => MetaFilter; onRun: Props['onRun']; add: typeof searchHistoryAdd }>(null!);
  live.current = { formulaText, keyTab, buildMeta, onRun, add: searchHistoryAdd };
  useImperativeHandle(ref, () => ({
    refine: (term: string) => {
      const t = term.trim();
      if (!t) return;
      const s = live.current;
      const accumulated = s.formulaText.trim() ? `${s.formulaText} AND (${t})` : `(${t})`;
      setFormulaText(accumulated);
      setFields(prev => prev.map(f => ({ ...f, value: '', dateFrom: '', dateTo: '' })));
      setFieldsOpen(false);
      const execQuery = applyScope(accumulated, s.keyTab);
      s.add('patent', execQuery);
      s.onRun(execQuery, s.buildMeta());
    },
  }), []);

  // 검색식 이월 수신 — 논문에서 넘어온 키워드로 즉시 검색 [검색-212]
  useEffect(() => {
    if (!carryQuery) return;
    setFormulaText(carryQuery);
    setFields(prev => prev.map(f => ({ ...f, value: '', dateFrom: '', dateTo: '' })));
    const execQuery = applyScope(carryQuery, keyTab);
    searchHistoryAdd('patent', execQuery);
    onRun(execQuery, buildMeta());
    onCarryConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carryQuery]);

  const canSearch = hasSearchInput(
    formulaText,
    fields.map(f => ({ code: f.code, type: f.type, value: f.value, dateFrom: f.dateFrom, dateTo: f.dateTo })),
  );

  const resetAll = () => {
    setFormulaText('');
    setFields(DEFAULT_FIELDS.map(f => ({ ...f, value: '', dateFrom: '', dateTo: '' })));
  };

  // 현재 그룹 필드 (실제 fields 인덱스 포함)
  const groupCodes = FIELD_GROUPS.find(g => g.id === fieldGroup)?.codes ?? [];
  const visibleEntries = fields
    .map((f, idx) => ({ f, idx }))
    .filter(({ f }) => (groupCodes as readonly string[]).includes(f.code));

  return (
    <div className="bg-white">

      {/* ── 검색 설정 (2행 압축) ─────────────────────────────── */}
      <div className="border-b border-gray-200 relative">

        {/* Row 1: 국가 | 문헌종류 */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-gray-100 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs2 font-semibold text-gray-500 shrink-0">국가</span>
            <Chip
              active={Object.values(countries).every(v => !v) && extraCountries.length === 0}
              onClick={() => { setCountries({}); setExtraCountries([]); }}
              size="xs"
            >전체</Chip>
            {COUNTRY_LIST.map(c => (
              <Chip key={c.code} active={!!countries[c.code]} onClick={() => toggleCountry(c.code)} size="xs">{c.label}</Chip>
            ))}
            {extraCountries.map(cc => (
              <span key={cc} className="inline-flex items-center gap-0.5 px-2 py-0 bg-brand-400 text-white rounded-full text-xs2 font-medium">
                {cc}
                <button onClick={() => removeExtraCountry(cc)} className="ml-0.5 hover:opacity-70 leading-none">×</button>
              </span>
            ))}
            <span
              onClick={() => setCountryPickerOpen(v => !v)}
              className="cursor-pointer text-xs2 text-blue-600 hover:underline px-1"
            >
              + 국가설정 ({COUNTRY_ADDITIONAL.length})
            </span>
          </div>

          <div className="w-px h-3.5 bg-gray-200 shrink-0" />

          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs2 font-semibold text-gray-500 shrink-0">문헌종류</span>
            {PATENT_DOC_KINDS.map(k => (
              <Chip key={k} active={docKinds.includes(k)} onClick={() => toggleDocKind(k)} size="xs">{k}</Chip>
            ))}
          </div>
        </div>

        {/* Row 2: 기간 | 상태정보 */}
        <div className="flex items-center gap-2 px-4 py-1.5 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs2 font-semibold text-gray-500 shrink-0">기간</span>
            {PATENT_PERIODS.map(p => (
              <Chip key={p.id} active={periodChip === p.id} onClick={() => togglePeriod(p.id)} size="xs">{p.label}</Chip>
            ))}
            <div className="flex items-center gap-1">
              <input
                type="date"
                className="px-1 py-0 border border-gray-200 rounded text-xs2 h-5"
                value={periodFrom}
                onChange={e => { setPeriodFrom(e.target.value); onCustomDate(); }}
              />
              <span className="text-gray-400 text-xs2">~</span>
              <input
                type="date"
                className="px-1 py-0 border border-gray-200 rounded text-xs2 h-5"
                value={periodTo}
                onChange={e => { setPeriodTo(e.target.value); onCustomDate(); }}
              />
            </div>
          </div>

          <div className="w-px h-3.5 bg-gray-200 shrink-0" />

          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs2 font-semibold text-gray-500 shrink-0">상태</span>
            <Chip active={statusAll} onClick={toggleAllStatus} size="xs">전체</Chip>
            <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded border border-green-200 bg-green-50/50">
              <span className="text-xs2 font-semibold text-green-700 mr-0.5">A</span>
              {PATENT_STATUS_ACTIVE.map(s => (
                <Chip key={s} active={statusActive.includes(s)} onClick={() => toggleStatusActive(s)} size="xs">{s}</Chip>
              ))}
            </span>
            <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded border border-gray-200 bg-gray-50">
              <span className="text-xs2 text-gray-400 mr-0.5">I</span>
              {PATENT_STATUS_INACTIVE.map(s => (
                <Chip key={s} active={statusInactive.includes(s)} onClick={() => toggleStatusInactive(s)} size="xs">{s}</Chip>
              ))}
            </span>
          </div>
        </div>

        {/* 국가 선택 팝업 */}
        {countryPickerOpen && (
          <div className="absolute z-30 bg-white border border-gray-200 rounded-lg shadow-card-deep p-3 mt-1 w-[360px]" style={{ top: 72, left: 16 }}>
            <div className="flex justify-between items-center mb-2 text-md2 font-bold text-gray-700">
              <span>추가 국가 선택</span>
              <button onClick={() => setCountryPickerOpen(false)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-sm2 text-gray-700">
              {COUNTRY_ADDITIONAL.map(cc => (
                <label key={cc} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    className="form-checkbox text-brand-400"
                    checked={!!pickerSel[cc.split(' ')[0]]}
                    onChange={e => setPickerSel(prev => ({ ...prev, [cc.split(' ')[0]]: e.target.checked }))}
                  />
                  <span>{cc}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-1.5 pt-2 mt-2 border-t border-gray-100">
              <Button variant="outlined" color="primary" size="xs" onClick={() => setCountryPickerOpen(false)}>취소</Button>
              <Button variant="filled" color="primary" size="sm" className="text-sm2" onClick={applyCountryPicker}>선택 추가</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── 검색식 입력 영역 ─────────────────────────────── */}
      <div className="p-4 space-y-2">

        {/* 스코프 탭 + 모드 토글 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex border border-gray-200 rounded-md overflow-hidden">
            {KEY_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setKeyTab(tab.id)}
                className={clsx(
                  'px-3 py-1.5 text-sm2 font-medium border-r border-gray-200 last:border-r-0 transition-colors',
                  keyTab === tab.id
                    ? 'bg-brand-400 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="inline-flex border border-gray-300 rounded-md overflow-hidden">
            <button
              onClick={() => setMode('normal')}
              className={clsx('px-3 py-1.5 text-sm2 font-semibold', mode === 'normal' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600')}
            >일반모드</button>
            <button
              onClick={() => setMode('editor')}
              className={clsx('px-3 py-1.5 text-sm2 font-semibold', mode === 'editor' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600')}
            >편집기모드</button>
          </div>
        </div>

        {/* FormulaEditor */}
        <FormulaEditor
          value={formulaText}
          onChange={setFormulaText}
          rows={3}
          placeholder="예: 하이브리드 and 자동차 | *수소 자동차*"
        />

        {/* 편집기모드 연산자 버튼 */}
        {mode === 'editor' && (
          <div className="flex gap-1 flex-wrap">
            {['AND', 'OR', 'NOT', '( )', '*', '?', 'ADJ', 'NEAR', '" "', '@'].map(op => (
              <span key={op} className="px-1.5 py-0.5 bg-gray-100 text-xs2 text-gray-600 rounded font-mono cursor-default">{op}</span>
            ))}
            {(['keyword', 'numfmt', 'ipc'] as FinderType[]).map(k => {
              const labels: Record<string, string> = { keyword: '키워드 추천', numfmt: '번호표기법', ipc: 'IPC 코드찾기' };
              return (
                <button key={k}
                  onClick={() => setFinderOpen({ type: k, fieldIdx: -1 })}
                  className="px-1.5 py-0.5 text-xs2 bg-blue-50 text-brand-400 rounded hover:bg-blue-100">
                  {labels[k]}
                </button>
              );
            })}
          </div>
        )}

        {/* 편집기모드 실시간 진단 (경고만, 실행은 막지 않음) [검색-11·12] */}
        {mode === 'editor' && formulaText.trim() && diagnose(formulaText).length > 0 && (
          <div className="flex flex-col gap-0.5">
            {diagnose(formulaText).map((msg, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs2 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                <span>⚠</span>{msg}
              </div>
            ))}
            <div className="text-xs2 text-gray-400 px-2">경고가 있어도 그대로 검색할 수 있습니다.</div>
          </div>
        )}

        {/* 초기화 / 검색 */}
        <div className="flex justify-end gap-1.5">
          <Button variant="outlined" color="primary" size="sm" className="text-sm2" onClick={resetAll}>◇ 초기화</Button>
          <Button variant="filled" color="primary" size="sm" className="text-sm2" disabled={!canSearch} onClick={handleSearch}>검색</Button>
        </div>
      </div>

      {/* ── 검색 히스토리 ─────────────────────────── */}
      {patentHistory.length > 0 && (
        <div className="border-t border-gray-200">
          <button
            onClick={() => setHistoryOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm2 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs2">🕘</span>
              검색 히스토리
              <span className="text-xs2 font-medium text-brand-400 bg-blue-50 px-1.5 py-0 rounded-full leading-5">{patentHistory.length}</span>
            </span>
            <span className="text-gray-400 text-xs2">{historyOpen ? '▲' : '▼'}</span>
          </button>
          {historyOpen && (
            <div className="px-4 pb-3">
              <div className="flex justify-end mb-1">
                <button onClick={() => searchHistoryClear('patent')} className="text-xs2 text-gray-400 hover:text-red-500">전체 삭제</button>
              </div>
              <div className="space-y-0.5 max-h-48 overflow-y-auto scroll-thin">
                {patentHistory.map(e => (
                  <div key={e.id} className={clsx('group flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50', e.pinned && 'bg-amber-50/40')}>
                    <button
                      onClick={() => searchHistoryTogglePin(e.id)}
                      className={clsx('shrink-0 leading-none', e.pinned ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400')}
                      title={e.pinned ? '저장 해제' : '검색 저장 (★)'}
                    >★</button>
                    <button onClick={() => rerun(e.query)} className="flex-1 min-w-0 text-left" title="이 검색 재실행">
                      <div className="font-mono text-xs2 text-brand-400 truncate">{e.query}</div>
                      <div className="text-xs2 text-gray-400">{histTime(e.at)}{e.pinned && ' · 저장됨'}</div>
                    </button>
                    <button onClick={() => rerun(e.query)} className="text-xs2 px-2 py-0.5 border border-blue-200 bg-blue-50 text-brand-400 rounded hover:bg-blue-100 shrink-0">재실행</button>
                    <button onClick={() => searchHistoryRemove(e.id)} className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-500 rounded shrink-0 opacity-0 group-hover:opacity-100" title="삭제">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 검색필드 섹션 (그룹 탭) ─────────────────────────── */}
      <div className="border-t border-gray-200">

        {/* 섹션 헤더 (토글) */}
        <button
          onClick={() => setFieldsOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-sm2 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs2">≡</span>
            검색필드
            <span className="text-xs2 font-medium text-brand-400 bg-blue-50 px-1.5 py-0 rounded-full leading-5">{fields.length}</span>
          </span>
          <span className="text-gray-400 text-xs2">{fieldsOpen ? '▲' : '▼'}</span>
        </button>

        {fieldsOpen && (
          <div className="pb-3">

            {/* 그룹 탭 */}
            <div className="flex border-b border-gray-100 px-4 gap-0">
              {FIELD_GROUPS.map(g => (
                <button
                  key={g.id}
                  onClick={() => setFieldGroup(g.id)}
                  className={clsx(
                    'px-3 py-1.5 text-sm2 font-medium border-b-2 -mb-px transition-colors',
                    fieldGroup === g.id
                      ? 'border-brand-400 text-brand-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                >
                  {g.id}
                </button>
              ))}
            </div>

            {/* 필드 목록 */}
            <div className="px-4 pt-2 space-y-px">
              {visibleEntries.map(({ f, idx }) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 group"
                >
                  {/* 코드 뱃지 */}
                  <span className="text-xs2 font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0 min-w-[40px] text-center">
                    {f.code}
                  </span>

                  {/* 라벨 */}
                  <span className="text-sm2 text-gray-700 shrink-0 w-[100px]">{f.label}</span>

                  {/* 입력 영역 */}
                  {f.type === 'ipc' ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <select
                        value={f.ipcScope || 'all'}
                        onChange={e => updateField(idx, { ipcScope: e.target.value as 'all' | 'current' })}
                        className="input py-0.5 text-xs2 w-36 shrink-0"
                      >
                        <option value="all">Original or Current</option>
                        <option value="current">Current Only</option>
                      </select>
                      <input
                        type="text"
                        value={f.value}
                        onChange={e => updateField(idx, { value: e.target.value })}
                        placeholder={f.hint || ''}
                        className="flex-1 min-w-0 px-2 py-1 border border-gray-200 rounded text-sm2 outline-none focus:border-blue-400"
                      />
                    </div>
                  ) : f.type === 'date-range' ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <input
                        type="text"
                        placeholder="YYYYMMDD"
                        value={f.dateFrom || ''}
                        onChange={e => updateField(idx, { dateFrom: e.target.value })}
                        className="w-28 px-2 py-1 border border-gray-200 rounded text-sm2 outline-none focus:border-blue-400 font-mono"
                      />
                      <span className="text-gray-400">~</span>
                      <input
                        type="text"
                        placeholder="YYYYMMDD"
                        value={f.dateTo || ''}
                        onChange={e => updateField(idx, { dateTo: e.target.value })}
                        className="w-28 px-2 py-1 border border-gray-200 rounded text-sm2 outline-none focus:border-blue-400 font-mono"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={f.value}
                      onChange={e => updateField(idx, { value: e.target.value })}
                      placeholder={f.hint || ''}
                      className="flex-1 min-w-0 px-2 py-1 border border-gray-200 rounded text-sm2 outline-none focus:border-blue-400"
                    />
                  )}

                  {/* finder 버튼 */}
                  {f.finderLabel && f.finderType && (
                    <button
                      onClick={() => setFinderOpen({ type: f.finderType!, fieldIdx: idx })}
                      className="text-xs2 px-2 py-0.5 border border-blue-200 bg-blue-50 text-brand-400 rounded hover:bg-blue-100 shrink-0"
                    >
                      {f.finderLabel}
                    </button>
                  )}

                  {/* 삭제 */}
                  <button
                    onClick={() => setFields(prev => prev.filter((_, i) => i !== idx))}
                    className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="필드 제거"
                  >×</button>
                </div>
              ))}
            </div>

            {/* 검색 필드 추가 */}
            <div className="mt-2 mx-4 relative">
              <button
                onClick={() => setAddFieldOpen(v => !v)}
                className="w-full flex items-center justify-center gap-1 text-sm2 text-gray-400 hover:text-brand-400 py-1.5 border border-dashed border-gray-200 rounded hover:border-brand-300 transition-colors"
              >
                ⊕ 검색 필드 추가
              </button>
              {addFieldOpen && (
                <div className="absolute z-20 left-0 right-0 bg-white border border-gray-200 rounded shadow-md mt-0.5 max-h-52 overflow-y-auto">
                  {DEFAULT_FIELDS.filter(df => (groupCodes as readonly string[]).includes(df.code)).map(df => (
                    <button
                      key={df.code}
                      onClick={() => {
                        setFields(prev => [...prev, { ...df, value: '', dateFrom: '', dateTo: '' }]);
                        setAddFieldOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm2 hover:bg-gray-50"
                    >
                      <span className="text-xs2 font-mono font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded min-w-[40px] text-center shrink-0">{df.code}</span>
                      <span className="text-gray-700">{df.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FinderModal */}
      {finderOpen && (
        <FinderModal
          type={finderOpen.type}
          onApply={val => {
            if (finderOpen.fieldIdx >= 0) {
              updateField(finderOpen.fieldIdx, { value: val });
            } else {
              setFormulaText(prev => prev ? `${prev} ${val}` : val);
            }
            setFinderOpen(null);
          }}
          onClose={() => setFinderOpen(null)}
        />
      )}
    </div>
  );
});

// ── Helper Components ─────────────────────────────────────────

function histTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Chip({ active, onClick, children, size = 'sm' }: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  size?: 'xs' | 'sm';
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-full border transition-colors font-medium',
        size === 'xs' ? 'px-2 py-0 text-xs2' : 'px-2.5 py-0.5 text-sm2',
        active
          ? 'bg-brand-400 text-white border-brand-400'
          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-brand-400',
      )}
    >
      {children}
    </button>
  );
}
