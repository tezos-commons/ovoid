import { useEffect, useMemo, useState } from 'react'
import {
  ScreenHeader,
} from '@/components/layout/ScreenHeader'
import {
  Tabs,
  NotificationsSkeleton,
  ErrorState,
  EmptyState,
  InfiniteList,
  Screen,
} from '@/components'
import { BellIcon } from '@/components/Icon'
import { useNotifications, type Notification } from './use-notifications'
import { useUpdateSeen } from './use-update-seen'
import {
  groupNotifications,
  collectSubjectUris,
  type NotifGroup,
} from './grouping'
import { useSubjectPosts } from './use-subject-posts'
import { ClusterRow, PostRow } from './NotificationGroup'
import './notifications.css'

type TabKey = 'all' | 'mentions'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'mentions', label: 'Mentions' },
]

/** Mentions tab shows only the reasons that @-address you directly. */
const MENTION_REASONS: ReadonlySet<string> = new Set([
  'mention',
  'reply',
  'quote',
])

function filterForTab(notifs: Notification[], tab: TabKey): Notification[] {
  if (tab === 'all') return notifs
  return notifs.filter((n) => MENTION_REASONS.has(n.reason as string))
}

export default function NotificationsScreen() {
  const [tab, setTab] = useState<TabKey>('all')
  const updateSeen = useUpdateSeen()

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useNotifications()

  // Mark everything seen once the screen mounts and the first page is in.
  // Firing on data presence (not just mount) ensures the seenAt timestamp is
  // >= the newest item the user is actually looking at.
  const hasData = !!data
  useEffect(() => {
    if (hasData) void updateSeen()
  }, [hasData, updateSeen])

  const flat = useMemo<Notification[]>(
    () => data?.pages.flatMap((p) => p.notifications) ?? [],
    [data],
  )

  const groups = useMemo<NotifGroup[]>(() => {
    const filtered = filterForTab(flat, tab)
    return groupNotifications(filtered)
  }, [flat, tab])

  // Hydrate like/repost cluster subjects for the preview line.
  const subjectUris = useMemo(() => collectSubjectUris(groups), [groups])
  const { data: subjects } = useSubjectPosts(subjectUris)

  const header = (
    <ScreenHeader title="Notifications">
      <Tabs
        items={TABS}
        activeKey={tab}
        onChange={(k) => setTab(k as TabKey)}
        sticky
      />
    </ScreenHeader>
  )

  if (isLoading) {
    return (
      <Screen top={header}>
        <NotificationsSkeleton />
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen top={header}>
        <ErrorState error={error} onRetry={() => refetch()} />
      </Screen>
    )
  }

  return (
    <Screen top={header}>
      <InfiniteList<NotifGroup>
        items={groups}
        getKey={(g) => g.key}
        estimateSize={90}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        emptyState={
          <EmptyState
            icon={<BellIcon size={40} />}
            title={tab === 'mentions' ? 'No mentions yet' : 'Nothing here yet'}
            message={
              tab === 'mentions'
                ? 'Replies, mentions and quotes of your posts will show up here.'
                : 'Likes, reposts, follows and replies will show up here.'
            }
          />
        }
        renderItem={(g) =>
          g.kind === 'post' ? (
            <PostRow group={g} />
          ) : (
            <ClusterRow
              group={g}
              subject={g.subjectUri ? subjects?.[g.subjectUri] : undefined}
            />
          )
        }
      />
    </Screen>
  )
}
