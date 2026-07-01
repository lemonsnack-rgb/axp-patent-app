// 특허 검색 입력 영역 — 데모(http://10.77.0.244:8010/patents) 방식
// Config 2줄 압축 + 검색필드 그룹 탭 (텍스트/분류코드/인명/번호/일자)
import { useState, useRef, useImperativeHandle, useEffect, forwardRef } from 'react';
import clsx from 'clsx';
import { toast, Button } from '@muhayu/axp-ui';
import { FinderModal, type FinderType } from '../components/FinderModal';
import { Icon } from '../components/Icon';
import {
  COUNTRY_LIST, COUNTRY_ADDITIONAL, PATENT_PERIODS,
  PATENT_DOC_KINDS, PATENT_STATUS_ACTIVE, PATENT_STATUS_INACTIVE,
} from '../data/patentFields';
import { accumulateQuery, applyScope, type ScopeTab, type SFieldInput, type MetaFilter } from '../features/search';
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

// ── 전체 검색필드 카탈로그 (데모 http://10.77.0.244:8010/patents 기준 ~70개) ──
const FIELD_CATALOG: SField[] = [
  // 명칭·청구항·설명
  { code: 'TI',   label: '발명의 명칭',       value: '', type: 'text', hint: '예: 하이브리드 and 자동차 | *수소 자동차*' },
  { code: 'AB',   label: '요약',              value: '', type: 'text', hint: '예: 하이브리드 and 자동차 | "전기 자동차"' },
  { code: 'CL',   label: '대표청구항',        value: '', type: 'text', hint: '하이브리드 and 자동차' },
  { code: 'CLI',  label: '독립청구항',        value: '', type: 'text' },
  { code: 'CLA',  label: '전체청구항',        value: '', type: 'text' },
  { code: 'KC',   label: '문헌종류',          value: '', type: 'text' },
  { code: 'KWD',  label: '키워드(KR)',        value: '', type: 'text' },
  { code: 'DSC',  label: '상세설명',          value: '', type: 'text', hint: '딥러닝 and 검색 and 알고리즘' },
  { code: 'TF',   label: '기술분야',          value: '', type: 'text' },
  { code: 'BT',   label: '배경기술',          value: '', type: 'text' },
  { code: 'IE',   label: '발명효과',          value: '', type: 'text' },
  { code: 'SM',   label: '해결수단',          value: '', type: 'text' },
  { code: 'SP',   label: '해결과제',          value: '', type: 'text' },
  { code: 'DE',   label: '구체실시방식',      value: '', type: 'text' },
  { code: 'DD',   label: '도면의 간단한 설명', value: '', type: 'text' },
  // 번호·일자
  { code: 'AN',   label: '출원번호',          value: '', type: 'text', hint: '1020080012345' },
  { code: 'PN',   label: '공개번호/특허번호', value: '', type: 'text', hint: '1020100012345' },
  { code: 'RN',   label: '등록번호',          value: '', type: 'text', hint: '1012345670000' },
  { code: 'FN',   label: '공고번호',          value: '', type: 'text' },
  { code: 'AD',   label: '출원일',            value: '', type: 'date-range', dateFrom: '', dateTo: '', hint: '20080101 ~ 20081231' },
  { code: 'PD',   label: '공개일/특허일',     value: '', type: 'date-range', dateFrom: '', dateTo: '' },
  { code: 'RD',   label: '등록일',            value: '', type: 'date-range', dateFrom: '', dateTo: '' },
  { code: 'FD',   label: '공고일',            value: '', type: 'date-range', dateFrom: '', dateTo: '' },
  { code: 'PRN',  label: '우선권 번호',       value: '', type: 'text' },
  { code: 'PRC',  label: '우선권 국가',       value: '', type: 'text' },
  { code: 'PRD',  label: '우선권 주장일',     value: '', type: 'date-range', dateFrom: '', dateTo: '' },
  { code: 'IPN',  label: '국제공개번호',      value: '', type: 'text' },
  { code: 'IPD',  label: '국제공개일',        value: '', type: 'date-range', dateFrom: '', dateTo: '' },
  { code: 'IAN',  label: '국제출원번호',      value: '', type: 'text' },
  { code: 'IAD',  label: '국제출원일',        value: '', type: 'date-range', dateFrom: '', dateTo: '' },
  { code: 'DC',   label: '지정국',            value: '', type: 'text' },
  // 인명
  { code: 'WAP',  label: '출원인 대표명화 코드', value: '', type: 'text' },
  { code: 'AP',   label: '출원인',            value: '', type: 'text', hint: '엘지* | 119990527105' },
  { code: 'APC',  label: '출원인 국적',       value: '', type: 'text' },
  { code: 'APD',  label: '출원인 주소',       value: '', type: 'text', hint: '서울 | 용산' },
  { code: 'INV',  label: '발명자',            value: '', type: 'text', hint: '김한국 | 김만*' },
  { code: 'INVC', label: '발명자 국적',       value: '', type: 'text' },
  { code: 'AG',   label: '대리인',            value: '', type: 'text', hint: '특허법인* | 김남구' },
  { code: 'AGD',  label: '대리인 주소',       value: '', type: 'text' },
  { code: 'EXN',  label: '심사관',            value: '', type: 'text' },
  { code: 'AC',   label: '출원인 식별기호(JP)', value: '', type: 'text' },
  { code: 'PCN',  label: '특허고객번호(KR)',  value: '', type: 'text' },
  // 분류코드
  { code: 'IPCM', label: 'IPC (Main)',        value: '', type: 'ipc', ipcScope: 'all', finderType: 'ipc', finderLabel: 'IPC 코드찾기', hint: 'H04L-009/18% | G06F*' },
  { code: 'IPC',  label: 'IPC (All)',         value: '', type: 'ipc', ipcScope: 'all', finderType: 'ipc', finderLabel: 'IPC 코드찾기' },
  { code: 'CPCM', label: 'CPC (Main)',        value: '', type: 'ipc', ipcScope: 'all', finderType: 'ipc', finderLabel: 'CPC 코드찾기', hint: 'C12P-0007/02% | C01C*' },
  { code: 'CPC',  label: 'CPC (All)',         value: '', type: 'ipc', ipcScope: 'all', finderType: 'ipc', finderLabel: 'CPC 코드찾기' },
  { code: 'UCM',  label: 'US Class (Main)',   value: '', type: 'text' },
  { code: 'UC',   label: 'US Class (All)',    value: '', type: 'text' },
  { code: 'FI',   label: 'FI (JP)',           value: '', type: 'text' },
  { code: 'FTC',  label: 'F-term (JP)',       value: '', type: 'text' },
  // 권리·실시권
  { code: 'CAP',  label: '현재권리자',        value: '', type: 'text' },
  { code: 'CAC',  label: '현재권리자 국적',   value: '', type: 'text' },
  { code: 'ASY',  label: '양도유무(KR)',      value: '', type: 'text' },
  { code: 'ASNO', label: '양도인',            value: '', type: 'text' },
  { code: 'ASNE', label: '양수인',            value: '', type: 'text' },
  { code: 'CAD',  label: '최근 양도일',       value: '', type: 'date-range', dateFrom: '', dateTo: '' },
  { code: 'EL',   label: '실시권자(전용·KR)', value: '', type: 'text' },
  { code: 'LRD',  label: '실시권/라이선스 등록일', value: '', type: 'date-range', dateFrom: '', dateTo: '' },
  { code: 'LY',   label: '실시권 유무(KR)',   value: '', type: 'text' },
  { code: 'JIC',  label: '심판유무',          value: '', type: 'text' },
  { code: 'PLGE', label: '질권자',            value: '', type: 'text' },
  // 인용·피인용
  { code: 'BCC',  label: '특허인용 국가',     value: '', type: 'text' },
  { code: 'BCN',  label: '특허인용 번호',     value: '', type: 'text' },
  { code: 'FCC',  label: '특허피인용 국가',   value: '', type: 'text' },
  { code: 'FCN',  label: '특허피인용 번호',   value: '', type: 'text' },
  { code: 'NPCY', label: '비특허인용 유무',   value: '', type: 'text' },
  { code: 'NPRD', label: '비특허 참고문헌',   value: '', type: 'text' },
  // 국가연구개발(과제)
  { code: 'NRTBT', label: '과제/연구사업 명칭', value: '', type: 'text' },
  { code: 'NRTDO', label: '부처/주관기관 명칭', value: '', type: 'text' },
  { code: 'NRTN',  label: '과제 고유번호',    value: '', type: 'text' },
  { code: 'NRDS',  label: '과제 시작일',      value: '', type: 'date-range', dateFrom: '', dateTo: '' },
  { code: 'NRDE',  label: '과제 종료일',      value: '', type: 'date-range', dateFrom: '', dateTo: '' },
  // 표준·서열
  { code: 'SEYN', label: '표준특허 유무',     value: '', type: 'text' },
  { code: 'SEI',  label: '표준정보',          value: '', type: 'text' },
  { code: 'SESO', label: '표준화기구',        value: '', type: 'text' },
  { code: 'SET',  label: '표준기술명',        value: '', type: 'text' },
  { code: 'SEN',  label: '표준번호',          value: '', type: 'text' },
  { code: 'SED',  label: '선언(등재)자',      value: '', type: 'text' },
  { code: 'SEDC', label: '선언(등재)자 국적', value: '', type: 'text' },
  { code: 'SEDD', label: '선언일',            value: '', type: 'date-range', dateFrom: '', dateTo: '' },
  { code: 'SEQY', label: '서열목록 유무',     value: '', type: 'text' },
  { code: 'SEQC', label: '서열내용',          value: '', type: 'text' },
];

