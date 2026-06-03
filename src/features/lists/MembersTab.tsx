import { useMemo, useState } from 'react'
import type { AppBskyGraphDefs } from '@atproto/api'
import { Button, EmptyState, Icons, InfiniteList } from '@/components'
import { useList } from './use-list'
import { MemberRow } from './MemberRow'
import { AddMemberDialog } from './AddMemberDialog'
import { useRemoveMember } from './use-list-membership'

type ListItemView = AppBskyGraphDefs.ListItemView

/** Members tab: paginated member rows with add (owner) and per-row remove. */
export function MembersTab({
  listUri,
  query,
  owned,
}: {
  listUri: string
  query: ReturnType<typeof useList>
  owned: boolean
}) {
  const [adding, setAdding] = useState(false)
  const remove = useRemoveMember()
  const [removingUri, setRemovingUri] = useState<string | null>(null)

  const items: ListItemView[] = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  )
  const existingDids = useMemo(
    () => new Set(items.map((i) => i.subject.did)),
    [items],
  )

  const handleRemove = (item: ListItemView) => {
    setRemovingUri(item.uri)
    remove.mutate(
      { listUri, listItemUri: item.uri },
      { onSettled: () => setRemovingUri(null) },
    )
  }

  return (
    <>
      {owned && (
        <div className="lists-screen__create" style={{ justifyContent: 'flex-start' }}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Icons.PersonIcon size={16} />}
            onClick={() => setAdding(true)}
          >
            Add people
          </Button>
        </div>
      )}

      <InfiniteList
        items={items}
        getKey={(i) => i.uri}
        estimateSize={76}
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
        emptyState={
          <EmptyState
            icon={<Icons.PersonIcon size={40} />}
            title="No people yet"
            message={
              owned
                ? 'Add people to this list to get started.'
                : 'This list has no members.'
            }
            action={
              owned ? <Button onClick={() => setAdding(true)}>Add people</Button> : undefined
            }
          />
        }
        renderItem={(item) => (
          <MemberRow
            item={item}
            canManage={owned}
            removing={removingUri === item.uri}
            onRemove={handleRemove}
          />
        )}
      />

      {owned && (
        <AddMemberDialog
          open={adding}
          onClose={() => setAdding(false)}
          listUri={listUri}
          existingDids={existingDids}
        />
      )}
    </>
  )
}
