import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { PostActionsProvider, type PostActions } from '@/components'
import { useComposer } from '@/store/compose-store'
import { useIsMobile } from '@/lib/use-is-mobile'
import { usePostSheetStore } from '@/store/post-sheet-store'
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
  const navigate = useNavigate()
  // One device check for every PostCard, instead of a media-query listener per card.
  const isMobile = useIsMobile()
  const openSheet = usePostSheetStore((s) => s.openPost)

  const value = useMemo<PostActions>(
    () => ({
      toggleLike,
      toggleRepost,
      reply: openReply,
      quote: openQuote,
      share: (post) => void sharePost(post),
      openThread: (actor, rkey) =>
        isMobile ? openSheet(actor, rkey) : navigate(`/profile/${actor}/post/${rkey}`),
    }),
    [toggleLike, toggleRepost, openReply, openQuote, isMobile, openSheet, navigate],
  )

  return <PostActionsProvider value={value}>{children}</PostActionsProvider>
}