// 연산검색(행 기반 빌더)
type OpRow = { op: 'AND' | 'OR' | 'NOT'; field: string; value: string; dateFrom?: string; dateTo?: string };

// 초기 표시 필드(데모 기본 18개) — 나머지는 '검색 필드 추가'로 확장
const INITIAL_FIELD_CODES = ['TI', 'AB', 'CL', 'CLI', 'CLA', 'DSC', 'IPCM', 'CPCM', 'AP', 'APD', 'INV', 'AG', 'AN', 'PN', 'RN', 'AD', 'PD', 'RD'];
const INITIAL_FIELDS: SField[] = FIELD_CATALOG.filter(f => INITIAL_FIELD_CODES.includes(f.code));

// ── 검색필드 그룹 탭 (데모 카탈로그 기준) ─────────────────────
const FIELD_GROUPS = [
  { id: '명칭·청구항·설명', codes: ['TI', 'AB', 'CL', 'CLI', 'CLA', 'KC', 'KWD', 'DSC', 'TF', 'BT', 'IE', 'SM', 'SP', 'DE', 'DD'] },
  { id: '번호·일자',       codes: ['AN', 'PN', 'RN', 'FN', 'AD', 'PD', 'RD', 'FD', 'PRN', 'PRC', 'PRD', 'IPN', 'IPD', 'IAN', 'IAD', 'DC'] },
  { id: '인명',            codes: ['WAP', 'AP', 'APC', 'APD', 'INV', 'INVC', 'AG', 'AGD', 'EXN', 'AC', 'PCN'] },
  { id: '분류코드',        codes: ['IPCM', 'IPC', 'CPCM', 'CPC', 'UCM', 'UC', 'FI', 'FTC'] },
  { id: '권리·실시권',     codes: ['CAP', 'CAC', 'ASY', 'ASNO', 'ASNE', 'CAD', 'EL', 'LRD', 'LY', 'JIC', 'PLGE'] },
  { id: '인용',            codes: ['BCC', 'BCN', 'FCC', 'FCN', 'NPCY', 'NPRD'] },
  { id: '국가R&D',         codes: ['NRTBT', 'NRTDO', 'NRTN', 'NRDS', 'NRDE'] },
  { id: '표준·서열',       codes: ['SEYN', 'SEI', 'SESO', 'SET', 'SEN', 'SED', 'SEDC', 'SEDD', 'SEQY', 'SEQC'] },
] as const;

