import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AppBskyActorDefs } from '@atproto/api'
import { Avatar, Button, Menu, IconButton, LabelChips, hasBotLabel } from '@/components'
import { MoreIcon, BotIcon } from '@/components/Icon'
import { RichText } from '@/lib/rich-text'
import { useFollow } from './use-follow'
import { useMuteBlock } from './use-mute-block'
import { useTezosAddress } from './use-nfts'
import { FollowListModal } from './FollowListModal'
import './profile.css'

export interface ProfileCardProps {
  profile: AppBskyActorDefs.ProfileViewDetailed
  /** True when the viewer is looking at their own profile. */
  isSelf: boolean
  isAuthed: boolean
}

function formatCount(n: number | undefined): string {
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
export function ProfileCard({ profile, isSelf, isAuthed }: ProfileCardProps) {
  const navigate = useNavigate()
  const follow = useFollow(profile.handle || profile.did)
  const { mute, block } = useMuteBlock(profile.handle || profile.did)
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
        {profile.banner && <img src={profile.banner} alt="" loading="lazy" />}
      </Link>

      <div className="profhead__bar">
        <Link to={actorRoute} className="profhead__avatar" aria-label={`View @${profile.handle}'s profile`}>
          <Avatar src={profile.avatar} alt={profile.displayName || profile.handle} size="xl" />
        </Link>

        <div className="profhead__actions">
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
          <RichText text={profile.description} />
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
