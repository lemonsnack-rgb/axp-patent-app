import { useState } from 'react';
import { useStore } from '../store';
import type { TaskType } from '../types';
import { Icon } from '../components/Icon';
import { Card, Input } from '../components/ui';
import clsx from 'clsx';
import { Button } from '@muhayu/axp-ui';

// 검색은 사이드바 메뉴(특허/논문 검색)로 진입하는 단일 워크스페이스가 되어 작업 유형에서 제외.
const TYPES: { type: TaskType; title: string; desc: string; icon: 'doc' | 'search' | 'paper'; color: string }[] = [
  { type: 'spec', title: '명세서', desc: '직무발명서를 분석해 특허 명세서 초안을 작성합니다.', icon: 'doc', color: 'blue' },
];

const PLACEHOLDER: Record<TaskType, string> = {
  spec:          '예: 라이다 기반 실시간 3D 객체 인식 장치',
  patent_search: '예: 자율주행 객체 인식 특허 검색',
  paper_search:  '예: LiDAR 딥러닝 논문 리뷰',
};

export function NewTaskView() {
  const { taskAdd, setActiveTaskId, setMode, tasks } = useStore();
  const [selectedType, setSelectedType] = useState<TaskType | null>(null);
  const [name, setName] = useState('');
  const [techField, setTechField] = useState('');

  const handleSelect = (type: TaskType) => {
    setSelectedType(type);
    setName('');
    setTechField('');
  };

  const submit = () => {
    if (!selectedType) return;
    const meta = TYPES.find(t => t.type === selectedType)!;
    const nt = taskAdd({
      type: selectedType,
      name: name.trim() || `새 ${meta.title}`,
      techField: techField.trim() || undefined,
    });
    setActiveTaskId(nt.id);
    setMode(selectedType === 'spec' ? 'spec' : 'search');
  };

  const cancel = () => {
    const recentSpec = [...tasks]
      .filter(t => t.type === 'spec')
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (recentSpec) {
      setActiveTaskId(recentSpec.id);
      setMode('spec');
    } else {
      setMode('home');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-thin flex flex-col items-center pt-16 pb-12 px-8 bg-zinc-50">
      <div className="max-w-2xl w-full text-center mb-8">
        <h2 className="text-h1 font-bold text-zinc-900 tracking-tight mb-2">새 작업 만들기</h2>
        <p className="text-lg2 text-zinc-500">작업 유형을 선택하세요.</p>
      </div>

      {/* 작업 유형 카드 */}
      <div className="grid grid-cols-1 gap-3 max-w-md w-full mb-5">
        {TYPES.map(t => {
          const isSelected = selectedType === t.type;
          return (
            <button
              key={t.type}
              onClick={() => handleSelect(t.type)}
              className={clsx(
                'relative flex flex-col items-start gap-3 p-5 bg-white rounded-xl text-left border-2 transition-all duration-200 shadow-card min-h-[130px]',
                isSelected
                  ? 'border-brand-400 bg-brand-50 shadow-[0_0_0_3px_rgba(59,142,245,0.12)] active:scale-[0.99]'
                  : 'border-zinc-200 hover:border-zinc-300 hover:shadow-card-hover active:scale-[0.98]',
              )}
            >
              {isSelected && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand-400 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
                    <polyline points="1.5,5 4,7.5 8.5,2.5"/>
                  </svg>
                </span>
              )}
              <span className={`w-11 h-11 rounded-lg flex items-center justify-center bg-${t.color}-50 text-${t.color}-600`}>
                <Icon name={t.icon} size={22} />
              </span>
              <div>
                <div className="text-base2 font-bold text-zinc-800 mb-0.5">{t.title}</div>
                <div className="text-xs2 text-zinc-400 leading-snug">{t.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 입력 폼 */}
      {selectedType && (
        <Card className="max-w-2xl w-full animate-fade-up">
          <Field label="작업 이름 (선택)">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={PLACEHOLDER[selectedType]}
              maxLength={80}
              autoFocus
            />
            {selectedType === 'spec' && (
              <div className="text-xs2 text-zinc-400 mt-1">
                발명의 명칭을 입력하면 명세서 작성 중 자동 반영됩니다.
              </div>
            )}
          </Field>
          {selectedType === 'spec' && (
            <Field label="기술분야 (선택)">
              <Input
                value={techField}
                onChange={e => setTechField(e.target.value)}
                placeholder="예: 자율주행 LIDAR, 무선통신, 의료영상"
                maxLength={60}
              />
            </Field>
          )}
          <div className="flex justify-end gap-2 mt-3 pt-3.5 border-t border-zinc-100">
            <Button variant="outlined" color="primary" size="sm" onClick={cancel}>취소</Button>
            <Button variant="filled" color="primary" size="sm" onClick={submit}>작업 만들기</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 mb-3.5">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
