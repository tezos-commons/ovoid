import { Fragment, useEffect, useMemo, type ReactNode } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  PageAside,
  MobileTopRight,
  MobileSelect,
  useMobileTitle,
  useHidePageRail,
} from '@/components/layout'
import { ProfileCardSkeleton, FeedSkeleton, NftGridSkeleton, ErrorState, EmptyState } from '@/components'
import {
  GearIcon,
  HomeIcon,
  ReplyIcon,
  ImageIcon,
  HeartIcon,
  HashIcon,
  ListIcon,
  WalletIcon,
  PencilIcon,
  BookmarkIcon,
} from '@/components/Icon'
import type { TabItem } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { useIsMobile } from '@/lib/use-is-mobile'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { runWhenIdle } from '@/lib/idle'
import { useProfile } from './use-profile'
import { useAuthorFeed, authorFeedOptions } from './use-author-feed'
import { useActorLikes, actorLikesOptions } from './use-actor-likes'
import { authorFeedsOptions, authorListsOptions } from './use-author-feeds'
import { ProfileCard } from './ProfileCard'
import { ProfileNav } from './ProfileNav'
import { LabelerCard } from './LabelerCard'
import { ProfileFeed } from './ProfileFeed'
import { ProfilePublicationCard } from './ProfilePublicationCard'
import { ProfileFeedsTab, ProfileListsTab } from './ProfileFeedsTab'
import { NftTab } from './NftTab'
import { LinkTezosSection } from './LinkTezosSection'
import { useTezosAddress, objktCollectionsOptions } from './use-nfts'
import { WalletView } from './WalletView'
import { WalletViewMobile } from './WalletViewMobile'
import {
  walletBalanceOptions,
  walletTokensOptions,
  walletNftsOptions,
  walletActivityOptions,
} from './use-wallet'
import {
  useWalletVisibility,
  resolveWalletSections,
  walletVisibilityOptions,
  type WalletVisibility,
} from './use-wallet-visibility'
import './profile.css'

type TabKey =
  | 'posts'
  | 'replies'
  | 'media'
  | 'likes'
  | 'feeds'
  | 'lists'
  | 'wallet'
  | 'nfts-created'
  | 'nfts-owned'

