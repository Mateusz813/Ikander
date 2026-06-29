import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../auth/AuthProvider'
import { useMarkKissesSeen, useUnseenKisses } from '../lib/hooks'

// Pełnoekranowa, urocza animacja gdy dostaniesz buziaczka od drugiej osoby.
export function KissOverlay() {
  const { me, partner } = useAuth()
  const { data: unseen } = useUnseenKisses(me?.id)
  const markSeen = useMarkKissesSeen()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (unseen && unseen.length > 0) {
      setShow(true)
      markSeen.mutate(unseen.map((k) => k.id))
      const t = setTimeout(() => setShow(false), 3000)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseen])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="kiss-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShow(false)}
        >
          <motion.div
            className="kiss-overlay__box"
            initial={{ scale: 0.6, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14 }}
          >
            <motion.div
              className="kiss-overlay__emoji"
              animate={{ rotate: [0, -12, 12, 0], scale: [1, 1.18, 1] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            >
              💋
            </motion.div>
            <p className="kiss-overlay__text">{partner?.display_name} myśli o Tobie 💕</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
