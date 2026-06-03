import { Link } from 'react-router-dom'
import type {
  AppBskyFeedDefs,
  AppBskyGraphDefs,
} from '@atproto/api'
import { Avatar, Spinner, ErrorState, EmptyState } from '@/components'
import { HeartIcon } from '@/components/Icon'
import { useAuthorFeeds, useAuthorLists } from './use-author-feeds'

/** Custom feeds the actor created. */
export function ProfileFeedsTab({ actor }: { actor: string }) {
  const q = useAuthorFeeds(actor)
  const feeds: AppBskyFeedDefs.GeneratorView[] =
    q.data?.pages.flatMap((p) => p.feeds) ?? []

  if (q.isLoading)
    return (
      <div className="proffeed__center">
        <Spinner />
      </div>
    )
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (feeds.length === 0) return <EmptyState title="No feeds" />

  return (
    <div className="proflist">
      {feeds.map((f) => {
        const rkey = f.uri.split('/').pop() ?? ''
        return (
          <Link
            key={f.uri}
            to={`/profile/${f.creator.handle || f.creator.did}/feed/${rkey}`}
            className="profcard"
          >
            <Avatar src={f.avatar} alt={f.displayName} size="lg" shape="rounded-square" />
            <div className="profcard__meta">
              <span className="profcard__name">{f.displayName}</span>
              <span className="profcard__sub">
                Feed by @{f.creator.handle}
                {typeof f.likeCount === 'number' && (
                  <>
                    {' · '}
                    <HeartIcon size={12} /> {f.likeCount}
                  </>
                )}
              </span>
              {f.description && <span className="profcard__desc">{f.description}</span>}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

/** Lists the actor owns. */
export function ProfileListsTab({ actor }: { actor: string }) {
  const q = useAuthorLists(actor)
  const lists: AppBskyGraphDefs.ListView[] = q.data?.pages.flatMap((p) => p.lists) ?? []

  if (q.isLoading)
    return (
      <div className="proffeed__center">
        <Spinner />
      </div>
    )
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (lists.length === 0) return <EmptyState title="No lists" />

  const purposeLabel = (p: string) =>
    p.endsWith('modlist') ? 'Moderation list' : p.endsWith('referencelist') ? 'Starter pack' : 'User list'

  return (
    <div className="proflist">
      {lists.map((l) => {
        const rkey = l.uri.split('/').pop() ?? ''
        return (
          <Link
            key={l.uri}
            to={`/profile/${l.creator.handle || l.creator.did}/lists/${rkey}`}
            className="profcard"
          >
            <Avatar src={l.avatar} alt={l.name} size="lg" shape="rounded-square" />
            <div className="profcard__meta">
              <span className="profcard__name">{l.name}</span>
              <span className="profcard__sub">
                {purposeLabel(l.purpose)} · by @{l.creator.handle}
              </span>
              {l.description && <span className="profcard__desc">{l.description}</span>}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
