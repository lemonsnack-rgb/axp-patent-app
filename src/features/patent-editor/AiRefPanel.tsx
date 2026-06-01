// AiRefPanel — AI 부호 위치 추천 패널
// 편집기 열릴 때 자동 분석 → 최대 5개 추천 → 개별 수락/거절
import { useState } from 'react';
import { Check, X, MapPin, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { AiRefRecommendation, InventionComponent } from './types';

interface Props {
  recommendations: AiRefRecommendation[];
  loading: boolean;
  components: InventionComponent[];
  onAccept: (rec: AiRefRecommendation, linkedComponentNumber: string) => void;
  onReject: (recId: string) => void;
  onNumberChange: (recId: string, newNumber: string) => void;
  onComponentChange: (recId: string, componentNumber: string) => void;
}

export function AiRefPanel({
  recommendations, loading, components,
  onAccept, onReject, onNumberChange, onComponentChange,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const pending = recommendations.filter(r => r.status === 'pending');
  const accepted = recommendations.filter(r => r.status === 'accepted');

  return (
    <div className="border-b border-ck-border bg-amber-50 shrink-0">
      {/* 헤더 */}
      <button
        type="button"
        onClick={() => setCollapsed(p => !p)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-amber-100 transition-colors"
      >
        <MapPin size={13} className="text-amber-600 shrink-0" />
        <span className="text-xs2 font-semibold text-amber-800">AI 부호 위치 추천</span>
        {loading ? (
          <span className="flex items-center gap-1 text-xs2 text-amber-600 ml-1">
            <Loader2 size={10} className="animate-spin" /> 분석 중…
          </span>
        ) : (
          <span className="text-xs2 text-amber-600 ml-1">
            {pending.length > 0
              ? `검토 대기 ${pending.length}개`
              : accepted.length > 0
                ? `${accepted.length}개 수락됨`
                : '모두 처리됨'}
          </span>
        )}
        <div className="ml-auto">
          {collapsed ? <ChevronDown size={12} className="text-amber-600" /> : <ChevronUp size={12} className="text-amber-600" />}
        </div>
      </button>

      {/* 추천 목록 */}
      {!collapsed && (
        <div className="px-3 pb-2 space-y-1">
          {loading ? (
            <div className="flex gap-2 py-1">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="flex-1 h-8 bg-amber-200 rounded animate-pulse" />
              ))}
            </div>
          ) : recommendations.length === 0 ? (
            <p className="text-xs2 text-amber-600 py-1">추천 결과가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {recommendations.map(rec => {
                if (rec.status === 'rejected') return null;
                const isAccepted = rec.status === 'accepted';
                return (
                  <div key={rec.id}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs2 transition-all ${
                      isAccepted
                        ? 'border-green-300 bg-green-50 text-green-700'
                        : 'border-amber-300 bg-white text-gray-700'
                    }`}>
                    {/* 위치 배지 */}
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs2 shrink-0 ${
                      isAccepted ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {isAccepted ? <Check size={10} /> : '●'}
                    </span>

                    {/* 번호 편집 */}
                    {!isAccepted ? (
                      <input
                        type="text"
                        value={rec.refNumber}
                        onChange={e => onNumberChange(rec.id, e.target.value)}
                        className="w-12 border border-gray-300 rounded px-1 py-0 text-xs2 font-mono font-bold text-center focus:border-blue-500 focus:outline-none"
                        title="부호 번호 (수정 가능)"
                      />
                    ) : (
                      <span className="font-mono font-bold w-12 text-center">{rec.refNumber}</span>
                    )}

                    {/* 구성요소 선택 */}
                    {!isAccepted ? (
                      <select
                        value={components.find(c => c.name === rec.componentName)?.number ?? ''}
                        onChange={e => onComponentChange(rec.id, e.target.value)}
                        className="border border-gray-300 rounded px-1 py-0 text-xs2 focus:border-blue-500 focus:outline-none max-w-[110px]"
                      >
                        <option value="">-- 구성요소 선택</option>
                        {components.map(c => (
                          <option key={c.number} value={c.number}>
                            ({c.number}) {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs2 text-green-700 max-w-[110px] truncate">{rec.componentName}</span>
                    )}

                    {/* 수락 / 거절 */}
                    {!isAccepted && (
                      <>
                        <button
                          type="button"
                          onClick={() => onAccept(rec, components.find(c => c.name === rec.componentName)?.number ?? '')}
                          title="수락 — 캔버스에 부호 삽입"
                          className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shrink-0"
                        >
                          <Check size={9} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onReject(rec.id)}
                          title="거절"
                          className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center hover:bg-red-100 hover:text-red-600 shrink-0"
                        >
                          <X size={9} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 안내 */}
          {!loading && pending.length > 0 && (
            <p className="text-xs2 text-amber-600 mt-1">
              ※ 캔버스의 오렌지 배지를 드래그하여 위치를 조정할 수 있습니다. 수락 버튼으로 부호를 확정하세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
