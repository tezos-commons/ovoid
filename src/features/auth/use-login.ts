import { useCallback, useState } from 'react'
import { useAuth } from '@/lib/api/agent'

/**
 * Login form controller. Owns transient submit state for the single sign-in
 * path: OAuth. `signInOAuth(handle)` redirects the whole page to the user's PDS
 * authorization server, so on success the promise never resolves (the page is
 * gone); it only rejects when the user aborts or handle resolution fails. We
 * therefore keep `submitting=true` through a successful redirect and clear it
 * only on rejection.
 *
 * `pre` is the path to return to after auth — it round-trips through OAuth via
 * the `state` parameter and is consumed by the Callback screen.
 */
export interface UseLoginResult {
  submitting: boolean
  error: string | null
  signInOAuth: (handle: string) => Promise<void>
  clearError: () => void
}

/** Strip a leading @ and surrounding whitespace; tolerate did:/at:// inputs. */
function normalizeHandle(raw: string): string {
  const t = raw.trim()
  return t.startsWith('@') ? t.slice(1) : t
}

function messageFor(err: unknown): string {
  if (err instanceof Error) {
    if (/resolve|not.?found|unable to resolve/i.test(err.message)) {
      return 'Could not find that account. Check the handle and try again.'
    }
    if (/abort|cancell?ed|denied/i.test(err.message)) {
      return 'Sign-in was cancelled.'
    }
    if (/network|fetch|failed to fetch/i.test(err.message)) {
      return 'Network error reaching the authorization server. Try again.'
    }
    return err.message
  }
  return 'Something went wrong. Please try again.'
}

export function useLogin(pre: string): UseLoginResult {
  const auth = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const signInOAuth = useCallback(
    async (handleRaw: string) => {
      const handle = normalizeHandle(handleRaw)
      if (!handle) {
        setError('Enter your handle (e.g. alice.bsky.social) or DID.')
        return
      }
      setError(null)
      setSubmitting(true)
      try {
        // Redirects on success → execution does not continue past here.
        await auth.signIn(handle, { state: pre })
        // If we ever reach this line, the redirect did not happen.
        setSubmitting(false)
      } catch (err) {
        setSubmitting(false)
        setError(messageFor(err))
      }
    },
    [auth, pre],
  )

  return { submitting, error, signInOAuth, clearError }
}
