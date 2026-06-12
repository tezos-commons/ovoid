/**
 * Query-key factory — the single source of truth for cache keys.
 *
 * Convention: ['bsky', viewerDid, <domain>, <subdomain>, ...params].
 * Viewer-dependent reads include `did`; public reads (thread, profile-by-handle)
 * omit it. Params go in a trailing object. Invalidate by prefix.
 *
 * NEVER inline a key array in a feature — always go through `qk`.
 */
export const qk = {
  all: ['bsky'] as const,

  session: (did?: string) => ['bsky', did, 'session'] as const,

  timeline: (did?: string) => ['bsky', did, 'feed', 'timeline'] as const,

  feed: (did: string | undefined, uri: string) =>
    ['bsky', did, 'feed', 'custom', { uri }] as const,

  authorFeed: (did: string | undefined, actor: string, filter?: string) =>
    ['bsky', did, 'feed', 'author', { actor, filter }] as const,

  /**
   * Prefix matching every filter variant of an actor's author feed. The full key
   * carries `filter` as an own property of the params object, so partial-matching
   * with `{ actor, filter: undefined }` does NOT hit `{ actor, filter: 'posts_…' }`
   * entries — invalidation must go through this filterless form.
   */
  authorFeedAll: (did: string | undefined, actor: string) =>
    ['bsky', did, 'feed', 'author', { actor }] as const,

  actorLikes: (did: string | undefined, actor: string) =>
    ['bsky', did, 'feed', 'likes', { actor }] as const,

  thread: (uri: string) => ['bsky', 'thread', { uri }] as const,

  /** Prefix for the whole thread domain (invalidate when reply structure changes). */
  threads: ['bsky', 'thread'] as const,

  searchPosts: (q: string, sort?: 'top' | 'latest') =>
    ['bsky', 'search', 'posts', { q, sort }] as const,

  searchActors: (q: string) => ['bsky', 'search', 'actors', { q }] as const,

  notifications: (did?: string) => ['bsky', did, 'notifications', 'list'] as const,

  unreadCount: (did?: string) => ['bsky', did, 'notifications', 'unread'] as const,

  profile: (actor: string) => ['bsky', 'profile', { actor }] as const,

  // Bulk profile fetch (getProfiles) keyed by the sorted DID set.
  profilesBulk: (dids: string) => ['bsky', 'profiles', 'bulk', { dids }] as const,

  follows: (actor: string) => ['bsky', 'graph', 'follows', { actor }] as const,

  followers: (actor: string) => ['bsky', 'graph', 'followers', { actor }] as const,

  preferences: (did?: string) => ['bsky', did, 'preferences'] as const,

  mutes: (did?: string) => ['bsky', did, 'graph', 'mutes'] as const,

  blocks: (did?: string) => ['bsky', did, 'graph', 'blocks'] as const,

  myFeeds: (did?: string) => ['bsky', did, 'feeds', 'mine'] as const,

  feedGenerator: (uri: string) => ['bsky', 'feedGenerator', { uri }] as const,

  bookmarks: (did?: string) => ['bsky', did, 'bookmarks'] as const,

  lists: (actor: string) => ['bsky', 'lists', { actor }] as const,

  list: (uri: string) => ['bsky', 'list', { uri }] as const,

  convos: (did?: string) => ['bsky', did, 'chat', 'convos'] as const,

  messages: (convoId: string) => ['bsky', 'chat', 'messages', { convoId }] as const,

  // A single convo view (group header + settings). Viewer-dependent (roles,
  // unread join-request counts are per-owner) so it carries `did`.
  convo: (did: string | undefined, convoId: string) =>
    ['bsky', did, 'chat', 'convo', { convoId }] as const,

  // Full group roster via getConvoMembers (convo.members is only a partial set).
  convoMembers: (did: string | undefined, convoId: string) =>
    ['bsky', did, 'chat', 'convoMembers', { convoId }] as const,

  // Pending join requests for a group (owner-only read).
  joinRequests: (did: string | undefined, convoId: string) =>
    ['bsky', did, 'chat', 'joinRequests', { convoId }] as const,

  // Join-link preview by code. Public read (works logged-out) — omits `did`.
  joinLinkPreview: (code: string) =>
    ['bsky', 'chat', 'joinLinkPreview', { code }] as const,

  // Viewer's chat actor status (canCreateGroups / chatDisabled / groupMemberLimit).
  chatStatus: (did?: string) => ['bsky', did, 'chat', 'status'] as const,

  // Actor/rkey -> AT-URI resolution caches (immutable for a given route).
  feedGeneratorUri: (actor: string, rkey: string) =>
    ['bsky', 'feedGenerator', 'uri', { actor, rkey }] as const,

  listUri: (actor: string, rkey: string) =>
    ['bsky', 'list', 'uri', { actor, rkey }] as const,

  // Labelers.
  labelerService: (did: string) => ['bsky', 'labeler', 'service', { did }] as const,

  labelerDirectory: (dids: string) => ['bsky', 'labeler', 'directory', { dids }] as const,

  // Discover surfaces (some back unspecced endpoints).
  discoverFeeds: (q?: string, limit?: number) =>
    ['bsky', 'discover', 'feeds', { q, limit }] as const,

  suggestedFeeds: (did?: string) => ['bsky', did, 'discover', 'suggestedFeeds'] as const,

  trending: () => ['bsky', 'discover', 'trending'] as const,

  suggestedActors: (limit?: number) =>
    ['bsky', 'discover', 'suggestedActors', { limit }] as const,

  searchTypeahead: (q: string) => ['bsky', 'search', 'typeahead', { q }] as const,

  // Ovoid notify service (our own push backend, not bsky). Separate `notify`
  // root so bsky prefix-invalidation never touches it. All reads are
  // viewer-scoped — the backend resolves state by the authed DID.
  notifyPrefs: (did?: string) => ['notify', did, 'prefs'] as const,

  notifyDevices: (did?: string) => ['notify', did, 'devices'] as const,

  notifyWatches: (did?: string) => ['notify', did, 'watches'] as const,

  notifyMutes: (did?: string) => ['notify', did, 'mutes'] as const,

  notifyThreadMutes: (did?: string) => ['notify', did, 'threadMutes'] as const,

  notifyChatStatus: (did?: string) => ['notify', did, 'chatStatus'] as const,

  notifyConvoMutes: (did?: string) => ['notify', did, 'convoMutes'] as const,

  // External-link unfurl metadata (cardyb extractor). Public and viewer-
  // independent; separate root so bsky prefix-invalidation never touches it.
  linkMeta: (url: string) => ['external', 'linkMeta', { url }] as const,

  // Tezos / objkt integration (external services, not bsky). Keyed under a
  // separate `tezos` root so the bsky prefix-invalidation never touches them.
  tezosAddress: (did: string) => ['tezos', 'address', { did }] as const,

  objktCollections: (addr: string, kind: string) =>
    ['tezos', 'objkt', 'collections', kind, { addr }] as const,

  objktCollectionName: (contract: string) =>
    ['tezos', 'objkt', 'collection-name', { contract }] as const,

  // URL collection slug (fa.path) -> contract address. Immutable mapping.
  objktCollectionContract: (path: string) =>
    ['tezos', 'objkt', 'collection-contract', { path }] as const,

  objktTokens: (addr: string, kind: string, contract: string) =>
    ['tezos', 'objkt', 'tokens', kind, { addr, contract }] as const,

  /**
   * True for any feed-family read (timeline / custom feed / author feed / likes).
   * Encapsulates the positional knowledge (`key[2] === 'feed'`) in one place so
   * predicate-based invalidation doesn't hardcode the key shape at call sites.
   */
  isFeedKey: (key: readonly unknown[]): boolean => key[0] === 'bsky' && key[2] === 'feed',
}
