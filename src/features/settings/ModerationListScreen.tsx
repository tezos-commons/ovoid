import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { AppBskyActorDefs } from '@atproto/api'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import {
  Avatar,
  Button,
  Screen,
  Spinner,
  ErrorState,
  EmptyState,
  InfiniteList,
  LabelChips,
} from '@/components'
import { useMutes, useBlocks, useUnmute, useUnblock } from './use-moderation-lists'

type Kind = 'muted' | 'blocked'

/**
 * Lists the viewer's muted or blocked accounts with an undo action per row.
 * Both endpoints are cursor-paginated and return `ProfileView[]`; the only
 * per-kind differences are which query/mutation to use and the field name on
 * each page, so the two routes share this one component.
 */
export default function ModerationListScreen({ kind }: { kind: Kind }) {
  const mutes = useMutes()
  const blocks = useBlocks()
  const unmute = useUnmute()
  const unblock = useUnblock()

  const q = kind === 'muted' ? mutes : blocks
  const action = kind === 'muted' ? unmute : unblock

  const people = useMemo<AppBskyActorDefs.ProfileView[]>(
    () =>
      kind === 'muted'
        ? (mutes.data?.pages.flatMap((p) => p.mutes) ?? [])
        : (blocks.data?.pages.flatMap((p) => p.blocks) ?? []),
    [kind, mutes.data, blocks.data],
  )

  const title = kind === 'muted' ? 'Muted accounts' : 'Blocked accounts'
  const header = <ScreenHeader title={title} showBack />

  if (q.isLoading) {
    return (
      <Screen top={header}>
        <div className="settings" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
          <Spinner />
        </div>
      </Screen>
    )
  }
  if (q.isError) {
    return (
      <Screen top={header}>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Screen>
    )
  }

  return (
    <Screen top={header}>
      <InfiniteList<AppBskyActorDefs.ProfileView>
        items={people}
        getKey={(p) => p.did}
        estimateSize={72}
        hasNextPage={q.hasNextPage}
        isFetchingNextPage={q.isFetchingNextPage}
        fetchNextPage={q.fetchNextPage}
        emptyState={
          <EmptyState
            title={`No ${kind} accounts`}
            message={
              kind === 'muted'
                ? "Accounts you mute won't appear in your feeds or notifications."
                : "Accounts you block can't see your posts or interact with you."
            }
          />
        }
        renderItem={(p) => (
          <div className="modlist-row">
            <Link to={`/profile/${p.handle || p.did}`} className="modlist-row__main">
              <Avatar src={p.avatar} alt={p.displayName || p.handle} size="md" />
              <div className="modlist-row__meta">
                <span className="modlist-row__name">{p.displayName || p.handle}</span>
                <span className="modlist-row__handle">@{p.handle}</span>
                <LabelChips labels={p.labels} className="modlist-row__labels" />
              </div>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              loading={action.isPending && action.variables?.did === p.did}
              onClick={() => action.mutate(p)}
            >
              {kind === 'muted' ? 'Unmute' : 'Unblock'}
            </Button>
          </div>
        )}
      />
    </Screen>
  )
}
