import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AppBskyActorDefs } from '@atproto/api'
import { Avatar, Button, Img, Menu, IconButton, LabelChips, hasBotLabel } from '@/components'
import { MoreIcon, BotIcon, ChatIcon, BellIcon } from '@/components/Icon'
import { BioText } from '@/lib/rich-text'
import { notifyConfigured } from '@/lib/notify/client'
import {
  useNotifyMutes,
  useNotifyWatches,
  usePutNotifyMute,
  usePutWatch,
} from '@/lib/notify/use-notify'
import { useStartConvo } from '@/features/chat/use-start-convo'
import { isChatPermissionError } from '@/features/chat/chat-errors'
import { useUiStore } from '@/store/ui-store'
import { useFollow } from './use-follow'
import { useMuteBlock } from './use-mute-block'
import { useTezosAddress } from './use-nfts'
import { FollowListModal } from './FollowListModal'
import './profile.css'

export interface ProfileCardProps {
  profile: AppBskyActorDefs.ProfileViewDetailed
  /**
   * The exact actor string the route used (handle OR DID). The profile cache is
   * keyed by this raw string (qk.profile(actor)), so follow / mute / block must
   * patch the SAME key or their optimistic write lands on a different (often
   * empty) entry and the UI never updates. Do NOT substitute profile.handle here.
   */
  actor: string
  /** True when the viewer is looking at their own profile. */
  isSelf: boolean
  isAuthed: boolean
}

