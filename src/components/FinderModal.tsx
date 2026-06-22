// FinderModal — 외부 파인더 모달 (키워드추천 / IPC코드찾기 / 번호표기법 / 대표명화)
import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Button } from '@muhayu/axp-ui';
import { Icon } from './Icon';
import { Badge, Input } from './ui';

export type FinderType = 'keyword' | 'ipc' | 'cpc' | 'applicantCode' | 'applicantUniq' | 'numfmt';

interface Props {
  type: FinderType;
  onApply: (value: string) => void;
  onClose: () => void;
}

// ── 데이터 ──
const IPC_TREE = [
  { code: 'A', label: '생활필수품', children: [
    { code: 'A01', label: '농업; 임업; 축산; 사냥; 포획; 어업', children: [
      { code: 'A01B', label: '농업 또는 임업의 토양처리; 농업기계 일반' },
      { code: 'A01D', label: '수확; 풀깎기' },
    ]},
    { code: 'A61', label: '의학 또는 수의학; 위생', children: [
      { code: 'A61B', label: '진단; 수술; 개인식별' },
      { code: 'A61K', label: '의약용 제제' },
    ]},
  ]},
  { code: 'G', label: '물리학', children: [
    { code: 'G01', label: '측정; 시험', children: [
      { code: 'G01C', label: '거리·각도·면적 측정; 항법' },
      { code: 'G01S', label: '무선전파·음파·광파를 이용한 측위·방향탐지', children: [
        { code: 'G01S 7/00', label: '레이다 시스템의 구성요소' },
        { code: 'G01S 13/00', label: '레이다 시스템 일반' },
        { code: 'G01S 17/00', label: '라이다(LiDAR) 시스템 일반' },
        { code: 'G01S 17/93', label: '자동차/교통수단용 라이다' },
      ]},
    ]},
    { code: 'G06', label: '계산; 산출; 계수', children: [
      { code: 'G06F', label: '전기적 디지털 데이터 처리' },
      { code: 'G06N', label: '특정한 계산 모델에 의거한 컴퓨터 시스템' },
      { code: 'G06T', label: '이미지 데이터 처리 일반', children: [
        { code: 'G06T 7/00', label: '이미지 해석' },
        { code: 'G06T 17/00', label: '3차원 모델링' },
      ]},
      { code: 'G06V', label: '이미지 또는 비디오 인식·이해' },
    ]},
  ]},
  { code: 'H', label: '전기', children: [
    { code: 'H04', label: '전기통신기술', children: [
      { code: 'H04L', label: '디지털 정보 전송' },
      { code: 'H04W', label: '무선 통신 네트워크' },
    ]},
  ]},
];

const KEYWORD_SYNONYMS: Record<string, { kor: string[]; eng: string[] }> = {
  '자율주행': { kor: ['무인운전', '자동운전', '자율운전', '자율주행차량'], eng: ['autonomous driving', 'self-driving', 'driverless', 'AV'] },
  '라이다': { kor: ['LiDAR', '레이저레이다', '라이더센서', '3D레이저스캐너'], eng: ['LiDAR', 'laser radar', 'lidar sensor', 'laser scanner'] },
  '딥러닝': { kor: ['심층학습', '신경망학습', 'DNN', 'CNN', 'RNN'], eng: ['deep learning', 'neural network', 'DNN', 'machine learning'] },
  '객체인식': { kor: ['객체탐지', '물체인식', '대상인식', '오브젝트검출'], eng: ['object detection', 'object recognition'] },
};

const APPLICANT_MOCK = [
  { code: 'UN000001', name: '엘지전자(주)', country: 'KR', uniq: '119990527105' },
  { code: 'UN000002', name: '삼성전자(주)', country: 'KR', uniq: '119980001112' },
  { code: 'UN000003', name: '현대자동차(주)', country: 'KR', uniq: '119870000219' },
  { code: 'UN000004', name: '기아(주)', country: 'KR', uniq: '119870000220' },
  { code: 'UN000005', name: 'Toyota Motor Corporation', country: 'JP', uniq: 'JP000000456' },
  { code: 'UN000006', name: 'Waymo LLC', country: 'US', uniq: 'US000001789' },
  { code: 'UN000007', name: 'Tesla, Inc.', country: 'US', uniq: 'US000003421' },
];

