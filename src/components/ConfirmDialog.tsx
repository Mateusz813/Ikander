import type { ReactNode } from 'react'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title = 'Na pewno?',
  message,
  confirmLabel = 'Tak',
  cancelLabel = 'Anuluj',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidth={400}>
      <p className="confirm__message">{message}</p>
      <div className="confirm__actions">
        <button className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button className="btn btn--primary" onClick={onConfirm} disabled={busy}>
          {busy ? '…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
