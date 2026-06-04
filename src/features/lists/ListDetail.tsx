import { useState } from 'react'
import { useParams } from 'react-router-dom'
import type { AppBskyGraphDefs } from '@atproto/api'
import { useAgent } from '@/lib/api/agent'
import { ScreenHeader } from '@/components/layout'
import { ErrorState, ListHeaderSkeleton, FeedSkeleton, Tabs } from '@/components'
import './lists.css'
import { useList, useListUri } from './use-list'
import { isCurate } from './PurposeChip'
import { ListHeader } from './ListHeader'
import { ListOverflowMenu } from './ListOverflowMenu'
import { MembersTab } from './MembersTab'
import { ListFeed } from './ListFeed'

type ListView = AppBskyGraphDefs.ListView

/**
 * List detail — public-capable.
 *
 * Header: avatar/name/creator/description + purpose chip and the action set
 * (subscribe/pin for curate lists; mute/block for mod lists; edit/delete when
 * owned). Body tabs: Members always; Feed for curate lists (getListFeed of
 * member posts). Reads work signed-out; all mutations are gated on auth/ownership.
 */
export function ListDetail() {
  const { actor = '', rkey = '' } = useParams<{ actor: string; rkey: string }>()
  const { did, isAuthed } = useAgent()
  const uriQuery = useListUri(actor, rkey)
  const listUri = uriQuery.data

  const listQuery = useList(listUri)
  const list: ListView | undefined = listQuery.data?.pages[0]?.list

  const curate = isCurate(list?.purpose)
  const [tab, setTab] = useState<'members' | 'feed'>('members')
  const activeTab = curate ? tab : 'members'

  if ((uriQuery.isLoading || listQuery.isLoading) && !list) {
    return (
      <>
        <ScreenHeader title="List" showBack />
        <ListHeaderSkeleton />
        <FeedSkeleton count={4} />
      </>
    )
  }

  if (uriQuery.isError || listQuery.isError || !list) {
    return (
      <>
        <ScreenHeader title="List" showBack />
        <ErrorState
          error={uriQuery.error ?? listQuery.error ?? new Error('List not found')}
          onRetry={() => (uriQuery.isError ? uriQuery.refetch() : listQuery.refetch())}
        />
      </>
    )
  }

  const owned = isAuthed && !!did && list.creator.did === did
  const tabItems = curate
    ? [
        { key: 'members', label: 'People' },
        { key: 'feed', label: 'Feed' },
      ]
    : [{ key: 'members', label: 'People' }]

  return (
    <>
      <ScreenHeader
        title={list.name}
        showBack
        actions={<ListOverflowMenu list={list} owned={owned} />}
      />

      <ListHeader list={list} owned={owned} />

      {tabItems.length > 1 && (
        <Tabs
          items={tabItems}
          activeKey={activeTab}
          onChange={(k) => setTab(k as 'members' | 'feed')}
          sticky
        />
      )}

      {activeTab === 'feed' && curate ? (
        <ListFeed listUri={listUri!} />
      ) : (
        <MembersTab listUri={listUri!} query={listQuery} owned={owned} />
      )}
    </>
  )
}

export default ListDetail