const NUM_FORMATS = [
  { country: 'KR', name: '대한민국', patterns: ['10-XXXX-XXXXXXX', '10-XXXX-XXXXXXX A (공개)', '10-XXXXXXX (등록)'], note: '출원: 10-연도-일련번호, 등록: 10-일련번호' },
  { country: 'US', name: '미국', patterns: ['US XXXXXXXX B2 (등록)', 'US XXXX/XXXXXXX A1 (공개)'], note: '등록: US숫자 B1/B2, 공개: US숫자/숫자 A1' },
  { country: 'JP', name: '일본', patterns: ['JP XXXX-XXXXXX A (공개)', 'JP XXXXXXX B2 (등록)'], note: '공개: JP연도-일련번호 A, 등록: JP숫자 B' },
  { country: 'CN', name: '중국', patterns: ['CN XXXXXXXXXX A (공개)', 'CN XXXXXXXXXX B (등록)'], note: 'CN숫자 A/B, 실용신안: CN숫자 U' },
  { country: 'EP', name: '유럽', patterns: ['EP XXXXXXX A1 (공개)', 'EP XXXXXXX B1 (등록)'], note: 'EP숫자 A1/B1' },
  { country: 'WO', name: 'PCT 국제출원', patterns: ['WO XXXX/XXXXXX A1'], note: 'WO연도/일련번호 A1/A2' },
];

const TITLES: Record<FinderType, string> = {
  keyword: '키워드 추천기',
  ipc: 'IPC 코드찾기',
  cpc: 'CPC 코드찾기',
  applicantCode: '대표명화 코드찾기',
  applicantUniq: '출원인 고유번호 찾기',
  numfmt: '번호 표기법 가이드',
};

const PLACEHOLDERS: Record<FinderType, string> = {
  keyword: '추천받을 키워드 입력 (예: 자율주행)',
  ipc: 'IPC 코드 또는 설명 검색 (예: G01S 또는 라이다)',
  cpc: 'CPC 코드 또는 설명 검색',
  applicantCode: '출원인명/코드로 검색',
  applicantUniq: '출원인명/고유번호로 검색',
  numfmt: '국가명 또는 번호유형 검색',
};

