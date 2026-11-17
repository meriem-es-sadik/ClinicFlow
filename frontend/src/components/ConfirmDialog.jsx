import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  loading = false,
  onConfirm,
  onClose,
}) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      title={title ?? t('confirm.title')}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={loading}>
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? t('common.working') : confirmLabel ?? t('common.confirm')}
          </button>
        </>
      }
    >
      <div className="confirm-dialog">
        <span className="confirm-dialog__icon">
          <AlertTriangle size={22} />
        </span>
        <p className="confirm-dialog__message">{message}</p>
      </div>
    </Modal>
  );
}
