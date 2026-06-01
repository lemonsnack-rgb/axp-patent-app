// 특허 검색 입력 영역 — 원본 mockup의 srch-config + srch-input-area 정밀 포팅
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { FinderModal, type FinderType } from '../components/FinderModal';
import { COUNTRY_LIST, COUNTRY_ADDITIONAL, PATENT_PERIODS, PATENT_SCOPES, PATENT_LANGS, PATENT_DOC_KINDS, PATENT_STATUS_ACTIVE, PATENT_STATUS_INACTIVE } from '../data/patentFields';

// 일반모드 빌더 — 9 기본 필드 (원본 mockup srch-field-rows 동일)
interface BuilderField {
  code: string;
  label: string;
  value: string;
  dateFrom?: string;
  dateTo?: string;
  recentYears?: number;         // 출원일 필드의 "최근 N년"
  type?: 'text' | 'date-range';
  ipcScope?: 'all' | 'current'; // IPC_ALL 필드의 Original or Current 선택
  finderType?: 'keyword' | 'ipc' | 'applicantCode' | 'applicantUniq' | 'numfmt';
  finderLabel?: string;
  finderType2?: 'applicantUniq'; // 두 번째 파인더 (AP 필드의 고유번호)
  finderLabel2?: string;
  hint?: string;
}

const DEFAULT_BUILDER: BuilderField[] = [
  { code: 'TI_AB_CLI', label: '명칭+요약+독립항', value: '자율주행* OR autonomous driving', type: 'text', finderType: 'keyword', finderLabel: '키워드추천', hint: '발명의 명칭+요약+독립청구항 통합 검색' },
  { code: 'CLA',       label: '전체청구항',       value: '자율주행 and 라이다 and 객체',     type: 'text', hint: '독립항 + 종속항 전체 청구항 본문 검색' },
  { code: 'DSC',       label: '상세설명',         value: '딥러닝 and 검색 and 알고리즘',     type: 'text', hint: '발명의 상세설명 본문 검색' },
  { code: 'AP',        label: '출원인',           value: '엘지* | 119990527105',            type: 'text', finderType: 'applicantCode', finderLabel: '대표명화', finderType2: 'applicantUniq', finderLabel2: '고유번호', hint: '출원인명 검색 — 대표명화/고유번호로도 검색 가능' },
  { code: 'IPC_ALL',   label: 'IPC(All)',         value: 'H04L-009/18% | G06F*',           type: 'text', ipcScope: 'all', finderType: 'ipc', finderLabel: 'IPC 코드찾기', hint: 'IPC 전체 분류 검색 (서브클래스/메인그룹, * 와일드카드 지원)' },
  { code: 'AN',        label: '출원번호',          value: '',                               type: 'text', finderType: 'numfmt', finderLabel: '번호표기법', hint: '국가코드-연도-일련번호 형식, * 와일드카드 지원' },
  { code: 'PUB',       label: '공개/공고번호',      value: '',                               type: 'text', finderType: 'numfmt', finderLabel: '번호표기법', hint: '공개번호 또는 공고번호로 검색' },
  { code: 'RN',        label: '등록번호',          value: '',                               type: 'text', finderType: 'numfmt', finderLabel: '번호표기법', hint: '등록번호로 검색' },
  { code: 'AD',        label: '출원일',            value: '', dateFrom: '', dateTo: '', recentYears: 0, type: 'date-range', hint: '출원일 범위 검색 또는 최근 N년' },
];

interface Props { onRun: () => void }

