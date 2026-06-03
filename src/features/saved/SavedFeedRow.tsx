import { Link } from 'react-router-dom'
import { Avatar, Button, Menu, Text } from '@/components'
import { HashIcon, ListIcon, HomeIcon } from '@/components/Icon'
import type { HydratedSavedFeed } from './use-saved-feeds'

interface SavedFeedRowProps {
  item: HydratedSavedFeed
  pinning: boolean
  removing: boolean
  onTogglePin: () => void
  onRemove: () => void
}

/** Resolve display metadata + the in-app destination for a saved entry. */
function describe(item: HydratedSavedFeed): {
  title: string
  subtitle?: string
  avatar?: string
  to?: string
  icon: React.ReactNode
} {
  const { view } = item
  if (view.kind === 'timeline') {
    return { title: 'Following', subtitle: 'Your home timeline', to: '/', icon: <HomeIcon size={18} /> }
  }
  if (view.kind === 'feed') {
    const f = view.feed
    const rkey = f.uri.split('/').pop() ?? ''
    const actor = f.creator?.handle || f.creator?.did || ''
    return {
      title: f.displayName || rkey,
      subtitle: f.creator ? `Feed by @${f.creator.handle}` : 'Feed',
      avatar: f.avatar,
      to: actor ? `/profile/${actor}/feed/${rkey}` : undefined,
      icon: <HashIcon size={18} />,
    }
  }
  if (view.kind === 'list') {
    const l = view.list
    const rkey = l.uri.split('/').pop() ?? ''
    const actor = l.creator?.handle || l.creator?.did || ''
    return {
      title: l.name || rkey,
      subtitle: l.creator ? `List by @${l.creator.handle}` : 'List',
      avatar: l.avatar,
      to: actor ? `/profile/${actor}/lists/${rkey}` : undefined,
      icon: <ListIcon size={18} />,
    }
  }
  // Unresolved (deleted feed/list, or hydration failed) — show the raw value.
  return {
    title: item.saved.value.split('/').pop() || 'Unavailable feed',
    subtitle: 'Could not load this saved item',
    icon: <HashIcon size={18} />,
  }
}

export function SavedFeedRow({
  item,
  pinning,
  removing,
  onTogglePin,
  onRemove,
}: SavedFeedRowProps) {
  const { title, subtitle, avatar, to, icon } = describe(item)
  const pinned = item.saved.pinned
  const isTimeline = item.saved.type === 'timeline'

  const body = (
    <div className="savedrow__main">
      {avatar ? (
        <Avatar src={avatar} alt={title} size="md" shape="rounded-square" />
      ) : (
        <span className="savedrow__icon" aria-hidden>
          {icon}
        </span>
      )}
      <div className="savedrow__text">
        <Text weight="semibold" className="savedrow__title">
          {title}
        </Text>
        {subtitle && (
          <Text size="sm" tone="muted" className="savedrow__sub">
            {subtitle}
          </Text>
        )}
      </div>
    </div>
  )

  return (
    <div className="savedrow">
      {to ? (
        <Link to={to} className="savedrow__link">
          {body}
        </Link>
      ) : (
        <div className="savedrow__link savedrow__link--static">{body}</div>
      )}

      <div className="savedrow__actions">
        <Button
          variant={pinned ? 'primary' : 'secondary'}
          size="sm"
          loading={pinning}
          onClick={onTogglePin}
        >
          {pinned ? 'Pinned' : 'Pin'}
        </Button>
        {/* The home timeline can't be unsaved; only its pin state is editable. */}
        {!isTimeline && (
          <Menu
            trigger={
              <Button variant="ghost" size="sm" iconOnly aria-label="More">
                ⋯
              </Button>
            }
            items={[
              {
                key: 'pin',
                label: pinned ? 'Unpin' : 'Pin',
                onSelect: onTogglePin,
              },
              {
                key: 'remove',
                label: removing ? 'Removing…' : 'Remove from saved',
                danger: true,
                onSelect: onRemove,
              },
            ]}
          />
        )}
      </div>
    </div>
  )
}