export function FinderModal({ type, onApply, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 540, maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="text-base2 font-semibold text-gray-800">{TITLES[type]}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><Icon name="close" size={16} /></button>
        </div>

        {/* 검색 */}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="relative">
            <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              ref={inputRef}
              className="pl-8 py-2 text-sm2"
              placeholder={PLACEHOLDERS[type]}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto scroll-thin">
          {(type === 'ipc' || type === 'cpc') && (
            <IpcTree nodes={IPC_TREE} query={query.toLowerCase()} selected={selected} onSelect={setSelected} />
          )}
          {(type === 'applicantCode' || type === 'applicantUniq') && (
            <ApplicantList type={type} query={query.toLowerCase()} selected={selected} onSelect={setSelected} />
          )}
          {type === 'keyword' && (
            <KeywordRec query={query.toLowerCase()} onAdd={v => setSelected(p => p ? `${p} OR ${v}` : v)} selected={selected} />
          )}
          {type === 'numfmt' && (
            <NumFormats query={query.toLowerCase()} />
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
          <span className="text-xs2 text-gray-400">
            {type === 'ipc' || type === 'cpc' ? '노드 클릭으로 선택' :
             type === 'keyword' ? '추천 키워드 클릭으로 OR 조합에 추가' :
             type === 'numfmt' ? '국가별 번호 표기법 가이드' : '행 클릭으로 선택'}
          </span>
          <div className="flex gap-2">
            <Button variant="outlined" color="primary" size="xs" onClick={onClose}>취소</Button>
            {type !== 'numfmt' && (
              <Button
                variant="filled"
                color="primary"
                size="sm"
                className="text-xs2"
                disabled={!selected.trim()}
                onClick={() => { if (selected) { onApply(selected); onClose(); } }}
              >
                선택 적용
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── IPC 트리 ──
interface TreeNode { code: string; label: string; children?: TreeNode[] }
function IpcTree({ nodes, query, selected, onSelect, depth = 0 }: {
  nodes: TreeNode[]; query: string; selected: string;
  onSelect: (code: string) => void; depth?: number;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  return (
    <div className={clsx('p-2', depth > 0 && 'ml-4')}>
      {nodes.map(n => {
        const match = !query || n.code.toLowerCase().includes(query) || n.label.toLowerCase().includes(query);
        if (!match && !n.children?.length) return null;
        const isExp = expanded[n.code] ?? (!!query || depth < 1);
        return (
          <div key={n.code}>
            <div
              onClick={() => onSelect(n.code)}
              className={clsx(
                'flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer hover:bg-blue-50 transition-colors',
                selected === n.code && 'bg-blue-50 border border-blue-400',
              )}
            >
              {n.children?.length ? (
                <button
                  onClick={e => { e.stopPropagation(); setExpanded(p => ({ ...p, [n.code]: !isExp })); }}
                  className="text-gray-400 hover:text-blue-600 w-4 text-center shrink-0 text-xs2"
                >
                  {isExp ? '▾' : '▸'}
                </button>
              ) : <span className="w-4 shrink-0" />}
              <span className="text-xs2 font-mono font-semibold text-blue-700 shrink-0">{n.code}</span>
              <span className="text-xs2 text-gray-600">{n.label}</span>
            </div>
            {n.children && isExp && (
              <IpcTree nodes={n.children} query={query} selected={selected} onSelect={onSelect} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 출원인 목록 ──
function ApplicantList({ type, query, selected, onSelect }: {
  type: FinderType; query: string; selected: string; onSelect: (v: string) => void;
}) {
  const filtered = APPLICANT_MOCK.filter(d =>
    !query || d.name.toLowerCase().includes(query) ||
    d.code.toLowerCase().includes(query) ||
    d.uniq.toLowerCase().includes(query)
  );
  const valKey = type === 'applicantUniq' ? 'uniq' : 'code';
  return (
    <div className="p-2">
      <table className="w-full text-xs2">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left px-2 py-1.5 font-semibold text-gray-600">{type === 'applicantUniq' ? '고유번호' : '대표명화 코드'}</th>
            <th className="text-left px-2 py-1.5 font-semibold text-gray-600">명칭</th>
            <th className="text-left px-2 py-1.5 font-semibold text-gray-600">국가</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(d => (
            <tr
              key={d.code}
              onClick={() => onSelect(d[valKey])}
              className={clsx(
                'cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100',
                selected === d[valKey] && 'bg-blue-50',
              )}
            >
              <td className="px-2 py-1.5 font-mono text-blue-700">{d[valKey]}</td>
              <td className="px-2 py-1.5 text-gray-700">{d.name}</td>
              <td className="px-2 py-1.5 text-gray-500">{d.country}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 키워드 추천기 ──
function KeywordRec({ query, onAdd, selected }: { query: string; onAdd: (v: string) => void; selected: string }) {
  const keys = Object.keys(KEYWORD_SYNONYMS).filter(k =>
    !query || k.toLowerCase().includes(query)
  );
  return (
    <div className="p-3 space-y-4">
      {selected && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
          <p className="text-xs2 text-gray-500 mb-1">선택된 검색식</p>
          <p className="text-sm2 font-mono text-blue-800 break-all">{selected}</p>
        </div>
      )}
      {keys.length === 0 && (
        <p className="text-sm2 text-gray-400 text-center py-4">일치하는 키워드 없음</p>
      )}
      {keys.map(k => {
        const syns = KEYWORD_SYNONYMS[k];
        return (
          <div key={k} className="border border-gray-200 rounded-lg p-3">
            <p className="text-sm2 font-semibold text-gray-700 mb-2">{k}</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="text-xs2 text-gray-400 self-center">한국어:</span>
              {syns.kor.map(s => (
                <button key={s} onClick={() => onAdd(s)}
                  className="px-2 py-0.5 rounded-full text-xs2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs2 text-gray-400 self-center">영어:</span>
              {syns.eng.map(s => (
                <button key={s} onClick={() => onAdd(s)}
                  className="px-2 py-0.5 rounded-full text-xs2 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
                  {s}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 번호 표기법 가이드 ──
function NumFormats({ query }: { query: string }) {
  const filtered = NUM_FORMATS.filter(f =>
    !query || f.country.toLowerCase().includes(query) || f.name.toLowerCase().includes(query)
  );
  return (
    <div className="p-3 space-y-3">
      {filtered.map(f => (
        <div key={f.country} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Badge color="neutral" className="font-mono font-bold">{f.country}</Badge>
            <span className="text-sm2 font-semibold text-gray-700">{f.name}</span>
          </div>
          {f.patterns.map((p, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <code className="text-xs2 bg-gray-100 px-2 py-0.5 rounded font-mono text-blue-700">{p}</code>
            </div>
          ))}
          <p className="text-xs2 text-gray-400 mt-1">{f.note}</p>
        </div>
      ))}
    </div>
  );
}
