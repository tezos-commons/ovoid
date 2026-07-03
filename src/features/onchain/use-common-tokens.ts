import { queryOptions, useQuery } from '@tanstack/react-query'
import type { Agent } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { qk } from '@/lib/query-keys'
import { indexerGet } from './indexer'

/**
 * app.ovoid.indexer.getCommonTokens — NFTs connecting the viewer to another
 * user (see indx/docs/api.md): up to 5 tokens the other user holds that the
 * viewer created, plus up to 5 tokens both hold.
 */

const NSID = 'app.ovoid.indexer.getCommonTokens'

interface CommonTokenRaw {
  contract: string
  token_id: string
  name: string | null
  last_change_level: number
  other_amount: string | null
  /** Viewer's balance; null in `created` when the viewer doesn't hold it. */
  caller_amount: string | null
}

export interface CommonToken extends CommonTokenRaw {
  /** The viewer currently holds this token too. */
  mine: boolean
  /** From the `created` section: the other user collected the viewer's
   *  creation — the golden-ring treatment. */
  createdByViewer: boolean
}

export function commonTokensOptions(agent: Agent, did: string | undefined, other: string) {
  return queryOptions({
    queryKey: qk.commonTokens(did, other),
    // Holdings move on balance-change timescales; five minutes matches the
    // other indexer reads.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CommonToken[]> => {
      const res = await indexerGet<{ created?: CommonTokenRaw[]; common?: CommonTokenRaw[] }>(
        agent,
        NSID,
        { other },
      )
      const mark = (t: CommonTokenRaw, createdByViewer: boolean): CommonToken => ({
        ...t,
        createdByViewer,
        mine: t.caller_amount != null && t.caller_amount !== '0',
      })
      // The viewer's creations lead the row (golden rings first — the API
      // already orders created before common), each half in recency order.
      // ≤10 by construction.
      return [
        ...(res.created ?? []).map((t) => mark(t, true)),
        ...(res.common ?? []).map((t) => mark(t, false)),
      ]
    },
  })
}

/** Disabled for the viewer's own profile — there is nothing "in common". */
export function useCommonTokens(other: string | undefined) {
  const { agent, did, isAuthed } = useAgent()
  return useQuery({
    ...commonTokensOptions(agent, did, other ?? ''),
    enabled: isAuthed && !!other && other !== did,
  })
}
