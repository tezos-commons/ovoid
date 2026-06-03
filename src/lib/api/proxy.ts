import type { Agent } from '@atproto/api'

/**
 * Bluesky DM (chat) traffic must be proxied to the chat service. The agent
 * sends an `atproto-proxy: <did>#<serviceId>` header so the PDS forwards
 * chat.bsky.* XRPC calls to api.bsky.chat.
 */
export const CHAT_PROXY_DID = 'did:web:api.bsky.chat'
export const CHAT_PROXY_SERVICE_ID = 'bsky_chat'

/** Returns an Agent clone whose requests carry the chat proxy header. */
export function withChatProxy(agent: Agent): Agent {
  return agent.withProxy(CHAT_PROXY_SERVICE_ID, CHAT_PROXY_DID)
}
