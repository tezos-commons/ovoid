import type { AppBskyGraphDefs } from '@atproto/api'
import { Icons, Menu } from '@/components'
import { useDeleteList } from './use-list-membership'

type ListView = AppBskyGraphDefs.ListView

/** Header overflow menu: copy link always, delete when owned. */
export function ListOverflowMenu({ list, owned }: { list: ListView; owned: boolean }) {
  const del = useDeleteList()
  const items = []
  items.push({
    key: 'copy',
    label: 'Copy link to list',
    onSelect: () => {
      navigator.clipboard?.writeText(window.location.href)
    },
  })
  if (owned) {
    items.push({
      key: 'delete',
      label: 'Delete list',
      danger: true,
      onSelect: () => {
        if (confirm('Delete this list? This cannot be undone.')) {
          del.mutate(list.uri, {
            onSuccess: () => history.back(),
          })
        }
      },
    })
  }
  return (
    <Menu
      trigger={
        <span style={{ display: 'inline-flex', padding: 4, cursor: 'pointer' }}>
          <Icons.MoreIcon size={20} />
        </span>
      }
      items={items}
    />
  )
}
