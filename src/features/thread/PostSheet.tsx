import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Dialog } from '@/components'
import { usePostSheetStore } from '@/store/post-sheet-store'
import { ThreadView } from './ThreadScreen'

/**
 * Mobile post viewer: the thread in a full-height bottom sheet over the feed.
 * Because nothing navigates, the feed underneath stays mounted and its scroll is
 * preserved — back (button / edge-swipe via useCloseOnBack) just closes the
 * sheet. Mounted only while open (RootLayout gates it), like the compose modal.
 */
export function PostSheet() {
  const { actor, rkey, close } = usePostSheetStore()

  // NB: the feed's scroll is preserved by Dialog's position-preserving scroll
  // lock (it freezes the background and restores the offset on close), and
  // back/edge-swipe → close is handled in RootLayout via useCloseOnBack on the
  // store's open flag — from an always-mounted component, so the history sentinel
  // exists immediately (this sheet is lazy and would push it late).

  // If something inside the thread navigates the route (an author link, a
  // counts link), close the sheet so that destination isn't left under it.
  const { pathname } = useLocation()
  const startPath = useRef(pathname)
  useEffect(() => {
    if (pathname !== startPath.current) close()
  }, [pathname, close])

  return (
    <Dialog open onClose={close} title="Post" sheetOnMobile>
      {/* key by the post so swapping to a reply remounts cleanly at its top */}
      <ThreadView key={`${actor}/${rkey}`} actor={actor} rkey={rkey} inSheet />
    </Dialog>
  )
}

export default PostSheet
