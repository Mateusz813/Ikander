import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  maxWidth?: number
}

export function Modal({ open, onClose, title, children, maxWidth = 460 }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal__backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal__panel"
            style={{ maxWidth }}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="modal__header">
                <h2 className="modal__title">{title}</h2>
                <button className="modal__close" onClick={onClose} aria-label="Zamknij">
                  ✕
                </button>
              </div>
            )}
            <div className="modal__body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
