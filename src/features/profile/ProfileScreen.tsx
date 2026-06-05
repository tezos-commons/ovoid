import { useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { PageAside } from '@/components/layout'
import { ProfileCardSkeleton, FeedSkeleton, ErrorState, EmptyState } from '@/components'
import type { TabItem } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { useIsMobile } from '@/lib/use-is-mobile'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { runWhenIdle } from '@/lib/idle'
import { useProfile } from './use-profile'
import { useAuthorFeed, authorFeedOptions } from './use-author-feed'
import { useActorLikes, actorLikesOptions } from './use-actor-likes'
import { ProfileCard } from './ProfileCard'
import { ProfileNav } from './ProfileNav'
import { LabelerCard } from './LabelerCard'
import { ProfileFeed } from './ProfileFeed'
import { ProfileFeedsTab, ProfileListsTab } from './ProfileFeedsTab'
import { NftTab } from './NftTab'
import { useTezosAddress, objktCollectionsOptions } from './use-nfts'
import './profile.css'

type TabKey =
  | 'posts'
  | 'replies'
  | 'media'
  | 'likes'
  | 'feeds'
  | 'lists'
  | 'nfts-created'
  | 'nfts-owned'

/**
 * Profile route. Public-capable: renders for signed-out viewers against the
 * public AppView (the action button + Likes tab are simply hidden without a
 * session). The active tab is a URL search param so tabs are shareable and the
 * back button steps through them.
 *
 * Tab visibility rules (Bluesky parity):
 *   - Likes: own profile only (getActorLikes 403s otherwise).
 *   - Feeds: only when associated.feedgens > 0 (or feed authoring is unknown).
 *   - Lists: only when associated.lists > 0.
 */
export default function ProfileScreen() {
  const { actor } = useParams<{ actor: string }>()
  const { agent, did, isAuthed } = useAgent()
  const profileQ = useProfile(actor)
  const [params, setParams] = useSearchParams()
  const isMobile = useIsMobile()

  const profile = profileQ.data
  const isSelf = !!profile && (profile.did === did)

  const hasFeeds = (profile?.associated?.feedgens ?? 0) > 0
  const hasLists = (profile?.associated?.lists ?? 0) > 0

  // Verified Tezos wallet (tzbsky). Present => this account can show NFT tabs.
  const tezosAddr = useTezosAddress(profile?.did).data ?? undefined

  const tabs: TabItem[] = useMemo(() => {
    const t: TabItem[] = [
      { key: 'posts', label: 'Posts' },
      { key: 'replies', label: 'Replies' },
      { key: 'media', label: 'Media' },
    ]
    if (isSelf) t.push({ key: 'likes', label: 'Likes' })
    if (hasFeeds) t.push({ key: 'feeds', label: 'Feeds' })
    if (hasLists) t.push({ key: 'lists', label: 'Lists' })
    if (tezosAddr) {
      t.push({ key: 'nfts-created', label: 'Created' })
      t.push({ key: 'nfts-owned', label: 'Owned' })
    }
    return t
  }, [isSelf, hasFeeds, hasLists, tezosAddr])

  const requested = (params.get('tab') as TabKey) || 'posts'
  // Guard against a stale/invalid tab from the URL (e.g. ?tab=likes on someone else).
  const activeKey: TabKey = tabs.some((t) => t.key === requested) ? requested : 'posts'

  // Warm every sibling tab's first page on idle, so switching tabs renders
  // instantly. Only the active tab's query is `enabled`, so without this each
  // tab is a cold fetch. RQ dedupes the active tab's key against its live query.
  useEffect(() => {
    if (!actor) return
    return runWhenIdle(() => {
      const warm = (opts: { queryKey: readonly unknown[] }) =>
        schedulePrefetch(opts.queryKey, () =>
          queryClient.prefetchInfiniteQuery(opts as Parameters<typeof queryClient.prefetchInfiniteQuery>[0]),
        )
      warm(authorFeedOptions(agent, did, actor, 'posts_no_replies'))
      warm(authorFeedOptions(agent, did, actor, 'posts_with_replies'))
      warm(authorFeedOptions(agent, did, actor, 'posts_with_media'))
      if (isSelf) warm(actorLikesOptions(agent, did, actor))
      if (tezosAddr) {
        warm(objktCollectionsOptions(tezosAddr, 'created'))
        warm(objktCollectionsOptions(tezosAddr, 'owned'))
      }
    })
  }, [actor, agent, did, isSelf, tezosAddr])

  const setTab = (key: string) => {
    const next = new URLSearchParams(params)
    if (key === 'posts') next.delete('tab')
    else next.set('tab', key)
    // The drilled-in NFT collection belongs to the tab we're leaving.
    next.delete('collection')
    setParams(next, { replace: true })
  }

  // Author-feed queries. Each tab keeps its own cache; inactive tabs are
  // disabled so we don't fan out four getAuthorFeed calls on mount.
  const posts = useAuthorFeed(actor, 'posts_no_replies', { enabled: activeKey === 'posts' })
  const replies = useAuthorFeed(actor, 'posts_with_replies', { enabled: activeKey === 'replies' })
  const media = useAuthorFeed(actor, 'posts_with_media', { enabled: activeKey === 'media' })
  const likes = useActorLikes(actor, { enabled: activeKey === 'likes' && isSelf })

  if (profileQ.isLoading) {
    // Mirror the loaded two-column shape: header card in the aside, feed in the
    // main column — so the real data fills these boxes rather than reflowing.
    return (
      <>
        <PageAside>
          <div className="profaside">
            <ProfileCardSkeleton />
          </div>
        </PageAside>
        <div className="proftab">
          <FeedSkeleton />
        </div>
      </>
    )
  }

  if (profileQ.isError || !profile) {
    return (
      <>
        <ErrorState error={profileQ.error} onRetry={() => profileQ.refetch()} title="Profile unavailable" />
      </>
    )
  }

  const blockedByViewer = !!profile.viewer?.blocking
  const blockingViewer = !!profile.viewer?.blockedBy

  return (
    <>
      <PageAside>
        <div className="profaside">
          <ProfileCard profile={profile} actor={actor!} isSelf={isSelf} isAuthed={isAuthed} />
          {/* Desktop: menu lives in the aside. On mobile it moves into the main
              column (below) so it shares the feed's scroll container and sticks. */}
          {!isMobile && <ProfileNav items={tabs} activeKey={activeKey} onChange={setTab} />}
          {profile.associated?.labeler && <LabelerCard profile={profile} />}
        </div>
      </PageAside>

      {isMobile && <ProfileNav items={tabs} activeKey={activeKey} onChange={setTab} />}

      {/* Min-height floor (mobile) so any tab — even one with too few items to
          fill the screen — stays scrollable enough to pin the sticky menu. */}
      <div className="proftab">
        {blockingViewer ? (
          <EmptyState
            title="You are blocked"
            message="You can't view this account's posts."
          />
        ) : blockedByViewer ? (
          <EmptyState
            title="Account blocked"
            message="Unblock this account to see their posts."
          />
        ) : (
          <ProfileTabContent
            activeKey={activeKey}
            actor={actor!}
            posts={posts}
            replies={replies}
            media={media}
            likes={likes}
            tezosAddr={tezosAddr}
          />
        )}
      </div>
    </>
  )
}

function ProfileTabContent({
  activeKey,
  actor,
  posts,
  replies,
  media,
  likes,
  tezosAddr,
}: {
  activeKey: TabKey
  actor: string
  posts: ReturnType<typeof useAuthorFeed>
  replies: ReturnType<typeof useAuthorFeed>
  media: ReturnType<typeof useAuthorFeed>
  likes: ReturnType<typeof useActorLikes>
  tezosAddr: string | undefined
}) {
  // Per profile + tab, so each tab restores its own scroll on back-navigation.
  const scrollKey = `profile:${actor}:${activeKey}`
  switch (activeKey) {
    case 'replies':
      return <ProfileFeed query={replies} emptyTitle="No replies yet" scrollKey={scrollKey} />
    case 'media':
      return <ProfileFeed query={media} emptyTitle="No media yet" scrollKey={scrollKey} />
    case 'nfts-created':
      return <NftTab address={tezosAddr} kind="created" />
    case 'nfts-owned':
      return <NftTab address={tezosAddr} kind="owned" />
    case 'likes':
      return (
        <ProfileFeed
          query={likes}
          emptyTitle="No likes yet"
          emptyMessage="Posts you like will appear here."
          scrollKey={scrollKey}
        />
      )
    case 'feeds':
      return <ProfileFeedsTab actor={actor} />
    case 'lists':
      return <ProfileListsTab actor={actor} />
    case 'posts':
    default:
      return (
        <ProfileFeed
          query={posts}
          emptyTitle="No posts yet"
          emptyMessage="When they post, it will show up here."
          scrollKey={scrollKey}
        />
      )
  }
}
