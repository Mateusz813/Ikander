import { supabase } from './supabase'
import type {
  ActionDef,
  ActionLog,
  DayStatus,
  Feedback,
  Kiss,
  Profile,
  Redemption,
  Reward,
  UserPoints,
  UUID,
} from './types'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// ---------- Profile ----------
export async function fetchProfiles(): Promise<Profile[]> {
  return unwrap(await supabase.from('profiles').select('*'))
}

// ---------- Akcje ----------
// Zabezpieczenie: gdy kolumna weekdays jeszcze nie istnieje (przed migracją)
// albo jest pusta — traktujemy jako "codziennie".
function normalizeAction(a: ActionDef): ActionDef {
  return {
    ...a,
    weekdays: a.weekdays && a.weekdays.length > 0 ? a.weekdays : [1, 2, 3, 4, 5, 6, 7],
  }
}

export async function fetchActions(userId: UUID): Promise<ActionDef[]> {
  const rows = unwrap<ActionDef[]>(
    await supabase
      .from('actions')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  )
  return rows.map(normalizeAction)
}

export type ActionInput = {
  name: string
  icon: string
  type: ActionDef['type']
  target: number | null
  unit: string | null
  quick_add: number[]
  weekdays: number[]
}

export async function createAction(userId: UUID, input: ActionInput): Promise<ActionDef> {
  return unwrap(
    await supabase
      .from('actions')
      .insert({ ...input, user_id: userId })
      .select()
      .single(),
  )
}

export async function updateAction(id: UUID, input: Partial<ActionInput>): Promise<ActionDef> {
  return unwrap(await supabase.from('actions').update(input).eq('id', id).select().single())
}

export async function deleteAction(id: UUID): Promise<void> {
  const { error } = await supabase.from('actions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------- Logi akcji ----------
export async function fetchLogsRange(
  start: string,
  end: string,
): Promise<ActionLog[]> {
  return unwrap(
    await supabase.from('action_logs').select('*').gte('date', start).lte('date', end),
  )
}

export async function upsertLog(params: {
  action_id: UUID
  user_id: UUID
  date: string
  progress: number
  completed: boolean
}): Promise<ActionLog> {
  const row = {
    action_id: params.action_id,
    user_id: params.user_id,
    date: params.date,
    progress: params.progress,
    completed: params.completed,
    completed_at: params.completed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }
  return unwrap(
    await supabase
      .from('action_logs')
      .upsert(row, { onConflict: 'action_id,date' })
      .select()
      .single(),
  )
}

// ---------- Status dni (kalendarz) ----------
export async function fetchDayStatusRange(
  start: string,
  end: string,
): Promise<DayStatus[]> {
  return unwrap(
    await supabase.from('day_status').select('*').gte('date', start).lte('date', end),
  )
}

// ---------- Punkty ----------
export async function fetchPoints(): Promise<UserPoints[]> {
  return unwrap(await supabase.from('user_points').select('*'))
}

// ---------- Nagrody ----------
export async function fetchRewards(): Promise<Reward[]> {
  return unwrap(
    await supabase.from('rewards').select('*').order('created_at', { ascending: true }),
  )
}

export type RewardInput = {
  recipient_id: UUID
  name: string
  icon: string
  cost: number
}

export async function createReward(createdBy: UUID, input: RewardInput): Promise<Reward> {
  return unwrap(
    await supabase
      .from('rewards')
      .insert({ ...input, created_by: createdBy })
      .select()
      .single(),
  )
}

export async function updateReward(
  id: UUID,
  input: Partial<Pick<RewardInput, 'name' | 'icon' | 'cost'>>,
): Promise<Reward> {
  return unwrap(await supabase.from('rewards').update(input).eq('id', id).select().single())
}

export async function deleteReward(id: UUID): Promise<void> {
  const { error } = await supabase.from('rewards').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------- Wykup / wykonanie nagrody (RPC) ----------
export async function fetchRedemptions(): Promise<Redemption[]> {
  return unwrap(
    await supabase
      .from('reward_redemptions')
      .select('*')
      .order('redeemed_at', { ascending: false }),
  )
}

export async function redeemReward(rewardId: UUID): Promise<Redemption> {
  return unwrap(await supabase.rpc('redeem_reward', { p_reward_id: rewardId }))
}

export async function fulfillRedemption(redemptionId: UUID): Promise<Redemption> {
  return unwrap(await supabase.rpc('fulfill_redemption', { p_redemption_id: redemptionId }))
}

// ---------- Pomysły / komentarze ----------
export async function fetchFeedback(): Promise<Feedback[]> {
  return unwrap(
    await supabase.from('feedback').select('*').order('created_at', { ascending: false }),
  )
}

export async function createFeedback(authorId: UUID, body: string): Promise<Feedback> {
  return unwrap(
    await supabase.from('feedback').insert({ author_id: authorId, body }).select().single(),
  )
}

export async function setFeedbackDone(id: UUID, done: boolean): Promise<Feedback> {
  return unwrap(await supabase.from('feedback').update({ done }).eq('id', id).select().single())
}

export async function deleteFeedback(id: UUID): Promise<void> {
  const { error } = await supabase.from('feedback').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------- Buziaczki 💋 ----------
export async function sendKiss(senderId: UUID, recipientId: UUID): Promise<void> {
  const { error } = await supabase
    .from('kisses')
    .insert({ sender_id: senderId, recipient_id: recipientId })
  if (error) throw new Error(error.message)
}

export async function fetchUnseenKisses(recipientId: UUID): Promise<Kiss[]> {
  return unwrap(
    await supabase
      .from('kisses')
      .select('*')
      .eq('recipient_id', recipientId)
      .is('seen_at', null)
      .order('created_at', { ascending: true }),
  )
}

export async function markKissesSeen(ids: UUID[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('kisses')
    .update({ seen_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw new Error(error.message)
}
