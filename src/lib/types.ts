export type UUID = string

export interface Profile {
  id: UUID
  display_name: string
  partner_id: UUID | null
  created_at: string
}

export type ActionType = 'check' | 'quantity'

export interface ActionDef {
  id: UUID
  user_id: UUID
  name: string
  icon: string
  type: ActionType
  target: number | null
  unit: string | null
  quick_add: number[]
  is_default: boolean
  sort_order: number
  created_at: string
}

export interface ActionLog {
  id: UUID
  action_id: UUID
  user_id: UUID
  date: string // 'yyyy-MM-dd'
  progress: number
  completed: boolean
  completed_at: string | null
  updated_at: string
}

export interface Reward {
  id: UUID
  recipient_id: UUID // kto wykupuje (wydaje punkty)
  created_by: UUID // partner, który wykonuje
  name: string
  icon: string
  cost: number
  is_default: boolean
  created_at: string
}

export type RedemptionStatus = 'pending' | 'fulfilled'

export interface Redemption {
  id: UUID
  reward_id: UUID
  recipient_id: UUID
  cost: number
  status: RedemptionStatus
  redeemed_at: string
  fulfilled_at: string | null
  fulfilled_by: UUID | null
}

export interface UserPoints {
  user_id: UUID
  earned: number
  spent: number
  balance: number
}

export interface DayStatus {
  user_id: UUID
  date: string
  applicable: number
  done: number
  is_perfect: boolean
}
