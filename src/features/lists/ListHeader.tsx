import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppBskyGraphDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { profileOptions } from '@/features/profile/use-profile'
import { Avatar, Button, Icons } from '@/components'
import { PurposeChip, isCurate, isModlist, purposeMeta } from './PurposeChip'
import { EditListModal } from './EditListModal'
import { useListSaved, useToggleListPin } from './use-list-pin'
import { useBlockList, useMuteList } from './use-list-membership'

type ListView = AppBskyGraphDefs.ListView

/**
 * List header block: avatar/name/creator/description, purpose chip, and the
 * action set appropriate to the list (subscribe/pin for curate, mute/block for
 * mod, edit when owned). The action clusters live here because the header is
 * their only consumer.
 */
export function ListHeader({ list, owned }: { list: ListView; owned: boolean }) {
  const curate = isCurate(list.purpose)
  const mod = isModlist(list.purpose)
  const meta = purposeMeta(list.purpose)

  // Creator link → warm their profile on dwell.
  const { agent } = useAgent()
  const creatorRef = usePrefetchOnVisible<HTMLAnchorElement>(() => {
    const profile = profileOptions(agent, list.creator.handle || list.creator.did)
    schedulePrefetch(profile.queryKey, () => queryClient.prefetchQuery(profile))
  })

  return (
    <div className="list-detail__header">
      <div className="list-detail__top">
        <Avatar
          src={list.avatar}
          alt={list.name}
          size="xl"
          shape="rounded-square"
          fallback={list.name}
        />
        <div className="list-detail__heading">
          <div className="list-detail__name">{list.name}</div>
          <div className="list-detail__by">
            <PurposeChip purpose={list.purpose} /> by{' '}
            <Link to={`/profile/${list.creator.handle || list.creator.did}`} ref={creatorRef}>
              @{list.creator.handle || list.creator.did}
            </Link>
          </div>
        </div>
      </div>

      {list.description && <div className="list-detail__desc">{list.description}</div>}

      <div className="list-detail__actions">
        {curate && <CuratePinActions list={list} />}
        {mod && <ModActions list={list} />}
        {owned && <OwnerActions list={list} />}
      </div>

      {mod && (list.viewer?.muted || list.viewer?.blocked) && (
        <div className="list-detail__banner" style={{ marginTop: 'var(--space-3)' }}>
          <Icons.BellIcon size={16} />
          {list.viewer?.blocked
            ? 'You are blocking everyone on this list.'
            : 'You are muting everyone on this list.'}
        </div>
      )}
      {!curate && !mod && (
        <div className="list-detail__banner" style={{ marginTop: 'var(--space-3)' }}>
          {meta.label}
        </div>
      )}
    </div>
  )
}

/* --------------------------------------- curate: subscribe / pin to home tab */

function CuratePinActions({ list }: { list: ListView }) {
  const { isAuthed } = useAgent()
  const saved = useListSaved(list.uri)
  const toggle = useToggleListPin()

  if (!isAuthed) return null

  const state = saved.data
  const isPinned = state?.pinned
  const isSaved = state?.saved

  return (
    <>
      <Button
        variant={isPinned ? 'secondary' : 'primary'}
        loading={toggle.isPending || saved.isLoading}
        onClick={() =>
          toggle.mutate({ listUri: list.uri, next: isPinned ? 'saved' : 'pinned' })
        }
      >
        {isPinned ? 'Pinned' : 'Pin to home'}
      </Button>
      <Button
        variant="secondary"
        disabled={toggle.isPending}
        onClick={() =>
          toggle.mutate({ listUri: list.uri, next: isSaved ? 'removed' : 'saved' })
        }
      >
        {isSaved ? 'Unsubscribe' : 'Subscribe'}
      </Button>
    </>
  )
}

/* ------------------------------------------------- mod: mute / block actions */

function ModActions({ list }: { list: ListView }) {
  const { isAuthed } = useAgent()
  const mute = useMuteList()
  const block = useBlockList()

  if (!isAuthed) return null
  const muted = !!list.viewer?.muted
  const blocked = !!list.viewer?.blocked

  return (
    <>
      <Button
        variant={muted ? 'secondary' : 'primary'}
        loading={mute.isPending}
        onClick={() => mute.mutate({ listUri: list.uri, muted })}
      >
        {muted ? 'Unmute list' : 'Mute list'}
      </Button>
      <Button
        variant={blocked ? 'secondary' : 'danger'}
        loading={block.isPending}
        onClick={() => block.mutate({ listUri: list.uri, blockedUri: list.viewer?.blocked })}
      >
        {blocked ? 'Unblock list' : 'Block list'}
      </Button>
    </>
  )
}

/* --------------------------------------------------- owner: edit / add / del */

function OwnerActions({ list }: { list: ListView }) {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <Button
        variant="secondary"
        icon={<Icons.PencilIcon size={16} />}
        onClick={() => setEditing(true)}
      >
        Edit
      </Button>
      <EditListModal open={editing} onClose={() => setEditing(false)} list={list} />
    </>
  )
}
