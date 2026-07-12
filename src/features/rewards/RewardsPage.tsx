import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../../auth/AuthProvider'
import {
  useCreateReward,
  useDeleteReward,
  useFulfillRedemption,
  usePoints,
  useProposePrice,
  useRedeemReward,
  useRedemptions,
  useRespondPrice,
  useRewards,
  useUpdateReward,
} from '../../lib/hooks'
import type { Redemption, Reward } from '../../lib/types'
import type { RewardInput } from '../../lib/api'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmojiPicker } from '../../components/EmojiPicker'
import { REWARD_EMOJIS } from '../../lib/emojis'
import { formatDateTime } from '../../lib/dates'

type Tab = 'mine' | 'partner' | 'history'

export function RewardsPage() {
  const { me, partner } = useAuth()
  const { data: rewards } = useRewards()
  const { data: redemptions } = useRedemptions()
  const { data: points } = usePoints()

  const redeem = useRedeemReward()
  const fulfill = useFulfillRedemption()
  const removeReward = useDeleteReward()
  const proposePrice = useProposePrice()
  const respondPrice = useRespondPrice()

  const [tab, setTab] = useState<Tab>('mine')
  const [editing, setEditing] = useState<Reward | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Reward | null>(null)
  const [confirmRedeem, setConfirmRedeem] = useState<Reward | null>(null)
  const [confirmFulfill, setConfirmFulfill] = useState<Redemption | null>(null)
  const [priceFor, setPriceFor] = useState<Reward | null>(null)
  const [error, setError] = useState<string | null>(null)

  const balance = points?.find((p) => p.user_id === me?.id)?.balance ?? 0

  const rewardMap = useMemo(() => {
    const m = new Map<string, Reward>()
    for (const r of rewards ?? []) m.set(r.id, r)
    return m
  }, [rewards])

  // jednorazowe: wykupione (consumed) znikają z katalogów, zostają w historii
  const myCatalog = (rewards ?? []).filter((r) => r.recipient_id === me?.id && !r.consumed_at)
  const partnerCatalog = (rewards ?? []).filter(
    (r) => r.recipient_id === partner?.id && !r.consumed_at,
  )

  const pending = (redemptions ?? []).filter((r) => r.status === 'pending')
  const history = (redemptions ?? []).filter((r) => r.status === 'fulfilled')

  function nameOf(userId: string | null | undefined): string {
    if (userId === me?.id) return me?.display_name ?? ''
    if (userId === partner?.id) return partner?.display_name ?? ''
    return '—'
  }

  function nego(r: Reward) {
    const active = r.nego_price != null && r.nego_by != null
    return { active, iProposed: active && r.nego_by === me?.id, myTurn: active && r.nego_by !== me?.id }
  }

  async function respond(r: Reward, accept: boolean) {
    setError(null)
    try {
      await respondPrice.mutateAsync({ id: r.id, accept })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się odpowiedzieć')
    }
  }

  function NegoBanner({ r }: { r: Reward }) {
    const n = nego(r)
    if (!n.active) return null
    return (
      <div className="nego">
        <span className="nego__label">
          💬 {nameOf(r.nego_by)} proponuje <strong>{r.nego_price} ⭐</strong>
        </span>
        {n.iProposed ? (
          <span className="nego__wait">⏳ Czekasz na odpowiedź</span>
        ) : (
          <span className="nego__turn">🔔 Twój ruch</span>
        )}
      </div>
    )
  }

  function negoActions(r: Reward) {
    return (
      <div className="nego__actions">
        <button
          className="btn btn--primary btn--sm"
          disabled={respondPrice.isPending}
          onClick={() => respond(r, true)}
        >
          Akceptuj {r.nego_price} ⭐
        </button>
        <button
          className="btn btn--ghost btn--sm"
          disabled={respondPrice.isPending}
          onClick={() => respond(r, false)}
        >
          Odrzuć
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => setPriceFor(r)}>
          Kontroferta
        </button>
      </div>
    )
  }

  function mineFooter(r: Reward) {
    const n = nego(r)
    if (n.myTurn) return negoActions(r)
    if (n.iProposed) {
      return (
        <div className="reward-actions">
          <button className="btn btn--ghost btn--sm" onClick={() => setPriceFor(r)}>
            Zmień ofertę
          </button>
        </div>
      )
    }
    return (
      <div className="reward-actions">
        <button
          className="btn btn--primary btn--sm"
          disabled={balance < r.cost || redeem.isPending}
          onClick={() => {
            setError(null)
            setConfirmRedeem(r)
          }}
        >
          Wykup za {r.cost} ⭐
        </button>
        {!r.is_default && (
          <button className="btn btn--ghost btn--sm" onClick={() => setPriceFor(r)}>
            Negocjuj
          </button>
        )}
      </div>
    )
  }

  function partnerFooter(r: Reward) {
    const n = nego(r)
    if (n.myTurn) return negoActions(r)
    if (n.iProposed) {
      return (
        <div className="reward-actions">
          <button className="btn btn--ghost btn--sm" onClick={() => setPriceFor(r)}>
            Zmień ofertę
          </button>
        </div>
      )
    }
    return (
      <div className="card__actions">
        <span className="card__cost">{r.cost} ⭐</span>
        <button className="iconbtn" onClick={() => setEditing(r)} title="Edytuj">
          ✏️
        </button>
        {!r.is_default && (
          <button className="iconbtn" onClick={() => setToDelete(r)} title="Usuń">
            🗑️
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page__head">
        <h2 className="page__title">Nagrody</h2>
        <div className="points-pill">
          Masz <strong>{balance}</strong> ⭐
        </div>
      </div>

      {/* Do wykonania / oczekujące */}
      {pending.length > 0 && (
        <div className="pending">
          <h3 className="pending__title">⏳ Do wykonania</h3>
          <div className="pending__list">
            {pending.map((r) => {
              const reward = rewardMap.get(r.reward_id)
              const mineToPerform = r.recipient_id === partner?.id
              return (
                <motion.div
                  key={r.id}
                  className="pending__item"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <span className="pending__icon">{reward?.icon ?? '🎁'}</span>
                  <div className="pending__info">
                    <strong>{reward?.name ?? 'Nagroda'}</strong>
                    <span className="muted">
                      {mineToPerform
                        ? `${nameOf(r.recipient_id)} to wykupił/a — Twoja kolej!`
                        : `Ty wykupiłeś/aś — czeka na ${nameOf(partner?.id)}`}{' '}
                      · {formatDateTime(r.redeemed_at)}
                    </span>
                  </div>
                  <button className="btn btn--primary btn--sm" onClick={() => setConfirmFulfill(r)}>
                    Wykonane ✓
                  </button>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Zakładki */}
      <div className="tabs">
        <button className={`tab ${tab === 'mine' ? 'is-active' : ''}`} onClick={() => setTab('mine')}>
          Dla mnie
        </button>
        <button
          className={`tab ${tab === 'partner' ? 'is-active' : ''}`}
          onClick={() => setTab('partner')}
        >
          Dla {partner?.display_name}
        </button>
        <button
          className={`tab ${tab === 'history' ? 'is-active' : ''}`}
          onClick={() => setTab('history')}
        >
          Historia
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'mine' && (
            <div className="cards cards--stack">
              {myCatalog.length === 0 && <p className="muted">Brak nagród. Poproś partnera 😉</p>}
              {myCatalog.map((r) => (
                <RewardCard
                  key={r.id}
                  reward={r}
                  highlight={nego(r).active}
                  banner={<NegoBanner r={r} />}
                  footer={mineFooter(r)}
                />
              ))}
            </div>
          )}

          {tab === 'partner' && (
            <>
              <div className="page__subhead">
                <span className="muted">Nagrody, które {partner?.display_name} może wykupić.</span>
                <button className="btn btn--primary btn--sm" onClick={() => setEditing('new')}>
                  + Nowa nagroda
                </button>
              </div>
              <div className="cards cards--stack">
                {partnerCatalog.map((r) => (
                  <RewardCard
                    key={r.id}
                    reward={r}
                    highlight={nego(r).active}
                    banner={<NegoBanner r={r} />}
                    footer={partnerFooter(r)}
                  />
                ))}
              </div>
            </>
          )}

          {tab === 'history' && (
            <div className="history">
              {history.length === 0 && <p className="muted">Jeszcze nic nie wykonano.</p>}
              {history.map((r) => {
                const reward = rewardMap.get(r.reward_id)
                return (
                  <div key={r.id} className="history__item">
                    <span className="history__icon">{reward?.icon ?? '🎁'}</span>
                    <div className="history__info">
                      <strong>{reward?.name ?? 'Nagroda'}</strong>
                      <span className="muted">
                        Wykupił/a: {nameOf(r.recipient_id)} · za {r.cost} ⭐ ·{' '}
                        {r.fulfilled_at ? formatDateTime(r.fulfilled_at) : ''}
                      </span>
                    </div>
                    <span className="history__badge">wykonane ✓</span>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <p className="banner banner--error">{error}</p>}

      {/* Formularz nagrody */}
      {editing && partner && (
        <RewardForm
          reward={editing === 'new' ? null : editing}
          recipientName={partner.display_name}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Popup negocjacji ceny */}
      {priceFor && (
        <PriceModal
          reward={priceFor}
          busy={proposePrice.isPending}
          onClose={() => setPriceFor(null)}
          onSubmit={async (price) => {
            setError(null)
            try {
              await proposePrice.mutateAsync({ id: priceFor.id, price })
              setPriceFor(null)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Nie udało się zaproponować')
              setPriceFor(null)
            }
          }}
        />
      )}

      {/* Usuwanie nagrody */}
      <ConfirmDialog
        open={!!toDelete}
        title="Usunąć nagrodę?"
        message={`Czy na pewno usunąć „${toDelete?.name}"?`}
        confirmLabel="Usuń"
        busy={removeReward.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await removeReward.mutateAsync(toDelete.id)
          setToDelete(null)
        }}
      />

      {/* Potwierdzenie wykupu */}
      <ConfirmDialog
        open={!!confirmRedeem}
        title="Wykupić nagrodę?"
        message={`Wykupić „${confirmRedeem?.name}" za ${confirmRedeem?.cost} ⭐? Punkty zostaną odjęte${
          confirmRedeem?.is_default ? '' : ', a nagroda jest jednorazowa'
        }.`}
        confirmLabel="Wykup"
        busy={redeem.isPending}
        onCancel={() => setConfirmRedeem(null)}
        onConfirm={async () => {
          if (!confirmRedeem) return
          try {
            await redeem.mutateAsync(confirmRedeem.id)
            setConfirmRedeem(null)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Nie udało się wykupić')
            setConfirmRedeem(null)
          }
        }}
      />

      {/* Potwierdzenie wykonania */}
      <ConfirmDialog
        open={!!confirmFulfill}
        title="Nagroda wykonana?"
        message={`Czy na pewno „${rewardMap.get(confirmFulfill?.reward_id ?? '')?.name ?? 'ta nagroda'}" została wykonana?`}
        confirmLabel="Tak, wykonane"
        busy={fulfill.isPending}
        onCancel={() => setConfirmFulfill(null)}
        onConfirm={async () => {
          if (!confirmFulfill) return
          try {
            await fulfill.mutateAsync(confirmFulfill.id)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Nie udało się oznaczyć')
          }
          setConfirmFulfill(null)
        }}
      />
    </div>
  )
}

function RewardCard({
  reward,
  highlight,
  banner,
  footer,
}: {
  reward: Reward
  highlight?: boolean
  banner?: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <motion.div
      className={`card card--reward ${highlight ? 'card--nego' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <div className="card__icon card__icon--lg">{reward.icon}</div>
      <div className="card__body">
        <div className="card__title">
          {reward.name}
          {reward.is_default && <span className="tag">domyślna</span>}
        </div>
        <div className="card__sub">{reward.cost} punktów</div>
        {banner}
      </div>
      <div className="card__footer">{footer}</div>
    </motion.div>
  )
}

function PriceModal({
  reward,
  busy,
  onClose,
  onSubmit,
}: {
  reward: Reward
  busy: boolean
  onClose: () => void
  onSubmit: (price: number) => void | Promise<void>
}) {
  const [price, setPrice] = useState(String(reward.nego_price ?? reward.cost))
  const valid = Number(price) > 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    void onSubmit(Number(price))
  }

  return (
    <Modal open onClose={onClose} title={`Negocjuj: ${reward.name}`} maxWidth={380}>
      <form className="form" onSubmit={submit}>
        <p className="muted" style={{ margin: 0 }}>
          Aktualna cena: <strong>{reward.cost} ⭐</strong>
          {reward.nego_price != null && (
            <>
              {' '}
              · ostatnia propozycja: <strong>{reward.nego_price} ⭐</strong>
            </>
          )}
        </p>
        <label className="field">
          <span className="field__label">Twoja propozycja (punkty)</span>
          <input
            className="input"
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            autoFocus
          />
        </label>
        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Anuluj
          </button>
          <button type="submit" className="btn btn--primary" disabled={!valid || busy}>
            {busy ? 'Wysyłanie…' : 'Wyślij propozycję'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RewardForm({
  reward,
  recipientName,
  onClose,
}: {
  reward: Reward | null
  recipientName: string
  onClose: () => void
}) {
  const { me, partner } = useAuth()
  const create = useCreateReward(me?.id ?? '')
  const update = useUpdateReward()
  const [name, setName] = useState(reward?.name ?? '')
  const [icon, setIcon] = useState(reward?.icon ?? REWARD_EMOJIS[0])
  const [cost, setCost] = useState(String(reward?.cost ?? 5))

  const valid = name.trim() && Number(cost) > 0
  const busy = create.isPending || update.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || !partner) return
    if (reward) {
      await update.mutateAsync({
        id: reward.id,
        input: { name: name.trim(), icon, cost: Number(cost) },
      })
    } else {
      const input: RewardInput = {
        recipient_id: partner.id,
        name: name.trim(),
        icon,
        cost: Number(cost),
      }
      await create.mutateAsync(input)
    }
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={reward ? 'Edytuj nagrodę' : `Nowa nagroda dla ${recipientName}`}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Nazwa</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Masażyk pleców"
            autoFocus
          />
        </label>
        <div className="field">
          <span className="field__label">Ikona</span>
          <EmojiPicker value={icon} options={REWARD_EMOJIS} onChange={setIcon} />
        </div>
        <label className="field">
          <span className="field__label">Koszt (punkty)</span>
          <input
            className="input"
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            min={1}
          />
        </label>
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
