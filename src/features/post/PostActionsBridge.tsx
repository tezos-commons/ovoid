import { useMemo, type ReactNode } from 'react'
import { PostActionsProvider, type PostActions } from '@/components'
import { useComposer } from '@/store/compose-store'
import { usePostMutations, sharePost } from './use-post-mutations'

/**
 * App-root bridge: combines the like/repost mutations and the compose store
 * into the PostActions contract and provides it to every PostCard below. This
 * is the one place that knows about both halves, keeping components/ decoupled
 * from features/ while making posts interactive everywhere they render.
 */
export function PostActionsBridge({ children }: { children: ReactNode }) {
  const { toggleLike, toggleRepost } = usePostMutations()
  const { openReply, openQuote } = useComposer()

  const value = useMemo<PostActions>(
    () => ({
      toggleLike,
      toggleRepost,
      reply: openReply,
      quote: openQuote,
      share: (post) => void sharePost(post),
    }),
    [toggleLike, toggleRepost, openReply, openQuote],
  )

  return <PostActionsProvider value={value}>{children}</PostActionsProvider>
}