// 연산검색 필드 선택 모달 — 검색 범위 조합 + 전체 카탈로그(영역별)
const OP_PICKER_GROUPS: { id: string; codes: string[] }[] = [
  { id: '검색 범위', codes: ['KEY', 'TAC'] },
  ...FIELD_GROUPS.map(g => ({ id: g.id, codes: [...g.codes] })),
];
function fieldLabelOf(code: string): string {
  if (code === 'KEY') return '명칭+요약+독립항';
  if (code === 'TAC') return '명칭+요약+전체청구항';
  return FIELD_CATALOG.find(f => f.code === code)?.label ?? code;
}
// 필드 타입 — 연산검색 입력형태(날짜=기간, ipc/텍스트=입력창)를 가변 적용
function fieldTypeOf(code: string): 'text' | 'date-range' | 'ipc' {
  if (code === 'KEY' || code === 'TAC') return 'text';
  return FIELD_CATALOG.find(f => f.code === code)?.type ?? 'text';
}
function fieldHintOf(code: string): string {
  return FIELD_CATALOG.find(f => f.code === code)?.hint ?? '검색어 입력 (and / or / not, 와일드카드 * 사용 가능)';
}

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

// ── 검색 범위 탭 (검색어를 어느 항목에서 찾을지) ──────────────
const KEY_TABS: { id: ScopeTab; label: string; hint: string }[] = [
  { id: 'KEY_CLI', label: '명칭+요약+독립항',     hint: '발명의 명칭·요약·독립청구항에서 검색' },
  { id: 'KEY_CLA', label: '명칭+요약+전체청구항', hint: '발명의 명칭·요약·전체청구항(독립+종속)에서 검색' },
  { id: 'DSC',     label: '상세설명',             hint: '상세설명 본문 전체에서 검색' },
];

