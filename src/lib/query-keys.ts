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

  /**
   * Prefix matching every feed-family read for a viewer (timeline / custom /
   * author / likes) — the setQueriesData patch surface in lib/optimistic.
   */
  feedFamily: (did?: string) => ['bsky', did, 'feed'] as const,

  /**
   * Scalar newest-post-uri probe per home tab (feed-refresh affordance).
   * Deliberately OFF the feedFamily prefix so feed-wide cache ops never touch it.
   */
  feedHead: (did: string | undefined, feed: string) =>
    ['bsky', did, 'feed-head', { feed }] as const,

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

  // Actors who liked / reposted a post, and posts quoting it. Viewer-dependent:
  // the actor rows carry viewer.following and the quote posts carry like/repost
  // state, so an account switch must not bleed across — they include `did`.
  postLikedBy: (did: string | undefined, uri: string) =>
    ['bsky', did, 'post', 'likedBy', { uri }] as const,

  postRepostedBy: (did: string | undefined, uri: string) =>
    ['bsky', did, 'post', 'repostedBy', { uri }] as const,

  postQuotes: (did: string | undefined, uri: string) =>
    ['bsky', did, 'post', 'quotes', { uri }] as const,

  /** Prefix for the whole thread domain (invalidate when reply structure changes). */
  threads: ['bsky', 'thread'] as const,

  searchPosts: (q: string, sort?: 'top' | 'latest') =>
    ['bsky', 'search', 'posts', { q, sort }] as const,

  searchActors: (q: string) => ['bsky', 'search', 'actors', { q }] as const,

  notifications: (did?: string) => ['bsky', did, 'notifications', 'list'] as const,

  /** Hydrated subject posts for a batch of notification uris (sorted array). */
  notificationSubjects: (did: string | undefined, sorted: string[]) =>
    [...qk.notifications(did), 'subjects', sorted] as const,

  unreadCount: (did?: string) => ['bsky', did, 'notifications', 'unread'] as const,

  profile: (actor: string) => ['bsky', 'profile', { actor }] as const,

  // Bulk profile fetch (getProfiles) keyed by the sorted DID set.
  profilesBulk: (dids: string) => ['bsky', 'profiles', 'bulk', { dids }] as const,

  follows: (actor: string) => ['bsky', 'graph', 'follows', { actor }] as const,

  followers: (actor: string) => ['bsky', 'graph', 'followers', { actor }] as const,

  preferences: (did?: string) => ['bsky', did, 'preferences'] as const,

  // Derived preference reads (each transforms getPreferences differently, so
  // they cache separately under the preferences prefix and invalidate with it).
  pinnedTabs: (did?: string) => [...qk.preferences(did), 'pinned-tabs'] as const,

  savedFeedsState: (did?: string) => [...qk.preferences(did), 'savedFeedsState'] as const,

  savedFeeds: (did?: string) => [...qk.preferences(did), 'savedFeeds'] as const,

  savedListState: (did: string | undefined, listUri: string | undefined) =>
    [...qk.preferences(did), 'savedList', listUri] as const,

  mutes: (did?: string) => ['bsky', did, 'graph', 'mutes'] as const,

  blocks: (did?: string) => ['bsky', did, 'graph', 'blocks'] as const,

  myFeeds: (did?: string) => ['bsky', did, 'feeds', 'mine'] as const,

  feedGenerator: (uri: string) => ['bsky', 'feedGenerator', { uri }] as const,

  bookmarks: (did?: string) => ['bsky', did, 'bookmarks'] as const,

  // The two bookmark backends (AppView-native vs localStorage fallback) cache
  // separately under the bookmarks prefix.
  bookmarksNative: (did?: string) => [...qk.bookmarks(did), 'native'] as const,

  bookmarksLocal: (did?: string) => [...qk.bookmarks(did), 'local'] as const,

  lists: (actor: string) => ['bsky', 'lists', { actor }] as const,

  list: (uri: string) => ['bsky', 'list', { uri }] as const,

  /** getList's header slice (list view without members), under the list prefix. */
  listHeader: (uri: string) => [...qk.list(uri), 'header'] as const,

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

  // actor(+rkey) -> canonical at:// post uri (handle resolved to DID). Immutable.
  postUri: (actor: string, rkey: string) =>
    ['bsky', 'post', 'uri', { actor, rkey }] as const,

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

  /** The account's app passwords (com.atproto.server.listAppPasswords). */
  appPasswords: ['bsky', 'settings', 'appPasswords'] as const,

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

  // Tezos-token embed previews (objkt reads keyed under their own `embed` root;
  // public and viewer-independent).
  embedTezosToken: (fa: string, tokenId: string) =>
    ['embed', 'tezos-token', fa, tokenId] as const,

  embedTezosTokenDetails: (fa: string, tokenId: string) =>
    ['embed', 'tezos-token-details', fa, tokenId] as const,

  embedArtistTokens: (address: string) => ['embed', 'artist-tokens', address] as const,

  // Tezos / objkt integration (external services, not bsky). Keyed under a
  // separate `tezos` root so the bsky prefix-invalidation never touches them.
  tezosAddress: (did: string) => ['tezos', 'address', { did }] as const,

  // Whether a DID is on the tezoscommons closed-beta list (one of the two
  // access conditions; the other is a linked wallet). Membership is stable, so
  // keyed by did under the `tezos` root.
  tezosListMember: (did: string) => ['tezos', 'list-member', { did }] as const,

  objktCollections: (addr: string, kind: string) =>
    ['tezos', 'objkt', 'collections', kind, { addr }] as const,

  objktCollectionName: (contract: string) =>
    ['tezos', 'objkt', 'collection-name', { contract }] as const,

  // URL collection slug (fa.path) -> contract address. Immutable mapping.
  objktCollectionContract: (path: string) =>
    ['tezos', 'objkt', 'collection-contract', { path }] as const,

  objktTokens: (addr: string, kind: string, contract: string) =>
    ['tezos', 'objkt', 'tokens', kind, { addr, contract }] as const,

  // Standalone account view (/address/:address). tzbsky reverse lookup (address →
  // linked DID) + objkt account identity (name / avatar).
  tezosDidByAddress: (addr: string) => ['tezos', 'did-by-address', { addr }] as const,
  tezosAccount: (addr: string) => ['tezos', 'account', { addr }] as const,

  // Standalone contract view (/contract/:address). Classification via TzKT, plus
  // whole-collection metadata + tokens via objkt — keyed by contract, not holder.
  contractInfo: (contract: string) => ['tezos', 'contract', 'info', { contract }] as const,
  collection: (contract: string) => ['tezos', 'collection', { contract }] as const,
  collectionTokens: (contract: string) => ['tezos', 'collection', 'tokens', { contract }] as const,

  // Wallet overview (TzKT): tez balance, fungible balances, owned-NFT preview,
  // recent transactions. Keyed by raw tz-address under the same `tezos` root.
  walletBalance: (addr: string) => ['tezos', 'wallet', 'balance', { addr }] as const,
  walletTokens: (addr: string) => ['tezos', 'wallet', 'tokens', { addr }] as const,
  walletNfts: (addr: string) => ['tezos', 'wallet', 'nfts', { addr }] as const,
  walletActivity: (addr: string) => ['tezos', 'wallet', 'activity', { addr }] as const,

  // Ovoid Polls service (poll.ovoid.at — external first-party service). Separate
  // `poll` root so bsky prefix-invalidation never touches it; getPoll carries
  // viewer state so it's authed, but the id alone keys it (one viewer/session).
  poll: (id: string) => ['poll', { id }] as const,
  pollResults: (id: string) => ['poll', 'results', { id }] as const,

  // Ovoid Data service (data.ovoid.at — external first-party JSON-blob store).
  // Separate `data` root so bsky prefix-invalidation never touches it. Public
  // reads are keyed by the creator DID (the blob's owner), not the viewer.
  walletVisibility: (creatorDid: string) =>
    ['data', 'public', creatorDid, 'wallet-visibility'] as const,

  // The caller's own subdomain→publication registrations (data.ovoid.at).
  publications: (viewerDid: string | undefined) => ['data', 'publications', viewerDid] as const,
  publicationSubdomain: (sub: string) => ['data', 'publications', 'check', { sub }] as const,

  // standard.site long-form document (public reader). Pure public read — same
  // for every viewer, so no DID in the key. `authority` is whatever the URL
  // carried (handle or DID); the resolver normalizes it to a repo.
  standardDoc: (authority: string, rkey: string) =>
    ['standard', 'document', { authority, rkey }] as const,

  // Every document in a publication. Public read (no viewer). Covers single-repo
  // publications by listing the owner repo; cross-repo authorship needs an index.
  publicationDocs: (pubUri: string) => ['standard', 'publication-docs', { pubUri }] as const,
  publicationRecord: (pubUri: string) => ['standard', 'publication', { pubUri }] as const,

  /** Prefixes for family-wide invalidation of publicationRecord / standardDoc entries. */
  publicationRecordsAll: ['standard', 'publication'] as const,
  standardDocsAll: ['standard', 'document'] as const,

  // Every site.standard.publication record in an author's repo (public read,
  // no viewer). Scans the repo to surface a publication card on the profile.
  authorPublications: (did: string) => ['standard', 'author-publications', { did }] as const,

  // Resolve an arbitrary web URL to its site.standard.document at-uri, if it is
  // one (via the site's /.well-known + publication doc list). Used for chat
  // links, which carry no AppView associatedRefs. Cached per URL.
  standardSiteResolve: (url: string) => ['standard', 'resolve', { url }] as const,

  // Hydrated PostViews for AT-URIs embedded in long-form content (bsky-embed
  // blockquotes). Viewer-dependent (getPosts carries like/repost state).
  embedPosts: (viewerDid: string | undefined, uris: string[]) =>
    ['bsky', viewerDid, 'embed-posts', { uris }] as const,

  // Whether the viewer has a site.standard.graph.subscription to `pubUri` (an
  // at:// publication record). Viewer-dependent — carries the viewer DID so an
  // account switch can't bleed one reader's subscriptions into another's.
  standardSubscription: (viewerDid: string | undefined, pubUri: string) =>
    ['standard', 'subscription', viewerDid, { pubUri }] as const,

  /**
   * True for any feed-family read (timeline / custom feed / author feed / likes).
   * Encapsulates the positional knowledge (`key[2] === 'feed'`) in one place so
   * predicate-based invalidation doesn't hardcode the key shape at call sites.
   */
  isFeedKey: (key: readonly unknown[]): boolean => key[0] === 'bsky' && key[2] === 'feed',
}
