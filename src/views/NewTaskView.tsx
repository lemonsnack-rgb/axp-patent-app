import { useState } from 'react';
import { useStore } from '../store';
import { useToast } from '../components/Toast';
import type { TaskType } from '../types';
import { Icon } from '../components/Icon';
import clsx from 'clsx';

const TYPES: { type: TaskType; title: string; desc: string; icon: any; color: string }[] = [
  { type: 'spec',          title: '명세서',     desc: '직무발명서를 분석해 명세서 초안을 작성합니다.', icon: 'doc',    color: 'blue' },
  { type: 'patent_search', title: '특허 검색', desc: '국내·해외 특허를 검색해 선행기술을 조사합니다.', icon: 'search', color: 'violet' },
  { type: 'paper_search',  title: '논문 검색', desc: '학술 논문·저널을 검색해 참고문헌을 수집합니다.', icon: 'paper',  color: 'amber' },
];

const PLACEHOLDER: Record<TaskType, string> = {
  spec:          '발명의 명칭을 입력하면 자동 반영됩니다',
  patent_search: '검색식 일부가 자동 반영됩니다 (첫 검색 시)',
  paper_search:  '검색식 일부가 자동 반영됩니다 (첫 검색 시)',
};

export function NewTaskView() {
  const { taskAdd, setActiveTaskId, setMode, projects, clients, contactByClient, tasks, projectAdd, clientAdd } = useStore();
  const toast = useToast();
  const [type, setType] = useState<TaskType | null>(null);
  const [name, setName] = useState('');
  const [techField, setTechField] = useState('');
  const [projectId, setProjectId] = useState('');
  const [clientId, setClientId] = useState('');
  const [contactId, setContactId] = useState('');

  const submit = () => {
    if (!type) return;
    const meta = TYPES.find(t => t.type === type)!;
    const nt = taskAdd({
      type,
      name: name.trim() || `새 ${meta.title}`,
      techField: techField.trim() || undefined,
      folderId: projectId || undefined,
      clientId: clientId || undefined,
      contactId: contactId || undefined,
    });
    setActiveTaskId(nt.id);
    setMode(nt.type === 'spec' ? 'spec' : 'search');
  };

  const cancel = () => {
    if (tasks.length > 0) {
      const recent = [...tasks].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      setActiveTaskId(recent.id);
      setMode(recent.type === 'spec' ? 'spec' : 'search');
    } else {
      setMode('home');
    }
  };

  const quickAddProject = () => {
    const n = prompt('새 프로젝트 이름:');
    if (n?.trim()) {
      const p = projectAdd({ name: n.trim(), color: '#1e5fa6' });
      setProjectId(p.id);
      toast.show(`프로젝트 추가: ${p.name}`);
    }
  };
  const quickAddClient = () => {
    const n = prompt('새 고객사 이름:');
    if (!n?.trim()) return;
    const industry = prompt('업종 (선택):') || '';
    const c = clientAdd({ name: n.trim(), industry: industry || undefined });
    setClientId(c.id);
    toast.show(`고객사 추가: ${c.name}`);
  };

  const contacts = clientId ? contactByClient(clientId) : [];

  return (
    <div className="flex-1 overflow-y-auto scroll-thin flex flex-col items-center pt-16 pb-12 px-8 bg-zinc-50">
      <div className="max-w-3xl w-full text-center mb-9">
        <h2 className="text-h1 font-bold text-zinc-900 tracking-tight mb-2.5">어떤 작업을 시작하시겠어요?</h2>
        <p className="text-lg2 text-zinc-500">작업 유형을 선택하고, 필요하면 이름·프로젝트·고객사를 지정하세요.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-3xl w-full mb-6">
        {TYPES.map(t => (
          <button
            key={t.type}
            onClick={() => setType(t.type)}
            className={clsx(
              'flex flex-col gap-2 p-5 bg-white rounded-xl text-left border-2 transition-all min-h-[140px] active:scale-[0.98]',
              type === t.type
                ? 'border-blue-600 bg-blue-50 shadow-card-deep'
                : 'border-zinc-200 hover:border-blue-500 hover:-translate-y-0.5 hover:shadow-card-hover',
            )}
          >
            <span className={`w-12 h-12 rounded-lg flex items-center justify-center bg-${t.color}-50 text-${t.color}-700`}>
              <Icon name={t.icon} size={28} />
            </span>
            <div className="text-lg2 font-bold text-zinc-800">{t.title}</div>
            <div className="text-sm2 text-zinc-500 leading-snug">{t.desc}</div>
          </button>
        ))}
      </div>

      {type && (
        <div className="card max-w-[760px] w-full p-5 animate-fade-up">
          <Field label="작업 이름 (선택)">
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={PLACEHOLDER[type]} maxLength={80} autoFocus />
            <div className="text-xs2 text-zinc-400 mt-1">검색 작업: 첫 검색 시 검색식 일부 · 명세서: 발명의 명칭 입력 시 자동 반영</div>
          </Field>
          <Field label="기술분야 (선택)">
            <input className="input" value={techField} onChange={e => setTechField(e.target.value)} placeholder="예: 자율주행 LIDAR, 무선통신, 의료영상" maxLength={60} />
          </Field>
          <Field label="프로젝트 (선택)">
            <div className="flex gap-1.5">
              <select className="input flex-1" value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">— 프로젝트 미지정 —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn-outline btn-sm whitespace-nowrap" onClick={quickAddProject}>+ 새 프로젝트</button>
            </div>
          </Field>
          <div className="flex flex-col gap-1.5 mb-3.5">
            <label className="label flex items-center gap-1.5">
              고객사 (선택)
              <button
                onClick={() => setMode('clients')}
                className="text-xs2 text-blue-600 font-medium hover:underline"
              >고객사 관리 →</button>
            </label>
            <div className="flex gap-1.5">
              <select className="input flex-1" value={clientId} onChange={e => { setClientId(e.target.value); setContactId(''); }}>
                <option value="">— 미지정 —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.industry ? ` · ${c.industry}` : ''}</option>)}
              </select>
              <button className="btn-outline btn-sm whitespace-nowrap" onClick={quickAddClient}>+ 새로 추가</button>
            </div>
          </div>
          {clientId && (
            <Field label="담당자 (선택)">
              <select className="input" value={contactId} onChange={e => setContactId(e.target.value)}>
                <option value="">— 미지정 —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : ''}</option>)}
              </select>
            </Field>
          )}
          <div className="flex justify-end gap-2 mt-3 pt-3.5 border-t border-zinc-100">
            <button className="btn-outline btn-sm" onClick={cancel}>취소</button>
            <button className="btn-primary btn-sm" disabled={!type} onClick={submit}>작업 만들기</button>
          </div>
        </div>
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
