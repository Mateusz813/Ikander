import { motion } from 'framer-motion'

interface EmojiPickerProps {
  value: string
  options: string[]
  onChange: (emoji: string) => void
}

export function EmojiPicker({ value, options, onChange }: EmojiPickerProps) {
  return (
    <div className="emoji-grid">
      {options.map((emoji) => (
        <motion.button
          key={emoji}
          type="button"
          className={`emoji-grid__item ${value === emoji ? 'is-active' : ''}`}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onChange(emoji)}
        >
          {emoji}
        </motion.button>
      ))}
    </div>
  )
}
