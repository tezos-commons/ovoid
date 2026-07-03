import { Link, useParams } from 'react-router-dom'
import { Spinner, EmptyState, Button } from '@/components'
import { absoluteTime } from '@/lib/time'
import { queryClient } from '@/lib/query-client'
import { schedulePrefetch } from '@/lib/prefetch'
import { usePrefetchOnVisible } from '@/lib/use-prefetch-on-visible'
import { documentOptions } from '@/features/read/use-document'
import { usePublicationStudio, useDeletePost } from './use-documents'

/** Posts overview pane — list of the publication's documents with actions. */
export default function StudioPosts() {
  const { subdomain } = useParams<{ subdomain: string }>()
  const studio = usePublicationStudio(subdomain)
  const del = useDeletePost(studio.pubUri, studio.did)
  const posts = studio.posts.data ?? []

  return (
    <div className="studio-pane">
      <header className="studio-pane__head">
        <h1 className="studio-pane__title">Posts</h1>
        <span className="studio-pane__count">
          {posts.length} {posts.length === 1 ? 'post' : 'posts'}
        </span>
        <Link to={`/studio/${subdomain}/new`} className="btn btn--primary btn--sm">
          New post
        </Link>
      </header>

      {studio.posts.isPending ? (
        <div className="studio-loading"><Spinner /></div>
      ) : posts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          message="Write your first article."
          action={<Link to={`/studio/${subdomain}/new`} className="btn btn--primary btn--sm">New post</Link>}
        />
      ) : (
        <ul className="studio-posts">
          {posts.map((p) => (
            <li key={p.uri} className="studio-post">
              <Link to={`/studio/${subdomain}/edit/${p.rkey}`} className="studio-post__main">
                <span className="studio-post__title">{p.title}</span>
                {p.description && <span className="studio-post__excerpt">{p.description}</span>}
                <time className="studio-post__date" dateTime={p.publishedAt}>
                  {absoluteTime(p.publishedAt, { year: 'numeric' })}
                </time>
              </Link>
              <div className="studio-post__actions">
                {studio.did && <ViewLink did={studio.did} rkey={p.rkey} />}
                <Button
                  variant="ghost"
                  size="sm"
                  loading={del.isPending && del.variables === p.rkey}
                  onClick={() => {
                    if (confirm(`Delete “${p.title}”?`)) del.mutate(p.rkey)
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** "View" opens the public reader — warm the document on dwell (per-row hook,
 *  so it lives in its own component rather than the map callback). */
function ViewLink({ did, rkey }: { did: string; rkey: string }) {
  const ref = usePrefetchOnVisible<HTMLAnchorElement>(() => {
    const doc = documentOptions(did, rkey)
    schedulePrefetch(doc.queryKey, () => queryClient.prefetchQuery(doc))
  })
  return (
    <Link to={`/read/${did}/${rkey}`} className="btn btn--ghost btn--sm" ref={ref}>
      View
    </Link>
  )
}
