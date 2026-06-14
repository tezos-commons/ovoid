import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Agent } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import {
  closePoll,
  createPoll,
  getPoll,
  getResults,
  vote,
  type CreatePollInput,
} from '@/lib/poll/client'

// Tallies and viewer state change as people vote; a short stale window keeps the
// card fresh on revisit without polling.
const POLL_STALE = 15_000

export function pollOptions(agent: Agent, id: string) {
  return queryOptions({
    queryKey: qk.poll(id),
    queryFn: () => getPoll(agent, id),
    staleTime: POLL_STALE,
  })
}

export function pollResultsOptions(agent: Agent, id: string) {
  return queryOptions({
    queryKey: qk.pollResults(id),
    queryFn: () => getResults(agent, id).then((r) => r.results),
    staleTime: POLL_STALE,
  })
}

export function usePoll(id: string) {
  const { agent } = useAgent()
  return useQuery(pollOptions(agent, id))
}

/** Results are only fetched once the service says they're visible to the viewer. */
export function usePollResults(id: string, enabled: boolean) {
  const { agent } = useAgent()
  return useQuery({ ...pollResultsOptions(agent, id), enabled })
}

export function useVote(id: string) {
  const { agent } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (choices: number[]) => vote(agent, id, choices),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.poll(id) })
      qc.invalidateQueries({ queryKey: qk.pollResults(id) })
    },
  })
}

export function useClosePoll(id: string) {
  const { agent } = useAgent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => closePoll(agent, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.poll(id) })
      qc.invalidateQueries({ queryKey: qk.pollResults(id) })
    },
  })
}

export function useCreatePoll() {
  const { agent } = useAgent()
  return useMutation({ mutationFn: (input: CreatePollInput) => createPoll(agent, input) })
}