// ── Main ──────────────────────────────────────────────────────
export const PatentInput = forwardRef<PatentInputHandle, Props>(function PatentInput({ onRun, carryQuery, onCarryConsumed }, ref) {
  const { searchHistory, searchHistoryAdd, searchHistoryRemove, searchHistoryClear, searchHistoryTogglePin } = useStore();
  // 저장(pinned)된 검색을 상단에, 나머지는 최신순(삽입순) 유지
  const patentHistory = searchHistory
    .filter(e => e.kind === 'patent')
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const [historyOpen, setHistoryOpen] = useState(true);

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
  const [histPage, setHistPage] = useState(1);
  // 연산검색 행 빌더 (키워트 연산검색)
  const [opRows, setOpRows] = useState<OpRow[]>([
    { op: 'AND', field: 'KEY', value: '' },
    { op: 'AND', field: 'AP', value: '' },
    { op: 'AND', field: 'DSC', value: '' },
  ]);
  const updateOpRow = (i: number, patch: Partial<OpRow>) => setOpRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeOpRow = (i: number) => setOpRows(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  const buildOpQuery = () => {
    const parts = opRows.map(r => {
      if (fieldTypeOf(r.field) === 'date-range') {
        const from = (r.dateFrom || '').replace(/\D/g, '');
        const to = (r.dateTo || '').replace(/\D/g, '');
        if (!from && !to) return null;
        return { op: r.op, clause: `${r.field}:([${from || '*'} ~ ${to || '*'}])` };
      }
      const v = r.value.trim();
      if (!v) return null;
      return { op: r.op, clause: `${r.field}:(${v})` };
    }).filter((p): p is { op: OpRow['op']; clause: string } => !!p);
    return parts.map((p, i) => (i === 0 ? '' : `${p.op} `) + p.clause).join(' ');
  };
  // 연산검색 필드 선택 모달: 숫자=해당 행 필드 변경, 'add'=조건(행) 추가(다중 선택)
  const [opPickerFor, setOpPickerFor] = useState<number | 'add' | null>(null);
  const [fields, setFields] = useState<SField[]>(INITIAL_FIELDS);

  // 파인더
  const [finderOpen, setFinderOpen] = useState<{ type: FinderType; fieldIdx: number } | null>(null);
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [pendingAddCodes, setPendingAddCodes] = useState<Set<string>>(new Set());

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
    // 연산검색(행 빌더): 각 행의 [연산자][필드][검색어]를 조합해 실행
    if (mode === 'editor') {
      const execQuery = buildOpQuery();
      searchHistoryAdd('patent', execQuery);
      onRun(execQuery, buildMeta());
      return;
    }
    // 목업: 검색어가 없어도 검색 버튼만 누르면 전체 결과가 나오도록 허용
    const fieldInputs: SFieldInput[] = fields.map(f => ({
      code: f.code, type: f.type, value: f.value, dateFrom: f.dateFrom, dateTo: f.dateTo,
    }));

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

  // 목업: 검색어 무관하게 검색 버튼은 항상 활성화 (빈 검색 = 전체 결과)
  const canSearch = true;

  const resetAll = () => {
    setFormulaText('');
    setFields(INITIAL_FIELDS.map(f => ({ ...f, value: '', dateFrom: '', dateTo: '' })));
  };

  // 활성 검색필드를 섹션(그룹)별로 묶어 한 화면에 모두 표시 (탭으로 숨기지 않음)
  const activeGroups = FIELD_GROUPS
    .map(g => ({
      id: g.id,
      entries: fields
        .map((f, idx) => ({ f, idx }))
        .filter(({ f }) => (g.codes as readonly string[]).includes(f.code)),
    }))
    .filter(g => g.entries.length > 0);

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

        {/* 검색어 입력방식(먼저) + 검색 범위 */}
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs2 font-semibold text-gray-500 shrink-0" title="검색어를 어떻게 입력할지 선택합니다">검색어 입력방식</span>
            <div className="inline-flex border border-gray-300 rounded-md overflow-hidden">
              <button
                onClick={() => setMode('normal')}
                title="하나의 검색식(키워드)을 입력해 검색합니다"
                className={clsx('px-3 py-1.5 text-sm2 font-semibold', mode === 'normal' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600')}
              >기본검색</button>
              <button
                onClick={() => setMode('editor')}
                title="연산자(AND/OR/NOT)로 항목별 검색어를 조합해 검색합니다"
                className={clsx('px-3 py-1.5 text-sm2 font-semibold', mode === 'editor' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600')}
              >연산검색</button>
            </div>
          </div>
          {mode === 'normal' && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs2 font-semibold text-gray-500 shrink-0" title="검색어를 특허의 어느 부분에서 찾을지 선택합니다">검색 범위</span>
            <div className="flex border border-gray-200 rounded-md overflow-hidden">
              {KEY_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setKeyTab(tab.id)}
                  title={tab.hint}
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
          </div>
          )}
        </div>

        {/* 기본검색: 자유 검색식 입력창 */}
        {mode === 'normal' && (
          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0">
              <FormulaEditor
                value={formulaText}
                onChange={setFormulaText}
                rows={3}
                placeholder="예: 하이브리드 and 자동차 | *수소 자동차*"
              />
            </div>
            <div className="shrink-0 w-[88px] flex flex-col gap-1.5">
              <Button variant="filled" color="primary" size="sm" className="text-sm2 flex-1 !h-auto min-h-[36px]" disabled={!canSearch} onClick={handleSearch}>검색</Button>
              <Button variant="outlined" color="primary" size="sm" className="text-sm2 shrink-0" onClick={resetAll}>초기화</Button>
            </div>
          </div>
        )}

        {/* 연산검색: 행 기반 빌더 (연산자 + 필드 선택 + 검색어) */}
        {mode === 'editor' && (
          <div className="space-y-1.5">
            {opRows.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {i === 0 ? (
                  <span className="w-16 shrink-0 text-xs2 text-gray-400 text-center">조건</span>
                ) : (
                  <select
                    value={r.op}
                    onChange={e => updateOpRow(i, { op: e.target.value as OpRow['op'] })}
                    className="w-16 shrink-0 h-9 px-1.5 border border-gray-300 rounded text-sm2 bg-white outline-none focus:border-blue-400 font-medium"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                    <option value="NOT">NOT</option>
                  </select>
                )}
                <button
                  onClick={() => setOpPickerFor(i)}
                  title="검색 필드 선택"
                  className="w-44 shrink-0 h-9 px-2 border border-gray-300 rounded text-sm2 bg-white text-left flex items-center justify-between hover:border-blue-400"
                >
                  <span className="truncate">{fieldLabelOf(r.field)}</span>
                  <span className="text-gray-400 text-xs2 shrink-0 ml-1">▾</span>
                </button>
                {fieldTypeOf(r.field) === 'date-range' ? (
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <input
                      type="date"
                      value={r.dateFrom || ''}
                      onChange={e => updateOpRow(i, { dateFrom: e.target.value })}
                      className="flex-1 min-w-0 h-9 px-2 border border-gray-300 rounded text-sm2 outline-none focus:border-blue-400 font-mono"
                    />
                    <span className="text-gray-400 shrink-0">~</span>
                    <input
                      type="date"
                      value={r.dateTo || ''}
                      onChange={e => updateOpRow(i, { dateTo: e.target.value })}
                      className="flex-1 min-w-0 h-9 px-2 border border-gray-300 rounded text-sm2 outline-none focus:border-blue-400 font-mono"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={r.value}
                    onChange={e => updateOpRow(i, { value: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                    placeholder={fieldHintOf(r.field)}
                    className="flex-1 min-w-0 h-9 px-3 border border-gray-300 rounded text-sm2 outline-none focus:border-blue-400"
                  />
                )}
                <button
                  onClick={() => removeOpRow(i)}
                  disabled={opRows.length <= 1}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded border border-gray-300 text-gray-400 hover:text-red-500 hover:border-red-300 disabled:opacity-30"
                  title="조건 삭제"
                >−</button>
              </div>
            ))}
            <button
              onClick={() => { setPendingAddCodes(new Set()); setOpPickerFor('add'); }}
              className="inline-flex items-center gap-1 mt-0.5 px-3 h-8 rounded border border-dashed border-gray-300 text-sm2 text-gray-500 hover:text-brand-400 hover:border-brand-300"
            >＋ 조건 추가</button>
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

        {/* 초기화 / 검색 — 연산검색은 행 빌더 하단에 배치(기본검색은 검색식 우측으로 이동) */}
        {mode === 'editor' && (
          <div className="flex justify-end gap-1.5">
            <Button variant="outlined" color="primary" size="sm" className="text-sm2" onClick={resetAll}>초기화</Button>
            <Button variant="filled" color="primary" size="sm" className="text-sm2" disabled={!canSearch} onClick={handleSearch}>검색</Button>
          </div>
        )}
      </div>

      {/* ── 검색필드 섹션 (기본검색 전용 — 항목별 입력, 전부 AND 조합) ─────────────────────────── */}
      {mode === 'normal' && (
      <div className="border-t border-gray-200">

        {/* 섹션 헤더 (아코디언 토글) — 클릭 가능함을 명확히 */}
        <button
          onClick={() => setFieldsOpen(v => !v)}
          aria-expanded={fieldsOpen}
          className={clsx(
            'w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm2 font-semibold border-b transition-colors',
            fieldsOpen ? 'text-gray-700 border-gray-100 hover:bg-gray-50' : 'text-brand-600 bg-blue-50 border-blue-100 hover:bg-blue-100',
          )}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <Icon name="chevron-down" size={14} className={clsx('shrink-0 text-brand-400 transition-transform', fieldsOpen && 'rotate-180')} />
            항목별 검색필드
            {!fieldsOpen && <span className="text-xs2 font-normal text-gray-500 truncate">— 제목·초록·청구항·출원인 등 필드별 입력(추가 가능)</span>}
          </span>
          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-brand-300 bg-white text-xs2 font-semibold text-brand-500">
            {fieldsOpen ? '접기' : '펼쳐서 입력'}
            <Icon name="chevron-down" size={11} className={clsx('transition-transform', fieldsOpen && 'rotate-180')} />
          </span>
        </button>

        {fieldsOpen && (
          <div className="pb-3">

            {/* 활성 검색필드 — 섹션(그룹)별로 한 화면에 모두 표시 */}
            <div className="px-4 pt-2 space-y-3">
              {activeGroups.map(group => (
                <div key={group.id}>
                  <div className="text-xs2 font-semibold text-gray-400 mb-1 pb-1 border-b border-gray-100">{group.id}</div>
                  <div className="space-y-px">
                  {group.entries.map(({ f, idx }) => (
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
                </div>
              ))}
            </div>

            {/* 검색 필드 추가·확장 (키워트식 구분선 토글) */}
            <div className="mt-3 mx-4 flex items-center gap-3">
              <span className="flex-1 h-px bg-blue-100" />
              <button
                onClick={() => { setPendingAddCodes(new Set(fields.map(f => f.code))); setAddFieldOpen(true); }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-sm2 font-semibold text-brand-500 hover:bg-blue-100 hover:border-blue-400 transition-colors shrink-0"
              >
                <span className="text-base2 leading-none">＋</span> 검색 필드 추가·확장
              </button>
              <span className="flex-1 h-px bg-blue-100" />
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── 검색 히스토리 (검색필드 아래) ─────────────────────────── */}
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
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs2 text-gray-400">검색식 최대 100개 누적</span>
                <button onClick={() => searchHistoryClear('patent')} className="text-xs2 text-gray-400 hover:text-red-500">전체 삭제</button>
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
                {patentHistory.slice((histPage - 1) * 10, histPage * 10).map(e => (
                  <div key={e.id} className={clsx('group flex items-center gap-2 py-1.5 px-2 border-b border-gray-50 hover:bg-gray-50', e.pinned && 'bg-amber-50/40')}>
                    <button
                      onClick={() => searchHistoryTogglePin(e.id)}
                      className={clsx('w-4 shrink-0 leading-none', e.pinned ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400')}
                      title={e.pinned ? '저장 해제' : '검색 저장 (★)'}
                    >★</button>
                    <button onClick={() => rerun(e.query)} className="flex-1 min-w-0 text-left font-mono text-xs2 text-brand-400 truncate" title="이 검색식으로 재검색">{e.query}</button>
                    <span className="w-28 shrink-0 text-xs2 text-gray-400 font-mono">{histTime(e.at)}</span>
                    <button onClick={() => rerun(e.query)} className="w-[52px] shrink-0 text-xs2 px-2 py-0.5 border border-blue-200 bg-blue-50 text-brand-400 rounded hover:bg-blue-100 text-center">재검색</button>
                    <button onClick={() => searchHistoryRemove(e.id)} className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-500 rounded shrink-0 opacity-0 group-hover:opacity-100" title="삭제">×</button>
                  </div>
                ))}
              </div>
              {patentHistory.length > 10 && (
                <div className="flex items-center justify-center gap-1 pt-2 text-sm2">
                  <button onClick={() => setHistPage(p => Math.max(1, p - 1))} disabled={histPage === 1} className="px-1.5 py-0.5 border border-gray-300 rounded text-gray-500 hover:border-blue-400 disabled:opacity-30">‹</button>
                  {Array.from({ length: Math.ceil(patentHistory.length / 10) }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setHistPage(p)} className={clsx('w-6 h-6 rounded border text-xs2 font-mono', p === histPage ? 'bg-blue-400 text-white border-blue-400' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}>{p}</button>
                  ))}
                  <button onClick={() => setHistPage(p => Math.min(Math.ceil(patentHistory.length / 10), p + 1))} disabled={histPage >= Math.ceil(patentHistory.length / 10)} className="px-1.5 py-0.5 border border-gray-300 rounded text-gray-500 hover:border-blue-400 disabled:opacity-30">›</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 연산검색 필드 선택 모달 (행 필드 변경 / 조건 추가) */}
      {opPickerFor !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpPickerFor(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[82vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
              <div className="text-base2 font-bold text-gray-800">{opPickerFor === 'add' ? '검색 조건 추가 — 필드 선택' : '검색 필드 선택'}</div>
              <button onClick={() => setOpPickerFor(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
            </div>
            <div className="px-5 py-4 overflow-y-auto scroll-thin space-y-4 flex-1">
              {OP_PICKER_GROUPS.map(g => (
                <div key={g.id}>
                  <div className="text-sm2 font-semibold text-gray-600 mb-2 pb-1 border-b border-gray-100">{g.id}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {g.codes.map(code => {
                      const sel = opPickerFor === 'add' && pendingAddCodes.has(code);
                      return (
                        <button
                          key={code}
                          onClick={() => {
                            if (opPickerFor === 'add') {
                              setPendingAddCodes(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });
                            } else if (typeof opPickerFor === 'number') {
                              updateOpRow(opPickerFor, { field: code });
                              setOpPickerFor(null);
                            }
                          }}
                          className={clsx(
                            'flex items-center gap-1.5 px-2 py-1.5 rounded border text-sm2 text-left transition-colors',
                            sel ? 'bg-blue-50 border-blue-400 text-brand-400' : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300',
                          )}
                        >
                          {opPickerFor === 'add' && <input type="checkbox" checked={sel} readOnly tabIndex={-1} className="rounded border-gray-300 text-blue-600 pointer-events-none shrink-0" />}
                          <span className="text-xs2 font-mono font-bold bg-gray-100 text-gray-500 px-1 py-0.5 rounded min-w-[42px] text-center shrink-0">{code}</span>
                          <span className="truncate flex-1">{fieldLabelOf(code)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {opPickerFor === 'add' && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
                <span className="text-sm2 text-gray-500">{pendingAddCodes.size}개 선택</span>
                <div className="flex gap-2">
                  <Button variant="outlined" color="primary" size="sm" onClick={() => setOpPickerFor(null)}>닫기</Button>
                  <Button
                    variant="filled" color="primary" size="sm"
                    disabled={pendingAddCodes.size === 0}
                    onClick={() => {
                      const codes = OP_PICKER_GROUPS.flatMap(g => g.codes).filter(c => pendingAddCodes.has(c));
                      setOpRows(prev => [...prev, ...codes.map(c => ({ op: 'AND' as const, field: c, value: '' }))]);
                      setOpPickerFor(null);
                    }}
                  >조건 추가</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 검색 필드 추가 오버레이 (키워트 방식 — 영역별 선택 후 적용) */}
      {addFieldOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddFieldOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[82vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
              <div className="text-base2 font-bold text-gray-800">검색 필드 추가</div>
              <button onClick={() => setAddFieldOpen(false)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
            </div>
            <div className="px-5 py-4 overflow-y-auto scroll-thin space-y-4 flex-1">
              {FIELD_GROUPS.map(g => (
                <div key={g.id}>
                  <div className="text-sm2 font-semibold text-gray-600 mb-2 pb-1 border-b border-gray-100">{g.id}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {g.codes.map(code => {
                      const df = FIELD_CATALOG.find(f => f.code === code);
                      if (!df) return null;
                      const sel = pendingAddCodes.has(df.code);
                      return (
                        <button
                          key={df.code}
                          onClick={() => setPendingAddCodes(prev => { const n = new Set(prev); n.has(df.code) ? n.delete(df.code) : n.add(df.code); return n; })}
                          className={clsx(
                            'flex items-center gap-1.5 px-2 py-1.5 rounded border text-sm2 text-left transition-colors',
                            sel ? 'bg-blue-50 border-blue-400 text-brand-400' : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300',
                          )}
                        >
                          <input type="checkbox" checked={sel} readOnly tabIndex={-1} className="rounded border-gray-300 text-blue-600 pointer-events-none shrink-0" />
                          <span className="text-xs2 font-mono font-bold bg-gray-100 text-gray-500 px-1 py-0.5 rounded min-w-[42px] text-center shrink-0">{df.code}</span>
                          <span className="truncate flex-1">{df.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
              <span className="text-sm2 text-gray-500">{pendingAddCodes.size}개 선택</span>
              <div className="flex gap-2">
                <Button variant="outlined" color="primary" size="sm" onClick={() => setAddFieldOpen(false)}>닫기</Button>
                <Button
                  variant="filled" color="primary" size="sm"
                  onClick={() => {
                    // 체크된 필드로 동기화 — 기존 필드는 값 유지, 신규는 카탈로그에서 추가, 해제는 제거
                    const kept = fields.filter(f => pendingAddCodes.has(f.code));
                    const keptCodes = new Set(kept.map(f => f.code));
                    const added = FIELD_CATALOG.filter(f => pendingAddCodes.has(f.code) && !keptCodes.has(f.code)).map(f => ({ ...f, value: '', dateFrom: '', dateTo: '' }));
                    setFields([...kept, ...added]);
                    setAddFieldOpen(false);
                    toast(`검색필드 ${kept.length + added.length}개 적용`);
                  }}
                >적용하기</Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