export function PatentInput({ onRun }: Props) {
  const toast = useToast();

  // 국가
  const [countries, setCountries] = useState<Record<string, boolean>>({ KR: true, US: true });
  const [extraCountries, setExtraCountries] = useState<string[]>([]);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [pickerSel, setPickerSel] = useState<Record<string, boolean>>({});
  const pickerBtnRef = useRef<HTMLSpanElement>(null);

  // 검색범위 / 본문언어
  const [scope, setScope] = useState(3); // 전체문서
  const [lang, setLang] = useState<string[]>(['한+영']);

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

  // 입력모드
  const [mode, setMode] = useState<'builder' | 'formula'>('builder');

  // 빌더
  const [builder, setBuilder] = useState<BuilderField[]>(DEFAULT_BUILDER);
  const [formula, setFormula] = useState('');

  // 편집기 모드
  const [scopeRadio, setScopeRadio] = useState<'전문' | '명칭+요약' | '청구항'>('전문');
  const [formulaText, setFormulaText] = useState('TI=(자율주행* OR autonomous driving) AND AB=(라이다* OR lidar OR LIDAR) AND IPCM=G01S*');

  // 파인더 모달
  const [finderOpen, setFinderOpen] = useState<{ type: FinderType; fieldIdx: number } | null>(null);

  // 빌더 → 검색식 자동 생성
  useEffect(() => {
    const parts = builder
      .filter(f => f.type === 'text' && f.value.trim())
      .map(f => `${f.code}=(${f.value.trim()})`);
    const dateField = builder.find(f => f.type === 'date-range' && (f.dateFrom || f.dateTo));
    if (dateField) {
      parts.push(`${dateField.code}=[${dateField.dateFrom || ''} ~ ${dateField.dateTo || ''}]`);
    }
    setFormula(parts.join(' AND '));
  }, [builder]);

  const toggleCountry = (code: string) => {
    setCountries(prev => ({ ...prev, [code]: !prev[code] }));
  };
  const removeExtraCountry = (cc: string) => {
    setExtraCountries(prev => prev.filter(c => c !== cc));
  };
  const applyCountryPicker = () => {
    const selected = Object.keys(pickerSel).filter(k => pickerSel[k]);
    setExtraCountries(prev => Array.from(new Set([...prev, ...selected])));
    setCountryPickerOpen(false);
    setPickerSel({});
    if (selected.length) toast.show(`추가 국가 ${selected.length}개 적용`);
  };

  const toggleLang = (l: string) => setLang(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  const toggleDocKind = (k: string) => setDocKinds(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  const togglePeriod = (p: string) => {
    setPeriodChip(prev => prev === p ? '' : p);
    setPeriodFrom(''); setPeriodTo('');
  };
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

  const updateField = (idx: number, patch: Partial<BuilderField>) => {
    setBuilder(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };
  const removeField = (idx: number) => setBuilder(prev => prev.filter((_, i) => i !== idx));
  const resetBuilder = () => setBuilder(DEFAULT_BUILDER);



  return (
    <div className="flex-1 overflow-y-auto scroll-thin bg-white">
      {/* 검색 설정 (config) */}
      <div className="srch-config border-b border-gray-200">
        <ConfigRow label="국가">
          <div className="flex flex-wrap gap-1 items-center">
            <Chip active={Object.values(countries).every(v => !v) && extraCountries.length === 0}
                  onClick={() => { setCountries({}); setExtraCountries([]); }}>전체</Chip>
            {COUNTRY_LIST.map(c => (
              <Chip key={c.code} active={!!countries[c.code]} onClick={() => toggleCountry(c.code)}>{c.label}</Chip>
            ))}
            {extraCountries.map(cc => (
              <span key={cc} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-700 text-white rounded-full text-sm2 font-medium">
                {cc} <button onClick={() => removeExtraCountry(cc)} className="hover:opacity-70">×</button>
              </span>
            ))}
            <span
              ref={pickerBtnRef as any}
              onClick={() => setCountryPickerOpen(v => !v)}
              className="cursor-pointer text-sm2 text-blue-600 hover:underline px-2 py-0.5"
              title="추가 국가 선택"
            >
              + 국가설정 ({COUNTRY_ADDITIONAL.length})
            </span>
            {countryPickerOpen && (
              <div className="absolute z-30 bg-white border border-gray-200 rounded-lg shadow-card-deep p-3 mt-2 w-[360px]" style={{ top: 100, left: 200 }}>
                <div className="flex justify-between items-center mb-2 text-md2 font-bold text-gray-700">
                  <span>추가 국가 선택</span>
                  <button onClick={() => setCountryPickerOpen(false)} className="text-gray-400 hover:text-gray-700">×</button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-sm2 text-gray-700">
                  {COUNTRY_ADDITIONAL.map(cc => (
                    <label key={cc} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                      <input type="checkbox" className="form-checkbox text-blue-700" checked={!!pickerSel[cc.split(' ')[0]]} onChange={(e) => setPickerSel(prev => ({ ...prev, [cc.split(' ')[0]]: e.target.checked }))} />
                      <span>{cc}</span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-1.5 pt-2 mt-2 border-t border-gray-100">
                  <button className="btn-outline btn-xs" onClick={() => setCountryPickerOpen(false)}>취소</button>
                  <button className="btn-primary btn-sm text-sm2" onClick={applyCountryPicker}>선택 추가</button>
                </div>
              </div>
            )}
          </div>
        </ConfigRow>

        <ConfigRow label="검색범위">
          <div className="flex gap-3 flex-wrap">
            {PATENT_SCOPES.map((s, i) => (
              <label key={s} className="text-sm2 text-gray-600 flex items-center gap-1 cursor-pointer">
                <input type="radio" name="srch-scope-main" checked={scope === i} onChange={() => setScope(i)} className="accent-blue-700" />
                {s}
              </label>
            ))}
          </div>
          <span className="text-sm2 font-semibold text-gray-500 ml-3">본문언어</span>
          <div className="flex gap-1">
            {PATENT_LANGS.map(l => (
              <Chip key={l} active={lang.includes(l)} onClick={() => toggleLang(l)}>{l}</Chip>
            ))}
          </div>
        </ConfigRow>

        <ConfigRow label="문헌종류">
          <div className="flex flex-wrap gap-1">
            {PATENT_DOC_KINDS.map(k => (
              <Chip key={k} active={docKinds.includes(k)} onClick={() => toggleDocKind(k)}>{k}</Chip>
            ))}
          </div>
        </ConfigRow>

        <ConfigRow label={<>기간<span className="ml-1 text-xs2 px-1 bg-gray-100 text-gray-500 rounded" title="구간 미선택 시 전체 기간 검색">TIP</span></>}>
          <div className="flex gap-1">
            {PATENT_PERIODS.map(p => (
              <Chip key={p.id} active={periodChip === p.id} onClick={() => togglePeriod(p.id)}>{p.label}</Chip>
            ))}
          </div>
          <div className="flex items-center gap-1.5 ml-2 text-sm2 text-gray-600">
            <input type="date" className="px-1.5 py-0.5 border border-gray-300 rounded text-sm2" value={periodFrom} onChange={e => { setPeriodFrom(e.target.value); onCustomDate(); }} />
            <span>~</span>
            <input type="date" className="px-1.5 py-0.5 border border-gray-300 rounded text-sm2" value={periodTo} onChange={e => { setPeriodTo(e.target.value); onCustomDate(); }} />
          </div>
        </ConfigRow>

        <ConfigRow label="상태정보">
          <div className="flex flex-wrap gap-1.5 items-center">
            <Chip active={statusAll} onClick={toggleAllStatus}>전체</Chip>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-green-200 bg-green-50/50">
              <span className="text-xs2 font-semibold text-green-700">Active</span>
              {PATENT_STATUS_ACTIVE.map(s => (
                <Chip key={s} active={statusActive.includes(s)} onClick={() => toggleStatusActive(s)} size="xs">{s}</Chip>
              ))}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50">
              <span className="text-xs2 font-semibold text-gray-500">Inactive</span>
              {PATENT_STATUS_INACTIVE.map(s => (
                <Chip key={s} active={statusInactive.includes(s)} onClick={() => toggleStatusInactive(s)} size="xs">{s}</Chip>
              ))}
            </span>
          </div>
        </ConfigRow>
      </div>

      {/* 입력 모드 + 빌더/편집기 */}
      <div className="p-4">
        <div className="inline-flex border border-gray-300 rounded-md overflow-hidden mb-3">
          <button onClick={() => setMode('builder')} className={clsx('px-3 py-1.5 text-sm2 font-semibold', mode === 'builder' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600')} title="필드별 입력">일반모드</button>
          <button onClick={() => setMode('formula')} className={clsx('px-3 py-1.5 text-sm2 font-semibold', mode === 'formula' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600')} title="검색식 직접 입력">편집기모드</button>
        </div>

        {mode === 'builder' && (
          <>
            <div className="flex items-center justify-between p-2 px-3 bg-gray-50 border border-gray-200 rounded-md mb-2">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-base2 text-gray-700">≡ 기본 검색필드</span>
                <span className="text-sm2 text-blue-700 bg-blue-50 px-2 rounded-full font-semibold">{builder.length}</span>
                <span className="text-xs2 text-gray-400">· 상세 검색조건은 검색 결과의 [모든 필터] 에서 입력 가능</span>
              </div>
              <button className="btn-outline btn-xs opacity-50" disabled title="데모 미구현">검색필드 설정</button>
            </div>

            {/* 검색식 미리보기 */}
            <div className="flex items-start gap-2 p-2 bg-blue-50/40 border border-blue-100 rounded-md mb-1">
              <span className="text-xs2 font-bold text-blue-700 px-2 py-1 bg-white rounded shrink-0">검색식</span>
              <textarea
                rows={1}
                className="flex-1 px-2 py-1 bg-transparent text-md2 font-mono outline-none resize-none"
                value={formula}
                onChange={e => setFormula(e.target.value)}
                placeholder="예: TI=(자율주행*) AND AB=(라이다*) — 필드 입력 시 자동 생성됨"
              />
            </div>
            <div className="text-xs2 text-gray-400 mb-3">↓ 필드별로 검색어를 입력하면 위 검색식이 자동으로 생성됩니다.</div>

            {/* 9 필드 */}
            <div className="space-y-1.5">
              {builder.map((f, idx) => (
                <div key={f.code} className="flex items-center gap-2 p-1.5 bg-white border border-gray-200 rounded-md hover:border-blue-200">
                  {/* 필드 코드+라벨 */}
                  <div className="w-28 shrink-0">
                    <div className="text-xs2 font-mono font-bold text-gray-500">{f.code}</div>
                    <div className="text-sm2 font-semibold text-gray-700 leading-tight">{f.label}</div>
                  </div>

                  {/* IPC_ALL: Original/Current 선택 + 입력 */}
                  {f.code === 'IPC_ALL' ? (
                    <div className="flex items-center gap-1 flex-1">
                      <select
                        value={f.ipcScope || 'all'}
                        onChange={e => updateField(idx, { ipcScope: e.target.value as 'all' | 'current' })}
                        className="input py-1 text-xs2 w-36 shrink-0"
                      >
                        <option value="all">Original or Current</option>
                        <option value="current">Current Only</option>
                      </select>
                      <input
                        type="text"
                        value={f.value}
                        onChange={e => updateField(idx, { value: e.target.value })}
                        placeholder="검색식 입력"
                        className="flex-1 px-2 py-1 border border-gray-200 rounded text-md2 outline-none focus:border-blue-500"
                      />
                    </div>
                  ) : f.type === 'date-range' ? (
                    /* AD 필드: 최근 N년 + 날짜 범위 */
                    <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                      <span className="text-xs2 text-gray-500 shrink-0">최근</span>
                      <input
                        type="number"
                        min={1} max={50}
                        value={f.recentYears || ''}
                        onChange={e => updateField(idx, { recentYears: Number(e.target.value) })}
                        placeholder="N"
                        className="w-12 px-2 py-1 border border-gray-300 rounded text-sm2 text-center"
                      />
                      <span className="text-xs2 text-gray-500 shrink-0">년 또는</span>
                      <input type="date" value={f.dateFrom || ''} onChange={e => updateField(idx, { dateFrom: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-sm2" />
                      <span className="text-gray-400">~</span>
                      <input type="date" value={f.dateTo || ''} onChange={e => updateField(idx, { dateTo: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-sm2" />
                      <span className="text-xs2 text-gray-400">최근 N년</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={f.value}
                      onChange={e => updateField(idx, { value: e.target.value })}
                      placeholder="검색식 입력"
                      className="flex-1 px-2 py-1 border border-gray-200 rounded text-md2 outline-none focus:border-blue-500"
                    />
                  )}

                  {/* 파인더 버튼들 */}
                  {f.finderLabel && f.finderType && (
                    <button onClick={() => setFinderOpen({ type: f.finderType!, fieldIdx: idx })}
                      className="text-xs2 px-2 py-0.5 border border-blue-200 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 shrink-0">
                      {f.finderLabel}
                    </button>
                  )}
                  {f.finderLabel2 && f.finderType2 && (
                    <button onClick={() => setFinderOpen({ type: f.finderType2!, fieldIdx: idx })}
                      className="text-xs2 px-2 py-0.5 border border-blue-200 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 shrink-0">
                      {f.finderLabel2}
                    </button>
                  )}
                  {f.hint && <span className="text-xs2 text-gray-400 cursor-help shrink-0" title={f.hint}>ⓘ</span>}
                  <button onClick={() => removeField(idx)} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded shrink-0" title="제거">×</button>
                </div>
              ))}
            </div>

            <div className="mt-2.5 p-2 px-3 bg-violet-50 border border-dashed border-violet-200 rounded-md text-sm2 text-violet-700 flex items-center gap-1.5">
              <Icon name="help" size={13} />
              <span>인명·분류·일자·국제출원·우선권·표준·서열·과제 등 <strong>상세 검색조건</strong>은 검색 결과의 <strong>[모든 필터]</strong> 에서 입력하시면 검색식에도 함께 반영됩니다.</span>
            </div>

            <div className="flex justify-end gap-1.5 mt-3">
              <button className="btn-outline btn-xs" onClick={resetBuilder}>초기화</button>
              <button className="btn-primary btn-sm text-sm2" onClick={onRun}>검색</button>
            </div>
          </>
        )}

        {mode === 'formula' && (
          <>
            <div className="flex gap-3 mb-2 flex-wrap">
              {(['전문', '명칭+요약', '청구항'] as const).map(s => (
                <label key={s} className="text-sm2 text-gray-600 flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="srch-scope-formula" checked={scopeRadio === s} onChange={() => setScopeRadio(s)} className="accent-blue-700" />
                  {s}
                </label>
              ))}
            </div>
            <textarea
              className="w-full min-h-[100px] p-3 border border-gray-300 rounded-md font-mono text-md2 outline-none focus:border-blue-500"
              value={formulaText}
              onChange={e => setFormulaText(e.target.value)}
              placeholder="예: TI=(자율주행* OR autonomous driving) AND AB=(라이다* OR lidar OR LIDAR) AND IPCM=G01S*"
            />
            <div className="flex justify-between items-center mt-2">
              <div className="flex gap-1 flex-wrap">
                {['AND', 'OR', 'NOT', '( )', '*', '?', 'ADJ', 'NEAR', '" "', '.TI.', '@'].map(op => (
                  <span key={op} className="px-1.5 py-0.5 bg-gray-100 text-xs2 text-gray-600 rounded font-mono cursor-default" title={op}>{op}</span>
                ))}
                {[
                  ['필드코드 도움말', 'fieldHelp'],
                  ['키워드 추천기', 'keyword'],
                  ['번호표기법', 'numfmt'],
                  ['IPC 코드찾기', 'ipc'],
                ].map(([label, k]) => (
                  <button key={k}
                    onClick={() => k === 'keyword' || k === 'numfmt' || k === 'ipc'
                      ? setFinderOpen({ type: k as FinderType, fieldIdx: -1 })
                      : toast.show(`${label} (mockup)`)}
                    className="px-1.5 py-0.5 text-xs2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100">{label}</button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button className="btn-outline btn-xs" onClick={() => setFormulaText('')}>초기화</button>
                <button className="btn-primary btn-sm text-sm2" onClick={onRun}>검색</button>
              </div>
            </div>
          </>
        )}
      </div>
      {finderOpen && (
        <FinderModal
          type={finderOpen.type}
          onApply={val => {
            if (finderOpen.fieldIdx >= 0) {
              updateField(finderOpen.fieldIdx, { value: val });
            }
            setFinderOpen(null);
          }}
          onClose={() => setFinderOpen(null)}
        />
      )}
    </div>
  );
}

function ConfigRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-md2 font-semibold text-gray-500 w-16 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-wrap flex-1">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children, size = 'sm' }: { active?: boolean; onClick?: () => void; children: React.ReactNode; size?: 'xs' | 'sm' }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-full border transition-colors font-medium',
        size === 'xs' ? 'px-2 py-0 text-xs2' : 'px-2.5 py-0.5 text-sm2',
        active
          ? 'bg-blue-700 text-white border-blue-700'
          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-700',
      )}
    >
      {children}
    </button>
  );
}