/** Icons for the mobile section dropdown's grid layout. */
const TAB_ICONS: Record<TabKey, ReactNode> = {
  posts: <HomeIcon size={22} />,
  replies: <ReplyIcon size={22} />,
  media: <ImageIcon size={22} />,
  likes: <HeartIcon size={22} />,
  feeds: <HashIcon size={22} />,
  lists: <ListIcon size={22} />,
  wallet: <WalletIcon size={22} />,
  'nfts-created': <PencilIcon size={22} />,
  'nfts-owned': <BookmarkIcon size={22} />,
}

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
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const profile = profileQ.data
  const isSelf = !!profile && (profile.did === did)

  const hasFeeds = (profile?.associated?.feedgens ?? 0) > 0
  const hasLists = (profile?.associated?.lists ?? 0) > 0

  // Verified Tezos wallet (tzbsky). Created/Owned show for any account with a
  // linked address — and on your own profile even without one, where they
  // render the link-a-wallet prompt instead of NFTs.
  const tezosQ = useTezosAddress(profile?.did)
  const tezosAddr = tezosQ.data ?? undefined

  // Owner-published wallet visibility (backend.ovoid.at). Only read for other
  // accounts that have a wallet, and only when authed (public reads still need
  // the viewer's token); otherwise the resolver defaults to fully visible.
  const checkVisibility = isAuthed && !isSelf && !!tezosAddr
  const walletVisQ = useWalletVisibility(profile?.did, { enabled: checkVisibility })
  const walletSections = resolveWalletSections(isSelf, walletVisQ.data)
  const walletHasVisible =
    walletSections.balance || walletSections.tokens || walletSections.activity || walletSections.nfts

  const tabs: TabItem[] = useMemo(() => {
    const t: TabItem[] = [
      { key: 'posts', label: 'Posts' },
      { key: 'replies', label: 'Replies' },
      { key: 'media', label: 'Media' },
    ]
    if (isSelf) t.push({ key: 'likes', label: 'Likes' })
    if (hasFeeds) t.push({ key: 'feeds', label: 'Feeds' })
    if (hasLists) t.push({ key: 'lists', label: 'Lists' })
    // Wallet / Created / Owned show for any account with a linked address — and
    // on your own profile even without one, where they render the link-a-wallet
    // prompt instead of data.
    if (tezosAddr || isSelf) {
      // The Wallet overview is gated by the owner's visibility record; if they've
      // hidden every section it drops off for other viewers. Created/Owned (the
      // showcase tabs that linking exists for) always stay.
      if (isSelf || walletHasVisible) t.push({ key: 'wallet', label: 'Wallet' })
      t.push({ key: 'nfts-created', label: 'Created' })
      t.push({ key: 'nfts-owned', label: 'Owned' })
    }
    return t
  }, [isSelf, hasFeeds, hasLists, tezosAddr, walletHasVisible])

  const requested = (params.get('tab') as TabKey) || 'posts'
  // Guard against a stale/invalid tab from the URL (e.g. ?tab=likes on someone else).
  const activeKey: TabKey = tabs.some((t) => t.key === requested) ? requested : 'posts'

  // Mobile top bar shows the account name; the section menu folds into a dropdown.
  useMobileTitle(
    isMobile ? profile?.displayName?.trim() || (profile?.handle ? `@${profile.handle}` : 'Profile') : null,
  )

  // The wide Tezos tabs (Wallet/Created/Owned) reclaim the right rail's space:
  // hide it and widen the main column into its footprint.
  const isTezosTab = activeKey === 'wallet' || activeKey === 'nfts-created' || activeKey === 'nfts-owned'
  useHidePageRail(isTezosTab)

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
      // Wallet sections are plain (non-infinite) queries.
      const warmQuery = (opts: { queryKey: readonly unknown[] }) =>
        schedulePrefetch(opts.queryKey, () =>
          queryClient.prefetchQuery(opts as Parameters<typeof queryClient.prefetchQuery>[0]),
        )
      warm(authorFeedOptions(agent, did, actor, 'posts_no_replies'))
      warm(authorFeedOptions(agent, did, actor, 'posts_with_replies'))
      warm(authorFeedOptions(agent, did, actor, 'posts_with_media'))
      if (isSelf) warm(actorLikesOptions(agent, did, actor))
      // Feeds/Lists tabs exist only when the profile has authored any.
      if (hasFeeds) warm(authorFeedsOptions(agent, actor))
      if (hasLists) warm(authorListsOptions(agent, actor))
      if (tezosAddr) {
        warm(objktCollectionsOptions(tezosAddr, 'created'))
        warm(objktCollectionsOptions(tezosAddr, 'owned'))
        warmQuery(walletBalanceOptions(tezosAddr))
        warmQuery(walletTokensOptions(tezosAddr))
        warmQuery(walletNftsOptions(tezosAddr))
        warmQuery(walletActivityOptions(tezosAddr))
      }
      // Warm the owner's visibility record so the Wallet tab gates without a
      // cold fetch on tab-switch (same authed/other-account condition as the read).
      if (checkVisibility && profile?.did) warmQuery(walletVisibilityOptions(agent, profile.did))
    })
  }, [actor, agent, did, isSelf, tezosAddr, checkVisibility, profile?.did, hasFeeds, hasLists])

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
      <Fragment key={actor}>
        <PageAside>
          <div className="profaside">
            <ProfileCardSkeleton />
          </div>
        </PageAside>
        <div className="proftab">
          <FeedSkeleton />
        </div>
      </Fragment>
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
    // Keyed by actor: profile→profile navigation re-renders this SAME route
    // component, so without a key every instance below survives — including
    // ProfileFeed's window virtualizer, whose measurement cache and tracked
    // scroll offset still belong to the previous profile. Its re-measurement
    // scroll-anchoring then drags the window back toward the old offset,
    // defeating the navigation scroll reset. Remounting per actor gives a
    // fresh virtualizer (and clears per-profile UI state like the expanded
    // bio) so cross-profile nav behaves exactly like any other navigation.
    <Fragment key={actor}>
      {isMobile ? (
        <>
          {/* Section menu folds into a top-bar dropdown; the header card becomes
              the first scrollable element (scrolls up under the floating bar). On
              your own profile the settings entry lives here too (it's gone from
              the bottom nav), so the top-left keeps the default back button. */}
          <MobileTopRight>
            <MobileSelect
              ariaLabel="Profile section"
              grid
              label={tabs.find((t) => t.key === activeKey)?.label ?? 'Posts'}
              items={[
                ...tabs.map((t) => ({
                  key: t.key,
                  label: t.label,
                  icon: TAB_ICONS[t.key as TabKey],
                  active: t.key === activeKey,
                  onSelect: () => setTab(t.key),
                })),
                ...(isSelf
                  ? [
                      {
                        key: 'settings',
                        label: 'Settings',
                        icon: <GearIcon size={22} />,
                        active: false,
                        onSelect: () => navigate('/settings'),
                      },
                    ]
                  : []),
              ]}
            />
          </MobileTopRight>
          <div className="profile-mobile-head">
            <ProfileCard profile={profile} actor={actor!} isSelf={isSelf} isAuthed={isAuthed} />
            {profile.associated?.labeler && <LabelerCard profile={profile} />}
          </div>
        </>
      ) : (
        <PageAside>
          <div className="profaside">
            <ProfileCard profile={profile} actor={actor!} isSelf={isSelf} isAuthed={isAuthed} />
            <ProfileNav items={tabs} activeKey={activeKey} onChange={setTab} />
            {profile.associated?.labeler && <LabelerCard profile={profile} />}
          </div>
        </PageAside>
      )}

      {/* Min-height floor (mobile) so any tab — even one with too few items to
          fill the screen — stays scrollable. */}
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
            profileDid={profile.did}
            posts={posts}
            replies={replies}
            media={media}
            likes={likes}
            tezosAddr={tezosAddr}
            tezosPending={tezosQ.isPending}
            walletSections={walletSections}
          />
        )}
      </div>
    </Fragment>
  )
}

