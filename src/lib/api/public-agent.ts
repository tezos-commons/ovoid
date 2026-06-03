import { Agent } from '@atproto/api'

/** Public AppView endpoint — unauthenticated reads (thread/profile when signed out). */
export const PUBLIC_API_URL = 'https://public.api.bsky.app'

/** Construct a throwaway unauthenticated Agent against the public AppView. */
export function makePublicAgent(): Agent {
  return new Agent(PUBLIC_API_URL)
}
