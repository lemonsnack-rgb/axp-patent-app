import { Modal } from './Modal';

export function ConfirmModal({ open, message, confirmLabel = '확인', danger = true, onConfirm, onCancel }: {
  open: boolean;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="확인"
      width="max-w-sm"
      footer={<>
        <button className="btn-outline btn-sm" onClick={onCancel}>취소</button>
        <button
          className={`btn-sm px-4 h-8 text-sm2 font-semibold rounded-lg active:scale-[0.98] transition-all ${danger ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-brand-400 text-white hover:bg-brand-500'}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </>}
    >
      <p className="text-md2 text-zinc-700 leading-relaxed whitespace-pre-wrap">{message}</p>
    </Modal>
  );
}
