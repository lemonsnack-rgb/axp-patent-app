import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Input } from './ui';

export function QuickNameModal({ open, title, placeholder = '이름을 입력하세요', onSubmit, onClose }: {
  open: boolean;
  title: string;
  placeholder?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');

  useEffect(() => { if (open) setValue(''); }, [open]);

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-sm"
      footer={<>
        <button className="btn-outline btn-sm" onClick={onClose}>취소</button>
        <button className="btn-primary btn-sm" disabled={!value.trim()} onClick={handleSubmit}>확인</button>
      </>}
    >
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        autoFocus
        maxLength={60}
      />
    </Modal>
  );
}