export function formatCount(n: number | undefined): string {
  const v = n ?? 0
  if (v < 1000) return String(v)
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 10_000 ? 1 : 0)}K`.replace('.0', '')
  return `${(v / 1_000_000).toFixed(1)}M`.replace('.0', '')
}

/**
 * Profile card (the page's left column): banner, overlapping avatar, the primary
 * action (Edit / Follow / Following), an overflow menu (mute / block / copy
 * link), name + handle (+ "Follows you" chip), bio rich text, and the clickable
 * followers / following / posts counts. Rendered as a rounded card that sits in
 * the two-column page aside.
 */
export function ProfileCard({ profile, actor, isSelf, isAuthed }: ProfileCardProps) {
  const navigate = useNavigate()
  const openLightbox = useUiStore((s) => s.openLightbox)
  // Key follow/mute/block off the route actor so their optimistic cache patch
  // hits the same qk.profile(actor) entry this screen reads from.
  const follow = useFollow(actor)
  const { mute, block } = useMuteBlock(actor)
  const [listMode, setListMode] = useState<'followers' | 'following' | null>(null)
  const [expanded, setExpanded] = useState(false)
  const tezosAddr = useTezosAddress(profile.did).data ?? undefined
  // Only the bio is worth collapsing; without one there's nothing to expand.
  const hasBio = !!profile.description
  const collapsed = hasBio && !expanded

  const following = !!profile.viewer?.following
  const blocking = !!profile.viewer?.blocking
  const muted = !!profile.viewer?.muted
  const followsYou = !!profile.viewer?.followedBy
  const actorRoute = `/profile/${profile.handle || profile.did}`

  // DM entry point, gated on the recipient's incoming-DM policy (default
  // 'following' per the platform). 'following' means they accept DMs from
  // accounts THEY follow — i.e. only when they follow the viewer (followedBy).
  // The server enforces this too; gating just keeps the button from appearing
  // when a send would be rejected.
  const startConvo = useStartConvo()
  const chatPref = profile.associated?.chat?.allowIncoming ?? 'following'
  const canMessage =
    isAuthed &&
    !isSelf &&
    !blocking &&
    !profile.viewer?.blockedBy &&
    (chatPref === 'all' || (chatPref === 'following' && followsYou))
  const openChat = () =>
    startConvo.mutate(profile.did, {
      onSuccess: (convoId) => navigate(`/messages/${convoId}`),
      onError: (err) =>
        window.alert(
          isChatPermissionError(err)
            ? 'Messaging isn’t available for this account.'
            : 'Could not start the conversation. Please try again.',
        ),
    })

  // Ovoid push-notification state for this account (our notify backend, not
  // bsky): the bell watches their posts, the menu entry mutes them. Queries
  // are list-shaped and shared app-wide; only enabled when the controls show.
  const showNotifyControls = isAuthed && !isSelf && notifyConfigured()
  const { data: watches } = useNotifyWatches(showNotifyControls)
  const { data: notifyMutes } = useNotifyMutes(showNotifyControls)
  const putWatch = usePutWatch()
  const putNotifyMute = usePutNotifyMute()
  const watch = watches?.find((w) => w.subject === profile.did)
  const watching = !!watch?.posts
  const notifyMuted = !!notifyMutes?.includes(profile.did)

  const menuItems = [
    {
      key: 'copy',
      label: 'Copy link to profile',
      onSelect: () => {
        void navigator.clipboard?.writeText(`${location.origin}${actorRoute}`)
      },
    },
    ...(tezosAddr
      ? [
          {
            key: 'copy-tezos',
            label: 'Copy Tezos address',
            onSelect: () => {
              void navigator.clipboard?.writeText(tezosAddr)
            },
          },
        ]
      : []),
    ...(showNotifyControls
      ? [
          {
            key: 'notify-mute',
            label: notifyMuted ? 'Unmute notifications' : 'Mute notifications',
            onSelect: () =>
              putNotifyMute.mutate({ subject: profile.did, muted: !notifyMuted }),
          },
        ]
      : []),
    ...(isAuthed && !isSelf
      ? [
          {
            key: 'mute',
            label: muted ? 'Unmute account' : 'Mute account',
            onSelect: () => mute.mutate(profile),
          },
          {
            key: 'block',
            label: blocking ? 'Unblock account' : 'Block account',
            danger: true,
            onSelect: () => block.mutate(profile),
          },
        ]
      : []),
  ]

  return (
    <header className={`profhead${collapsed ? ' profhead--collapsed' : ''}`}>
      <Link
        to={actorRoute}
        className="profhead__banner"
        aria-label={`View @${profile.handle}'s profile`}
      >
        {profile.banner && <Img src={profile.banner} alt="" />}
      </Link>

      <div className="profhead__bar">
        <button
          type="button"
          className="profhead__avatar"
          aria-label={`View @${profile.handle}'s avatar`}
          disabled={!profile.avatar}
          onClick={() =>
            profile.avatar &&
            openLightbox({
              images: [{ src: profile.avatar, alt: profile.displayName || profile.handle }],
              index: 0,
            })
          }
        >
          <Avatar src={profile.avatar} alt={profile.displayName || profile.handle} size="xl" />
        </button>

        <div className="profhead__actions">
          {showNotifyControls && (
            <IconButton
              label={watching ? 'Stop notifying about new posts' : 'Notify about new posts'}
              type="button"
              aria-pressed={watching}
              onClick={() =>
                putWatch.mutate({
                  subject: profile.did,
                  posts: !watching,
                  replies: watch?.replies ?? false,
                })
              }
              disabled={putWatch.isPending}
            >
              <BellIcon size={20} filled={watching} />
            </IconButton>
          )}

          {canMessage && (
            <IconButton
              label="Message"
              type="button"
              onClick={openChat}
              disabled={startConvo.isPending}
            >
              <ChatIcon size={20} />
            </IconButton>
          )}

          <Menu
            trigger={
              <IconButton label="More options" type="button">
                <MoreIcon size={20} />
              </IconButton>
            }
            items={menuItems}
          />

          {isSelf ? (
            <Button variant="secondary" onClick={() => navigate(`${actorRoute}/edit`)}>
              Edit profile
            </Button>
          ) : blocking ? (
            <Button
              variant="secondary"
              loading={block.isPending}
              onClick={() => block.mutate(profile)}
            >
              Blocked
            </Button>
          ) : isAuthed ? (
            <Button
              variant={following ? 'secondary' : 'primary'}
              loading={follow.isPending}
              onClick={() => follow.mutate(profile)}
            >
              {following ? 'Following' : followsYou ? 'Follow back' : 'Follow'}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="profhead__identity">
        <div className="profhead__nameline">
          {hasBotLabel(profile.labels) && (
            <span className="bot-badge" title="Automated account (bot)" aria-label="Bot">
              <BotIcon size={18} />
            </span>
          )}
          <h1 className="profhead__name">{profile.displayName || profile.handle}</h1>
        </div>
        <div className="profhead__handleline">
          <span className="profhead__handle">@{profile.handle}</span>
          {followsYou && <span className="profhead__chip">Follows you</span>}
          {muted && <span className="profhead__chip">Muted</span>}
        </div>
        <LabelChips className="profhead__labels" labels={profile.labels} />
      </div>

      {profile.description && (
        <div className="profhead__bio">
          <BioText text={profile.description} />
        </div>
      )}

      <div className="profhead__counts">
        <button className="profhead__count" onClick={() => setListMode('following')}>
          <strong>{formatCount(profile.followsCount)}</strong> Following
        </button>
        <button className="profhead__count" onClick={() => setListMode('followers')}>
          <strong>{formatCount(profile.followersCount)}</strong> Followers
        </button>
        <Link className="profhead__count" to={actorRoute}>
          <strong>{formatCount(profile.postsCount)}</strong> Posts
        </Link>
      </div>

      {/* Phone-only: expand/collapse the bio (hidden on desktop via CSS). */}
      {hasBio && (
        <button
          type="button"
          className="profhead__expand"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {listMode && (
        <FollowListModal
          actor={profile.handle || profile.did}
          mode={listMode}
          open
          onClose={() => setListMode(null)}
        />
      )}
    </header>
  )
}
