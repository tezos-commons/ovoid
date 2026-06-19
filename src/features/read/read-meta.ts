import { useEffect } from 'react'

type Attr = 'name' | 'property'

/** Upsert a <meta>, returning a restore fn (removes if we created it). */
function upsertMeta(attr: Attr, key: string, content: string): () => void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  const created = !el
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  const prev = created ? null : el.getAttribute('content')
  el.setAttribute('content', content)
  const node = el
  return () => {
    if (created) node.remove()
    else if (prev != null) node.setAttribute('content', prev)
  }
}

/**
 * Set the document title + OpenGraph/description meta for a reader page.
 *
 * NOTE: this is client-side only. It fixes the browser tab and in-app reads, but
 * crawlers/unfurlers that don't run JS won't see it — real share cards still
 * need SSR/prerender (the open scope decision from the reader's first cut).
 */
export function useShareMeta(meta: { title?: string; description?: string; image?: string } | undefined) {
  const { title, description, image } = meta ?? {}
  useEffect(() => {
    if (!title) return
    const restores: Array<() => void> = []

    const prevTitle = document.title
    document.title = title
    restores.push(() => {
      document.title = prevTitle
    })

    restores.push(upsertMeta('property', 'og:title', title))
    if (description) {
      restores.push(upsertMeta('name', 'description', description))
      restores.push(upsertMeta('property', 'og:description', description))
    }
    if (image) restores.push(upsertMeta('property', 'og:image', image))

    return () => restores.forEach((fn) => fn())
  }, [title, description, image])
}
