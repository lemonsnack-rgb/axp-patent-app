import { useState } from 'react';
import { useStore } from '../store';
import { toast, Button } from '@muhayu/axp-ui';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { Card, Input } from '../components/ui';
import type { Client, Contact } from '../types';

interface ClientForm { name: string; industry: string; address: string }
interface ContactForm { name: string; role: string; email: string; phone: string }

export function ClientsView() {
  const { clients, projects, contacts, clientAdd, clientUpdate, clientRemove, contactAdd, contactUpdate, contactRemove, contactByClient } = useStore();
  const [search, setSearch] = useState('');

  const [clientModal, setClientModal] = useState<{ mode: 'new' | 'edit'; id?: string } | null>(null);
  const [clientForm, setClientForm] = useState<ClientForm>({ name: '', industry: '', address: '' });

  const [contactModal, setContactModal] = useState<{ mode: 'new' | 'edit'; clientId: string; id?: string } | null>(null);
  const [contactForm, setContactForm] = useState<ContactForm>({ name: '', role: '', email: '', phone: '' });

  const list = clients.filter(c => !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.industry || '').toLowerCase().includes(search.toLowerCase())
  );

  // === Client modal handlers ===
  const openNewClient = () => {
    setClientForm({ name: '', industry: '', address: '' });
    setClientModal({ mode: 'new' });
  };
  const openEditClient = (c: Client) => {
    setClientForm({ name: c.name, industry: c.industry || '', address: c.address || '' });
    setClientModal({ mode: 'edit', id: c.id });
  };
  const submitClient = () => {
    if (!clientForm.name.trim()) return;
    if (clientModal?.mode === 'new') {
      const c = clientAdd({
        name: clientForm.name.trim(),
        industry: clientForm.industry.trim() || undefined,
        address: clientForm.address.trim() || undefined,
      });
      toast.success(`고객사 등록: ${c.name}`);
    } else if (clientModal?.id) {
      clientUpdate(clientModal.id, {
        name: clientForm.name.trim(),
        industry: clientForm.industry.trim() || undefined,
        address: clientForm.address.trim() || undefined,
      });
      toast('고객사 정보 저장됨');
    }
    setClientModal(null);
  };
  const deleteClient = (c: Client) => {
    const contactCnt = contactByClient(c.id).length;
    const projectCnt = projects.filter(p => p.clientId === c.id).length;
    let msg = `고객사 "${c.name}"을(를) 삭제하시겠습니까?`;
    if (contactCnt > 0) msg += `\n(담당자 ${contactCnt}명도 함께 삭제됩니다)`;
    if (projectCnt > 0) msg += `\n(이 고객사를 참조하는 프로젝트 ${projectCnt}개는 고객사 정보가 제거됩니다)`;
    if (!confirm(msg)) return;
    // cascade: contacts 삭제 + 프로젝트의 clientId 제거
    contacts.filter(co => co.clientId === c.id).forEach(co => contactRemove(co.id));
    clientRemove(c.id);
    toast('고객사 삭제됨');
  };

  // === Contact modal handlers ===
  const openNewContact = (clientId: string) => {
    setContactForm({ name: '', role: '', email: '', phone: '' });
    setContactModal({ mode: 'new', clientId });
  };
  const openEditContact = (clientId: string, ct: Contact) => {
    setContactForm({ name: ct.name, role: ct.role || '', email: ct.email || '', phone: ct.phone || '' });
    setContactModal({ mode: 'edit', clientId, id: ct.id });
  };
  const submitContact = () => {
    if (!contactForm.name.trim() || !contactModal) return;
    const data = {
      name: contactForm.name.trim(),
      role: contactForm.role.trim() || undefined,
      email: contactForm.email.trim() || undefined,
      phone: contactForm.phone.trim() || undefined,
    };
    if (contactModal.mode === 'new') {
      const ct = contactAdd({ clientId: contactModal.clientId, ...data });
      toast.success(`담당자 추가: ${ct.name}`);
    } else if (contactModal.id) {
      contactUpdate(contactModal.id, data);
      toast('담당자 정보 저장됨');
    }
    setContactModal(null);
  };
  const deleteContact = (ct: Contact) => {
    if (!confirm(`담당자 "${ct.name}"을(를) 삭제하시겠습니까?`)) return;
    contactRemove(ct.id);
    toast('담당자 삭제됨');
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-thin p-6 bg-zinc-50">
      <div className="flex items-center gap-2 mb-6 ml-auto justify-end">
        <div className="relative">
          <Icon name="search" size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-7 py-1.5 text-sm2 w-52" placeholder="고객사 검색..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="filled" color="primary" size="sm" onClick={openNewClient}>
          <Icon name="plus" size={13} /> 새 고객사
        </Button>
      </div>

      <div className="space-y-3">
        {list.length === 0 ? (
          <EmptyState
            title={search ? `"${search}" 검색 결과가 없습니다` : '등록된 고객사가 없습니다.'}
            description={search ? undefined : '[+ 새 고객사] 버튼으로 추가하세요.'}
          />
        ) : list.map(c => {
          const cContacts = contactByClient(c.id);
          const cProjects = projects.filter(p => p.clientId === c.id).length;
          return (
            <Card key={c.id} className="!p-0">
              <div className="p-4 flex items-start gap-3 border-b border-zinc-100">
                <span className="w-9 h-9 bg-blue-50 text-blue-700 rounded-md flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg2 font-bold text-zinc-800">{c.name}</h3>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-sm2 text-zinc-500">
                    {c.industry && <span>🏷 {c.industry}</span>}
                    {c.address && <span>📍 {c.address}</span>}
                    <span>👥 담당자 {cContacts.length}명</span>
                    <span>📁 프로젝트 {cProjects}개</span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button variant="outlined" color="primary" size="xs" onClick={() => openEditClient(c)} title="편집">편집</Button>
                  <Button variant="outlined" color="primary" size="xs" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => deleteClient(c)} title="삭제">삭제</Button>
                </div>
              </div>

              {/* 담당자 행 */}
              <div className="p-2.5">
                {cContacts.length > 0 && (
                  <div className="space-y-1 mb-1.5">
                    {cContacts.map(ct => (
                      <div key={ct.id} className="flex items-center gap-3 px-2 py-1.5 hover:bg-zinc-50 rounded-md transition-colors text-md2 border-b border-zinc-100 last:border-0">
                        <span className="font-semibold text-zinc-700 min-w-[80px]">{ct.name}</span>
                        {ct.role && <span className="text-zinc-500 min-w-[80px]">{ct.role}</span>}
                        {ct.email && <span className="text-blue-600 font-mono text-sm2 truncate">{ct.email}</span>}
                        {ct.phone && <span className="text-zinc-600 font-mono text-sm2">{ct.phone}</span>}
                        <div className="ml-auto flex gap-1">
                          <Button variant="text" className="text-xs2 px-2 py-0.5" onClick={() => openEditContact(c.id, ct)}>편집</Button>
                          <button className="text-xs2 px-2 py-0.5 text-red-600 hover:bg-red-50 rounded" onClick={() => deleteContact(ct)}>삭제</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => openNewContact(c.id)}
                  className="w-full text-sm2 text-gray-500 hover:bg-blue-50 hover:text-blue-700 py-1.5 border border-dashed border-gray-200 rounded transition-colors"
                >+ 담당자 추가</button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 고객사 모달 */}
      <ClientModal
        open={!!clientModal}
        mode={clientModal?.mode || 'new'}
        form={clientForm}
        setForm={setClientForm}
        onClose={() => setClientModal(null)}
        onSubmit={submitClient}
      />

      {/* 담당자 모달 */}
      <ContactModal
        open={!!contactModal}
        mode={contactModal?.mode || 'new'}
        clientName={contactModal ? clients.find(c => c.id === contactModal.clientId)?.name || '—' : '—'}
        form={contactForm}
        setForm={setContactForm}
        onClose={() => setContactModal(null)}
        onSubmit={submitContact}
      />
    </div>
  );
}

function ClientModal({ open, mode, form, setForm, onClose, onSubmit }: {
  open: boolean; mode: 'new' | 'edit'; form: ClientForm;
  setForm: (f: ClientForm) => void; onClose: () => void; onSubmit: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'new' ? '새 고객사' : '고객사 편집'}
      footer={<>
        <Button variant="outlined" color="primary" size="sm" onClick={onClose}>취소</Button>
        <Button variant="filled" color="primary" size="sm" disabled={!form.name.trim()} onClick={onSubmit}>
          {mode === 'new' ? '고객사 등록' : '저장'}
        </Button>
      </>}
    >
      <div className="space-y-3">
        <div>
          <label className="label">고객사명 <span className="text-red-600">*</span></label>
          <Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="예: 현대자동차주식회사" maxLength={80} autoFocus />
        </div>
        <div>
          <label className="label">업종 (선택)</label>
          <Input className="mt-1" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="예: 자동차 · 전기·전자 · IT" maxLength={40} />
        </div>
        <div>
          <label className="label">주소 (선택)</label>
          <Input className="mt-1" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="예: 서울 서초구 헌릉로 12" maxLength={120} />
        </div>
      </div>
    </Modal>
  );
}

function ContactModal({ open, mode, clientName, form, setForm, onClose, onSubmit }: {
  open: boolean; mode: 'new' | 'edit'; clientName: string; form: ContactForm;
  setForm: (f: ContactForm) => void; onClose: () => void; onSubmit: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'new' ? '새 담당자' : '담당자 편집'}
      footer={<>
        <Button variant="outlined" color="primary" size="sm" onClick={onClose}>취소</Button>
        <Button variant="filled" color="primary" size="sm" disabled={!form.name.trim()} onClick={onSubmit}>
          {mode === 'new' ? '담당자 등록' : '저장'}
        </Button>
      </>}
    >
      <div className="space-y-3">
        <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded text-md2 text-blue-700 flex items-center gap-1.5">
          <Icon name="user" size={13} />
          <span>고객사: <strong>{clientName}</strong></span>
        </div>
        <div>
          <label className="label">담당자 이름 <span className="text-red-600">*</span></label>
          <Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="예: 김OO 책임" maxLength={60} autoFocus />
        </div>
        <div>
          <label className="label">직책/역할 (선택)</label>
          <Input className="mt-1" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="예: 특허팀장 · 기획팀" maxLength={40} />
        </div>
        <div>
          <label className="label">이메일 (선택)</label>
          <Input type="email" className="mt-1" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" maxLength={80} />
        </div>
        <div>
          <label className="label">전화번호 (선택)</label>
          <Input className="mt-1" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="02-1234-5678" maxLength={20} />
        </div>
      </div>
    </Modal>
  );
}
