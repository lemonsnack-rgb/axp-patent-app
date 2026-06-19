// 논문 검색 입력 영역 — 원본 mockup srch-paper-section 정밀 포팅
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Card, Input } from '../components/ui';
import { FinderModal } from '../components/FinderModal';

// 필드 옵션
const FIELD_OPTIONS = [
  { code: 'TI',  label: '제목' },
  { code: 'AB',  label: '초록' },
  { code: 'KW',  label: '키워드' },
  { code: 'AU',  label: '저자' },
  { code: 'SO',  label: '저널명' },
  { code: 'DOI', label: 'DOI' },
  { code: 'ALL', label: '전체' },
];

type OpType = 'AND' | 'OR' | 'NOT';

interface BuilderRow {
  id: number;
  op: OpType;
  field: string;
  value: string;
}

let _rowId = 0;
const mkRow = (field: string, value: string, op: OpType = 'AND'): BuilderRow =>
  ({ id: ++_rowId, op, field, value });

const DEFAULT_ROWS: BuilderRow[] = [
  mkRow('TI',  'autonomous driving OR 자율주행*'),
  mkRow('AB',  '(lidar OR 라이다) AND object detection'),
  mkRow('KW',  'lidar*'),
];

interface Props { onRun: () => void }

export function PaperInput({ onRun }: Props) {
  const [rows, setRows] = useState<BuilderRow[]>(DEFAULT_ROWS);
  const [finderOpen, setFinderOpen] = useState<{ rowId: number } | null>(null);

  const updateRow = (id: number, patch: Partial<BuilderRow>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const removeRow = (id: number) =>
    setRows(prev => prev.filter(r => r.id !== id));

  const addRow = () =>
    setRows(prev => [...prev, mkRow('TI', '', 'AND')]);

  const reset = () => setRows(DEFAULT_ROWS.map(r => mkRow(r.field, r.value, r.op)));

  const summary = `${rows.length}개 필드 · AND/OR 결합`;

  return (
    <div className="flex-1 overflow-y-auto scroll-thin p-5">
      <Card className="!p-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-md2 font-semibold text-gray-700">
            논문 검색식 빌더
            <span className="ml-2 text-xs2 font-normal text-gray-400">
              — 행 간 결합은 AND/OR/NOT, 각 입력란에 검색식 직접 입력 가능
              (예: <code className="bg-gray-100 px-1 rounded text-gray-600">(lidar OR 라이다*) AND object</code>)
            </span>
          </div>
          <span className="text-xs2 text-gray-400 whitespace-nowrap ml-3">{summary}</span>
        </div>

        {/* 필드 행 */}
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={row.id} className="flex items-center gap-2">
              {/* 행 간 연산자 (첫 행은 고정 레이블) */}
              {idx === 0 ? (
                <span className="text-xs2 font-semibold text-gray-400 w-12 text-right shrink-0">WHERE</span>
              ) : (
                <select
                  className="input py-1.5 text-sm2 w-16 shrink-0 text-center font-semibold"
                  value={row.op}
                  onChange={e => updateRow(row.id, { op: e.target.value as OpType })}
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                  <option value="NOT">NOT</option>
                </select>
              )}

              {/* 필드 선택 */}
              <select
                className="input py-1.5 text-sm2 w-28 shrink-0"
                value={row.field}
                onChange={e => updateRow(row.id, { field: e.target.value })}
              >
                {FIELD_OPTIONS.map(f => (
                  <option key={f.code} value={f.code}>{f.label}</option>
                ))}
              </select>

              {/* 입력 */}
              <Input
                className="py-1.5 text-sm2 flex-1 min-w-0"
                value={row.value}
                placeholder={
                  row.field === 'TI'  ? 'autonomous driving OR 자율주행*' :
                  row.field === 'AB'  ? '(lidar OR 라이다) AND object detection' :
                  row.field === 'KW'  ? '예: lidar*' :
                  row.field === 'AU'  ? '저자명 (예: Kim, J.)' :
                  row.field === 'SO'  ? '저널명 (예: IEEE Trans*)' :
                  row.field === 'DOI' ? '예: 10.1109/TITS.2024.*' :
                  '검색어 입력'
                }
                onChange={e => updateRow(row.id, { value: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && onRun()}
              />

              {/* 키워드 추천 (TI/AB/KW 필드) */}
              {(row.field === 'TI' || row.field === 'AB' || row.field === 'KW') && (
                <button
                  onClick={() => setFinderOpen({ rowId: row.id })}
                  className="text-xs2 px-2 py-0.5 border border-blue-200 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 shrink-0"
                >
                  키워드추천
                </button>
              )}

              {/* 삭제 (2행 이상일 때) */}
              {rows.length > 1 && (
                <button
                  onClick={() => removeRow(row.id)}
                  className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors shrink-0"
                  title="행 삭제"
                >
                  <Icon name="close" size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 하단 */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-md text-sm2 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <Icon name="plus" size={12} />
            필드 추가 (AND 결합)
          </button>
          <div className="flex gap-2">
            <button className="btn-outline btn-sm" onClick={reset}>초기화</button>
            <button className="btn-primary" style={{ padding: '8px 24px', fontSize: '13px' }} onClick={onRun}>
              검색
            </button>
          </div>
        </div>
      </Card>

      {/* 검색 안내 */}
      <div className="flex items-center justify-center mt-12 text-gray-400">
        <div className="text-center max-w-lg">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mx-auto mb-4 text-gray-300">
            <circle cx="11" cy="11" r="7"/>
            <line x1="20" y1="20" x2="16.5" y2="16.5"/>
          </svg>
          <p className="text-sm2 font-medium mb-1">논문 검색식을 입력하고 [검색] 버튼을 누르세요</p>
          <p className="text-xs2 text-gray-300">
            PubMed · Scopus · Web of Science · arXiv · Google Scholar 통합 검색<br/>
            불리언 연산자(AND/OR/NOT), 와일드카드(*), 인접검색(ADJ) 지원
          </p>
        </div>
      </div>

      {finderOpen && (
        <FinderModal
          type="keyword"
          onApply={val => {
            const row = rows.find(r => r.id === finderOpen.rowId);
            if (row) {
              const newVal = row.value ? `${row.value} OR ${val}` : val;
              updateRow(finderOpen.rowId, { value: newVal });
            }
            setFinderOpen(null);
          }}
          onClose={() => setFinderOpen(null)}
        />
      )}
    </div>
  );
}