function ProfileTabContent({
  activeKey,
  actor,
  profileDid,
  posts,
  replies,
  media,
  likes,
  tezosAddr,
  tezosPending,
  walletSections,
}: {
  activeKey: TabKey
  actor: string
  profileDid: string
  posts: ReturnType<typeof useAuthorFeed>
  replies: ReturnType<typeof useAuthorFeed>
  media: ReturnType<typeof useAuthorFeed>
  likes: ReturnType<typeof useActorLikes>
  tezosAddr: string | undefined
  tezosPending: boolean
  walletSections: WalletVisibility
}) {
  const isMobile = useIsMobile()
  // Per profile + tab, so each tab restores its own scroll on back-navigation.
  // Doubles as the ProfileFeed element key: tab switches render ProfileFeed at
  // the same tree position, and the virtualizer's initialOffset /
  // initialMeasurementsCache only apply at construction — a surviving instance
  // would carry the previous tab's offset into its scroll-anchoring.
  const scrollKey = `profile:${actor}:${activeKey}`

  // Created/Owned render NFTs when a public address is linked. Without one
  // these tabs are only reachable on the viewer's own profile, where they
  // show the link-a-wallet prompt; a skeleton covers the lookup so the
  // prompt doesn't flash at accounts that do have an address.
  const nftTab = (kind: 'created' | 'owned') => {
    if (tezosAddr) return <NftTab address={tezosAddr} kind={kind} />
    if (tezosPending) return <NftGridSkeleton />
    return <LinkTezosSection />
  }

  switch (activeKey) {
    case 'replies':
      return (
        <ProfileFeed key={scrollKey} query={replies} emptyTitle="No replies yet" scrollKey={scrollKey} />
      )
    case 'media':
      return (
        <ProfileFeed key={scrollKey} query={media} emptyTitle="No media yet" scrollKey={scrollKey} />
      )
    case 'wallet':
      // With a linked address show the overview; on your own wallet-less profile
      // show the link prompt (skeleton covers the address lookup so it doesn't
      // flash) — same contract as the Created/Owned tabs.
      if (tezosAddr)
        return isMobile ? (
          <WalletViewMobile address={tezosAddr} sections={walletSections} />
        ) : (
          <WalletView address={tezosAddr} sections={walletSections} />
        )
      if (tezosPending) return <NftGridSkeleton />
      return <LinkTezosSection />
    case 'nfts-created':
      return nftTab('created')
    case 'nfts-owned':
      return nftTab('owned')
    case 'likes':
      return (
        <ProfileFeed
          key={scrollKey}
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
        <>
          <ProfilePublicationCard did={profileDid} />
          <ProfileFeed
            key={scrollKey}
            query={posts}
            emptyTitle="No posts yet"
            emptyMessage="When they post, it will show up here."
            scrollKey={scrollKey}
          />
        </>
      )
  }
}
