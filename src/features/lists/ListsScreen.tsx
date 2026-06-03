import { useMemo, useState } from 'react'
import { useAgent } from '@/lib/api/agent'
import { ScreenHeader } from '@/components/layout'
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Icons,
  InfiniteList,
  Spinner,
} from '@/components'
import './lists.css'
import { useLists } from './use-lists'
import { ListCard } from './ListCard'
import { EditListModal } from './EditListModal'
import { isModlist } from './PurposeChip'

/**
 * Lists index — the viewer's own curate + moderation lists (getLists), grouped,
 * plus a create-list entry. Protected route: viewer DID is always present.
 *
 * getLists returns a flat, paginated set; we split client-side by purpose so the
 * UI reads "User lists" vs "Moderation lists" without extra requests.
 */
export function ListsScreen() {
  const { did, handle } = useAgent()
  const actor = did // own lists keyed on viewer DID
  const [creating, setCreating] = useState(false)

  const query = useLists(actor)

  const lists = useMemo(
    () => query.data?.pages.flatMap((p) => p.lists) ?? [],
    [query.data],
  )

  const userLists = lists.filter((l) => !isModlist(l.purpose))
  const modLists = lists.filter((l) => isModlist(l.purpose))

  // Ordered render model: section headers + cards, flattened for the virtualizer.
  type Row =
    | { kind: 'section'; key: string; label: string }
    | { kind: 'list'; key: string; list: (typeof lists)[number] }

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    if (userLists.length) {
      out.push({ kind: 'section', key: 'sec-user', label: 'User lists' })
      for (const l of userLists) out.push({ kind: 'list', key: l.uri, list: l })
    }
    if (modLists.length) {
      out.push({ kind: 'section', key: 'sec-mod', label: 'Moderation lists' })
      for (const l of modLists) out.push({ kind: 'list', key: l.uri, list: l })
    }
    return out
  }, [userLists, modLists])

  return (
    <>
      <ScreenHeader
        title="Lists"
        actions={
          <Button
            size="sm"
            icon={<Icons.PencilIcon size={18} />}
            onClick={() => setCreating(true)}
          >
            New list
          </Button>
        }
      />

      <button
        className="lists-screen__create"
        style={{ width: '100%', background: 'transparent', textAlign: 'left' }}
        onClick={() => setCreating(true)}
      >
        <Avatar size="md" shape="rounded-square" fallback="+" />
        <span className="lists-screen__create-text">
          <span className="lists-screen__create-title">New list</span>
          <span className="lists-screen__create-sub">
            Curate a feed, or build a mute/block list
          </span>
        </span>
        <span className="lists-screen__create-spacer" />
        <Icons.MoreIcon size={20} />
      </button>

      {query.isLoading ? (
        <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <Spinner />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <InfiniteList
          items={rows}
          getKey={(r) => r.key}
          estimateSize={104}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          fetchNextPage={query.fetchNextPage}
          emptyState={
            <EmptyState
              icon={<Icons.ListIcon size={40} />}
              title="No lists yet"
              message={`${handle ?? 'You'} haven't created any lists. Make one to curate posts or moderate.`}
              action={<Button onClick={() => setCreating(true)}>Create a list</Button>}
            />
          }
          renderItem={(row) =>
            row.kind === 'section' ? (
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  fontWeight: 700,
                  fontSize: 'var(--fs-md)',
                  color: 'var(--text)',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-contrast-25)',
                }}
              >
                {row.label}
              </div>
            ) : (
              <ListCard list={row.list} />
            )
          }
        />
      )}

      <EditListModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

export default ListsScreen
