import type { AppBskyActorDefs } from '@atproto/api'
import { EmptyState, ErrorState, InfiniteList, PeopleSkeleton, Icons } from '@/components'
import { ScreenHeader, useHideMobileTopBar } from '@/components/layout'
import { PersonRow } from '@/features/profile/PersonRow'

export interface ActorListScreenProps {
  title: string
  people: AppBskyActorDefs.ProfileView[]
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: () => void
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  fetchNextPage?: () => void
  emptyTitle: string
  scrollKey: string
}

/**
 * Routed actor list (liked-by / reposted-by). Window-virtualized like every
 * other route feed; rows reuse the shared PersonRow so a Follow control and
 * profile prefetch come for free. Back-navigable header (reached from a thread).
 */
export function ActorListScreen({
  title,
  people,
  isLoading,
  isError,
  error,
  refetch,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  emptyTitle,
  scrollKey,
}: ActorListScreenProps) {
  useHideMobileTopBar()
  return (
    <>
      <ScreenHeader title={title} showBack />
      {isLoading ? (
        <PeopleSkeleton count={8} />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <InfiniteList<AppBskyActorDefs.ProfileView>
          items={people}
          getKey={(p) => p.did}
          estimateSize={72}
          scrollKey={scrollKey}
          cursorNav={false}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          emptyState={<EmptyState icon={<Icons.PersonIcon size={32} />} title={emptyTitle} />}
          renderItem={(p) => <PersonRow person={p} />}
        />
      )}
    </>
  )
}
