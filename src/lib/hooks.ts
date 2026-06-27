import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import { supabase } from './supabase'
import type { ActionInput, RewardInput } from './api'
import type { UUID } from './types'

export const qk = {
  points: ['points'] as const,
  actions: (uid: UUID) => ['actions', uid] as const,
  logs: ['logs'] as const,
  logsRange: (start: string, end: string) => ['logs', start, end] as const,
  dayStatus: ['dayStatus'] as const,
  dayStatusRange: (start: string, end: string) => ['dayStatus', start, end] as const,
  rewards: ['rewards'] as const,
  redemptions: ['redemptions'] as const,
  feedback: ['feedback'] as const,
}

// ---------- Zapytania ----------
export function usePoints() {
  return useQuery({ queryKey: qk.points, queryFn: api.fetchPoints })
}

export function useActions(userId: UUID | undefined) {
  return useQuery({
    queryKey: qk.actions(userId ?? 'none'),
    queryFn: () => api.fetchActions(userId as UUID),
    enabled: !!userId,
  })
}

export function useLogsRange(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: qk.logsRange(start, end),
    queryFn: () => api.fetchLogsRange(start, end),
    enabled,
  })
}

export function useDayStatusRange(start: string, end: string) {
  return useQuery({
    queryKey: qk.dayStatusRange(start, end),
    queryFn: () => api.fetchDayStatusRange(start, end),
  })
}

export function useRewards() {
  return useQuery({ queryKey: qk.rewards, queryFn: api.fetchRewards })
}

export function useRedemptions() {
  return useQuery({ queryKey: qk.redemptions, queryFn: api.fetchRedemptions })
}

export function useFeedback() {
  return useQuery({ queryKey: qk.feedback, queryFn: api.fetchFeedback })
}

// ---------- Mutacje ----------
function useInvalidator() {
  const qc = useQueryClient()
  return {
    progress: () => {
      qc.invalidateQueries({ queryKey: qk.logs })
      qc.invalidateQueries({ queryKey: qk.dayStatus })
      qc.invalidateQueries({ queryKey: qk.points })
    },
    actions: (uid: UUID) => {
      qc.invalidateQueries({ queryKey: qk.actions(uid) })
      qc.invalidateQueries({ queryKey: qk.dayStatus })
      qc.invalidateQueries({ queryKey: qk.points })
    },
    rewards: () => qc.invalidateQueries({ queryKey: qk.rewards }),
    redemptions: () => {
      qc.invalidateQueries({ queryKey: qk.redemptions })
      qc.invalidateQueries({ queryKey: qk.points })
    },
    feedback: () => qc.invalidateQueries({ queryKey: qk.feedback }),
  }
}

export function useUpsertLog() {
  const inv = useInvalidator()
  return useMutation({
    mutationFn: api.upsertLog,
    onSuccess: inv.progress,
  })
}

export function useCreateAction(userId: UUID) {
  const inv = useInvalidator()
  return useMutation({
    mutationFn: (input: ActionInput) => api.createAction(userId, input),
    onSuccess: () => inv.actions(userId),
  })
}

export function useUpdateAction(userId: UUID) {
  const inv = useInvalidator()
  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: Partial<ActionInput> }) =>
      api.updateAction(id, input),
    onSuccess: () => inv.actions(userId),
  })
}

export function useDeleteAction(userId: UUID) {
  const inv = useInvalidator()
  return useMutation({
    mutationFn: (id: UUID) => api.deleteAction(id),
    onSuccess: () => inv.actions(userId),
  })
}

export function useCreateReward(createdBy: UUID) {
  const inv = useInvalidator()
  return useMutation({
    mutationFn: (input: RewardInput) => api.createReward(createdBy, input),
    onSuccess: inv.rewards,
  })
}

export function useUpdateReward() {
  const inv = useInvalidator()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: UUID
      input: Partial<Pick<RewardInput, 'name' | 'icon' | 'cost'>>
    }) => api.updateReward(id, input),
    onSuccess: inv.rewards,
  })
}

export function useDeleteReward() {
  const inv = useInvalidator()
  return useMutation({
    mutationFn: (id: UUID) => api.deleteReward(id),
    onSuccess: inv.rewards,
  })
}

export function useRedeemReward() {
  const inv = useInvalidator()
  return useMutation({
    mutationFn: (rewardId: UUID) => api.redeemReward(rewardId),
    onSuccess: inv.redemptions,
  })
}

export function useFulfillRedemption() {
  const inv = useInvalidator()
  return useMutation({
    mutationFn: (id: UUID) => api.fulfillRedemption(id),
    onSuccess: inv.redemptions,
  })
}

export function useCreateFeedback(authorId: UUID) {
  const inv = useInvalidator()
  return useMutation({
    mutationFn: (body: string) => api.createFeedback(authorId, body),
    onSuccess: inv.feedback,
  })
}

export function useSetFeedbackDone() {
  const inv = useInvalidator()
  return useMutation({
    mutationFn: ({ id, done }: { id: UUID; done: boolean }) => api.setFeedbackDone(id, done),
    onSuccess: inv.feedback,
  })
}

export function useDeleteFeedback() {
  const inv = useInvalidator()
  return useMutation({
    mutationFn: (id: UUID) => api.deleteFeedback(id),
    onSuccess: inv.feedback,
  })
}

// ---------- Realtime ----------
// Zmiany w bazie (też te zrobione przez partnera na innym urządzeniu)
// odświeżają odpowiednie zapytania na żywo.
export function useRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('ikander-db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'action_logs' }, () => {
        qc.invalidateQueries({ queryKey: qk.logs })
        qc.invalidateQueries({ queryKey: qk.dayStatus })
        qc.invalidateQueries({ queryKey: qk.points })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actions' }, () => {
        qc.invalidateQueries({ queryKey: ['actions'] })
        qc.invalidateQueries({ queryKey: qk.dayStatus })
        qc.invalidateQueries({ queryKey: qk.points })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards' }, () => {
        qc.invalidateQueries({ queryKey: qk.rewards })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_redemptions' }, () => {
        qc.invalidateQueries({ queryKey: qk.redemptions })
        qc.invalidateQueries({ queryKey: qk.points })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => {
        qc.invalidateQueries({ queryKey: qk.feedback })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc])
}
