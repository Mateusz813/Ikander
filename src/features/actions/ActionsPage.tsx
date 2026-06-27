import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../auth/AuthProvider'
import { useActions, useCreateAction, useDeleteAction, useUpdateAction } from '../../lib/hooks'
import type { ActionInput } from '../../lib/api'
import type { ActionDef } from '../../lib/types'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmojiPicker } from '../../components/EmojiPicker'
import { ACTION_EMOJIS } from '../../lib/emojis'

const empty: ActionInput = {
  name: '',
  icon: ACTION_EMOJIS[0],
  type: 'check',
  target: null,
  unit: null,
  quick_add: [],
}

export function ActionsPage() {
  const { me } = useAuth()
  const uid = me?.id ?? ''
  const { data: actions } = useActions(me?.id)
  const create = useCreateAction(uid)
  const update = useUpdateAction(uid)
  const remove = useDeleteAction(uid)

  const [editing, setEditing] = useState<ActionDef | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<ActionDef | null>(null)

  return (
    <div className="page">
      <div className="page__head">
        <h2 className="page__title">Twoje akcje</h2>
        <button className="btn btn--primary" onClick={() => setEditing('new')}>
          + Nowa akcja
        </button>
      </div>

      <div className="cards">
        {(actions ?? []).map((a) => (
          <motion.div
            key={a.id}
            className="card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="card__icon">{a.icon}</div>
            <div className="card__body">
              <div className="card__title">
                {a.name}
                {a.is_default && <span className="tag">domyślna</span>}
              </div>
              <div className="card__sub">
                {a.type === 'quantity'
                  ? `Cel: ${a.target} ${a.unit ?? ''}`
                  : 'Odhaczenie'}
              </div>
            </div>
            <div className="card__actions">
              <button className="iconbtn" onClick={() => setEditing(a)} title="Edytuj">
                ✏️
              </button>
              {!a.is_default && (
                <button className="iconbtn" onClick={() => setToDelete(a)} title="Usuń">
                  🗑️
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {editing && (
        <ActionForm
          action={editing === 'new' ? null : editing}
          busy={create.isPending || update.isPending}
          onClose={() => setEditing(null)}
          onSubmit={async (input) => {
            if (editing === 'new') await create.mutateAsync(input)
            else await update.mutateAsync({ id: editing.id, input })
            setEditing(null)
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Usunąć akcję?"
        message={`Czy na pewno usunąć „${toDelete?.name}"? Historia tej akcji zniknie.`}
        confirmLabel="Usuń"
        busy={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id)
          setToDelete(null)
        }}
      />
    </div>
  )
}

function ActionForm({
  action,
  busy,
  onClose,
  onSubmit,
}: {
  action: ActionDef | null
  busy: boolean
  onClose: () => void
  onSubmit: (input: ActionInput) => void | Promise<void>
}) {
  const [name, setName] = useState(action?.name ?? empty.name)
  const [icon, setIcon] = useState(action?.icon ?? empty.icon)
  const [type, setType] = useState<ActionInput['type']>(action?.type ?? 'check')
  const [target, setTarget] = useState<string>(action?.target ? String(action.target) : '')
  const [unit, setUnit] = useState(action?.unit ?? '')
  const [quickAdd, setQuickAdd] = useState(
    action?.quick_add?.length ? action.quick_add.join(', ') : '100, 200, 500',
  )

  const isQuantity = type === 'quantity'
  const valid = name.trim() && (!isQuantity || Number(target) > 0)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const input: ActionInput = isQuantity
      ? {
          name: name.trim(),
          icon,
          type: 'quantity',
          target: Number(target),
          unit: unit.trim() || null,
          quick_add: quickAdd
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0),
        }
      : { name: name.trim(), icon, type: 'check', target: null, unit: null, quick_add: [] }
    void onSubmit(input)
  }

  const isDefault = action?.is_default ?? false

  return (
    <Modal open onClose={onClose} title={action ? 'Edytuj akcję' : 'Nowa akcja'}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Nazwa</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Kreatyna"
            autoFocus
          />
        </label>

        <div className="field">
          <span className="field__label">Ikona</span>
          <EmojiPicker value={icon} options={ACTION_EMOJIS} onChange={setIcon} />
        </div>

        <div className="field">
          <span className="field__label">Typ zaliczenia</span>
          <div className="segmented">
            <button
              type="button"
              className={`segmented__btn ${type === 'check' ? 'is-active' : ''}`}
              onClick={() => !isDefault && setType('check')}
              disabled={isDefault}
            >
              ✓ Odhaczenie
            </button>
            <button
              type="button"
              className={`segmented__btn ${type === 'quantity' ? 'is-active' : ''}`}
              onClick={() => !isDefault && setType('quantity')}
              disabled={isDefault}
            >
              📊 Ilość (cel)
            </button>
          </div>
          {isDefault && <span className="field__hint">Typ domyślnej akcji jest stały.</span>}
        </div>

        {isQuantity && (
          <div className="form__row">
            <label className="field">
              <span className="field__label">Cel</span>
              <input
                className="input"
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="2000"
              />
            </label>
            <label className="field">
              <span className="field__label">Jednostka</span>
              <input
                className="input"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="ml"
              />
            </label>
          </div>
        )}

        {isQuantity && (
          <label className="field">
            <span className="field__label">Szybkie przyciski (po przecinku)</span>
            <input
              className="input"
              value={quickAdd}
              onChange={(e) => setQuickAdd(e.target.value)}
              placeholder="100, 200, 500"
            />
          </label>
        )}

        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Anuluj
          </button>
          <button type="submit" className="btn btn--primary" disabled={!valid || busy}>
            {busy ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
