import { useNavigate, useSearchParams } from 'react-router-dom'
import { ScreenHeader } from '@/components/layout'
import {
  Button,
  EmptyState,
  ErrorState,
  InfiniteList,
  PostCard,
  Spinner,
  Tabs,
} from '@/components'
import { BookmarkIcon, HashIcon } from '@/components/Icon'
import {
  useBookmarks,
  useBookmarkMode,
  useRemoveBookmark,
  type BookmarkEntry,
} from './use-bookmarks'
import { useSavedFeeds, useSavedFeedActions } from './use-saved-feeds'
import { SavedFeedRow } from './SavedFeedRow'
import './saved.css'

type SubTab = 'bookmarks' | 'feeds'

const TABS = [
  { key: 'bookmarks', label: 'Bookmarks' },
  { key: 'feeds', label: 'Saved Feeds' },
]

/**
 * /saved — two sub-tabs.
 *
 *  Bookmarks: app.bsky.bookmark.getBookmarks when the AppView supports it;
 *    otherwise a clearly-labelled client-only (localStorage) fallback.
 *  Saved Feeds: the savedFeedsPrefV2 entry from actor preferences, hydrated
 *    to generator/list views with pin / remove actions.
 */
export default function SavedScreen() {
  const [params, setParams] = useSearchParams()
  const tab: SubTab = params.get('tab') === 'feeds' ? 'feeds' : 'bookmarks'

  const setTab = (key: string) => {
    const next = new URLSearchParams(params)
    next.set('tab', key)
    setParams(next, { replace: true })
  }

  return (
    <>
      <ScreenHeader title="Saved">
        <Tabs items={TABS} activeKey={tab} onChange={setTab} sticky />
      </ScreenHeader>

      {tab === 'bookmarks' ? <BookmarksTab /> : <SavedFeedsTab />}
    </>
  )
}

/* ============================ Bookmarks ============================ */

function BookmarksTab() {
  const {
    entries,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useBookmarks()
  const mode = useBookmarkMode()
  const remove = useRemoveBookmark()

  if (isLoading) {
    return (
      <div className="saved__center">
        <Spinner size="lg" />
      </div>
    )
  }
  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} title="Couldn't load bookmarks" />
  }

  return (
    <>
      {mode === 'local' && (
        <div className="saved__notice">
          Bookmarks are stored on this device only — your server doesn't support synced
          bookmarks, so they won't appear on other devices.
        </div>
      )}

      <InfiniteList<BookmarkEntry>
        items={entries}
        getKey={(b) => b.post.uri}
        estimateSize={140}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        emptyState={
          <EmptyState
            icon={<BookmarkIcon size={32} />}
            title="No bookmarks yet"
            message="Save posts from the ⋯ menu to find them again here."
          />
        }
        renderItem={(b) => (
          <div className="saved__bookmark">
            <PostCard post={b.post} />
            <div className="saved__bookmark-actions">
              <Button
                variant="ghost"
                size="sm"
                loading={remove.isPending && remove.variables?.uri === b.post.uri}
                onClick={() => remove.mutate({ uri: b.post.uri })}
              >
                Remove bookmark
              </Button>
            </div>
          </div>
        )}
      />
    </>
  )
}

/* =========================== Saved Feeds =========================== */

function SavedFeedsTab() {
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useSavedFeeds()
  const { setPinned, remove } = useSavedFeedActions()

  if (isLoading) {
    return (
      <div className="saved__center">
        <Spinner size="lg" />
      </div>
    )
  }
  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} title="Couldn't load saved feeds" />
  }

  const items = data ?? []
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<HashIcon size={32} />}
        title="No saved feeds"
        message="Pin feeds and lists to see them as tabs on your home screen."
        action={
          <Button variant="primary" size="md" onClick={() => navigate('/feeds')}>
            Discover feeds
          </Button>
        }
      />
    )
  }

  // Pinned first (display order within each group preserved from the array).
  const pinned = items.filter((i) => i.saved.pinned)
  const unpinned = items.filter((i) => !i.saved.pinned)

  return (
    <div className="saved__feeds">
      {pinned.length > 0 && (
        <section>
          <h2 className="saved__section-title">Pinned</h2>
          {pinned.map((item) => (
            <SavedFeedRow
              key={item.saved.id}
              item={item}
              pinning={setPinned.isPending && setPinned.variables?.id === item.saved.id}
              removing={remove.isPending && remove.variables?.id === item.saved.id}
              onTogglePin={() =>
                setPinned.mutate({ id: item.saved.id, pinned: !item.saved.pinned })
              }
              onRemove={() => remove.mutate({ id: item.saved.id })}
            />
          ))}
        </section>
      )}

      {unpinned.length > 0 && (
        <section>
          <h2 className="saved__section-title">Saved</h2>
          {unpinned.map((item) => (
            <SavedFeedRow
              key={item.saved.id}
              item={item}
              pinning={setPinned.isPending && setPinned.variables?.id === item.saved.id}
              removing={remove.isPending && remove.variables?.id === item.saved.id}
              onTogglePin={() =>
                setPinned.mutate({ id: item.saved.id, pinned: !item.saved.pinned })
              }
              onRemove={() => remove.mutate({ id: item.saved.id })}
            />
          ))}
        </section>
      )}
    </div>
  )
}
