import { Agent } from '@atproto/api'

/**
 * Bluesky DM (chat) traffic must be proxied to the chat service. The agent
 * sends an `atproto-proxy: <did>#<serviceId>` header so the PDS forwards
 * chat.bsky.* XRPC calls to api.bsky.chat.
 */
export const CHAT_PROXY_DID = 'did:web:api.bsky.chat'
export const CHAT_PROXY_SERVICE_ID = 'bsky_chat'

/** The chat service appview, reachable directly for unauthenticated reads. */
export const CHAT_SERVICE_URL = 'https://api.bsky.chat'

/** Returns an Agent clone whose requests carry the chat proxy header. */
export function withChatProxy(agent: Agent): Agent {
  return agent.withProxy(CHAT_PROXY_SERVICE_ID, CHAT_PROXY_DID)
}

/**
 * A throwaway agent pointed straight at the chat service (no proxy, no session).
 * Used for the handful of chat reads that are public — currently group invite
 * link previews on the logged-out join landing. Authenticated chat traffic must
 * still go through `withChatProxy` so the PDS forwards it.
 */
let _chatPreviewAgent: Agent | null = null
export function chatPreviewAgent(): Agent {
  if (!_chatPreviewAgent) _chatPreviewAgent = new Agent(CHAT_SERVICE_URL)
  return _chatPreviewAgent
}
