import { useState } from 'react';
import { useStore } from '../store';
import { Card, Input } from '../components/ui';
import { SiteFooter } from '../components/SiteFooter';
import { Button } from '@muhayu/axp-ui';

// 검색은 사이드바 메뉴(특허/논문 검색)로 분리되어, 작업 생성 = 명세서 단일.
// 따라서 "작업 유형 선택" 단계 없이 명세서 작성 폼으로 바로 진입한다.
export function NewTaskView() {
  const { taskAdd, setActiveTaskId, setMode, tasks } = useStore();
  const [name, setName] = useState('');
  const [techField, setTechField] = useState('');

  const submit = () => {
    const nt = taskAdd({
      type: 'spec',
      name: name.trim() || '새 명세서',
      techField: techField.trim() || undefined,
    });
    setActiveTaskId(nt.id);
    setMode('spec');
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
      <div className="max-w-xl w-full text-center mb-8">
        <h2 className="text-h1 font-bold text-zinc-900 tracking-tight mb-2">새 명세서 작성</h2>
        <p className="text-lg2 text-zinc-500">발명 정보를 입력해 명세서 초안 작성을 시작하세요.</p>
      </div>

      <Card className="max-w-xl w-full animate-fade-up">
        <Field label="작업 이름 (선택)">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="예: 라이다 기반 실시간 3D 객체 인식 장치"
            maxLength={80}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          />
          <div className="text-xs2 text-zinc-400 mt-1">
            발명의 명칭을 입력하면 명세서 작성 중 자동 반영됩니다.
          </div>
        </Field>
        <Field label="기술분야 (선택)">
          <Input
            value={techField}
            onChange={e => setTechField(e.target.value)}
            placeholder="예: 자율주행 LIDAR, 무선통신, 의료영상"
            maxLength={60}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          />
        </Field>
        <div className="flex justify-end gap-2 mt-3 pt-3.5 border-t border-zinc-100">
          <Button variant="outlined" color="primary" size="sm" onClick={cancel}>취소</Button>
          <Button variant="filled" color="primary" size="sm" onClick={submit}>명세서 작성 시작</Button>
        </div>
      </Card>
      {/* 서비스 푸터 — 하단 고정(빈 공간 채움), px-8 상쇄해 풀블리드 */}
      <div className="mt-auto -mx-8 self-stretch">
        <SiteFooter />
      </div>
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
