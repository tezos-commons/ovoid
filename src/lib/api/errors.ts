import { XRPCError } from '@atproto/api'

export interface RateLimitInfo {
  limit?: number
  remaining?: number
  /** Epoch seconds when the window resets. */
  reset?: number
}

export interface NormalizedError {
  /** XRPC error name, e.g. 'RateLimitExceeded', 'InvalidRequest', or 'Unknown'. */
  name: string
  /** Human-readable message safe to surface in an ErrorState. */
  message: string
  status?: number
  rateLimit?: RateLimitInfo
  cause: unknown
}

function parseRateLimit(headers: Record<string, string> | undefined): RateLimitInfo | undefined {
  if (!headers) return undefined
  const limit = headers['ratelimit-limit']
  const remaining = headers['ratelimit-remaining']
  const reset = headers['ratelimit-reset']
  if (limit == null && remaining == null && reset == null) return undefined
  return {
    limit: limit != null ? Number(limit) : undefined,
    remaining: remaining != null ? Number(remaining) : undefined,
    reset: reset != null ? Number(reset) : undefined,
  }
}

/** Turn any thrown XRPC/network value into a stable, displayable shape. */
export function normalizeXrpcError(err: unknown): NormalizedError {
  if (err instanceof XRPCError) {
    return {
      name: err.error ?? 'XRPCError',
      message: err.message || err.error || 'Request failed',
      status: err.status,
      rateLimit: parseRateLimit(err.headers as Record<string, string> | undefined),
      cause: err,
    }
  }
  if (err instanceof Error) {
    return { name: err.name || 'Error', message: err.message || 'Something went wrong', cause: err }
  }
  return { name: 'Unknown', message: 'Something went wrong', cause: err }
}

export function isRateLimited(err: unknown): boolean {
  const n = normalizeXrpcError(err)
  return n.status === 429 || n.name === 'RateLimitExceeded'
}
