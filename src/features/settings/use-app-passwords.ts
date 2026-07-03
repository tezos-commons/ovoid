import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ComAtprotoServerListAppPasswords } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'

type AppPassword = ComAtprotoServerListAppPasswords.AppPassword

const KEY = qk.appPasswords

/**
 * List the account's app passwords.
 *
 * Note: under a frontend-only OAuth (DPoP) session the PDS may reject
 * `com.atproto.server.*` app-password management (some PDSs gate these to
 * password-auth sessions). The query surfaces that as an error so the UI can
 * explain it rather than silently fail.
 */
export function useAppPasswords() {
  const { agent, isAuthed } = useAgent()
  return useQuery<AppPassword[]>({
    queryKey: KEY,
    enabled: isAuthed,
    retry: false,
    queryFn: async () => {
      const res = await agent.com.atproto.server.listAppPasswords()
      return res.data.passwords
    },
  })
}

export interface CreatedAppPassword {
  name: string
  password: string
}

export function useCreateAppPassword() {
  const { agent } = useAgent()
  const qc = useQueryClient()
  return useMutation<CreatedAppPassword, unknown, { name: string; privileged: boolean }>({
    mutationFn: async ({ name, privileged }) => {
      const res = await agent.com.atproto.server.createAppPassword({ name, privileged })
      return { name: res.data.name, password: res.data.password }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRevokeAppPassword() {
  const { agent } = useAgent()
  const qc = useQueryClient()
  return useMutation<void, unknown, string>({
    mutationFn: async (name) => {
      await agent.com.atproto.server.revokeAppPassword({ name })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
