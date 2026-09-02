import { ModalSheet } from '@/components'
import { useConsentStore, type ConsentKind } from './consent-store'
import './interactive.css'

/** Human target for a serviceAuth aud: the domain for did:web, the DID itself
 *  otherwise. */
function audLabel(aud: string): string {
  return aud.startsWith('did:web:') ? aud.slice('did:web:'.length) : aud
}

const HEADINGS: Record<ConsentKind, string> = {
  viewer: 'Share your identity?',
  serviceAuth: 'Authenticate to a service?',
  post: 'Publish a post?',
  like: 'Like a post?',
  repost: 'Repost a post?',
  follow: 'Follow someone?',
}

/** Confirm-button label — a concrete verb, so the action is unmistakable. */
const VERBS: Record<ConsentKind, string> = {
  viewer: 'Allow',
  serviceAuth: 'Allow',
  post: 'Post',
  like: 'Like',
  repost: 'Repost',
  follow: 'Follow',
}

/**
 * Consent prompt for interactive-artifact bridge requests. Mounted once in
 * RootLayout (like the other global overlays) and driven by the consent store,
 * so it works over both the ArtifactPlayer and the /interactive dev screen.
 * Everything shown is host-derived (post targets are resolved by the bridge,
 * not described by the artifact) except the artifact title, which is
 * attacker-controlled metadata — the frame origin is always displayed with it.
 */
export function ConsentDialog() {
  const current = useConsentStore((s) => s.current)
  const decide = useConsentStore((s) => s.decide)
  if (!current) return null

  return (
    <ModalSheet open onClose={() => decide(false)} title={HEADINGS[current.kind]}>
      <div className="iconsent">
        {current.title && <div className="iconsent__name">{current.title}</div>}
        <code className="iconsent__origin">{new URL(current.origin).hostname}</code>

        {current.kind === 'viewer' && (
          <p>
            This interactive artifact asks who is viewing it. Ovoid would share your handle,
            display name, DID, avatar and linked Tezos address with it.
          </p>
        )}

        {current.kind === 'serviceAuth' && (
          <>
            <div className="iconsent__target">
              <span className="iconsent__target-host">{audLabel(current.aud ?? '')}</span>
              <span className="iconsent__target-did">{current.aud}</span>
            </div>
            <p>
              This interactive artifact wants a token proving your identity to this service.
              The token is short-lived and only valid there.
            </p>
          </>
        )}

        {current.kind === 'post' && (
          <>
            <blockquote className="iconsent__post">{current.postText}</blockquote>
            <p>
              The artifact wrote this text. Posting publishes it publicly from your account —
              exactly as shown above.
            </p>
          </>
        )}

        {(current.kind === 'like' || current.kind === 'repost') && (
          <>
            <div className="iconsent__subject">
              <span className="iconsent__subject-handle">@{current.subject?.handle}</span>
              {current.subject?.text && (
                <span className="iconsent__subject-text">{current.subject.text}</span>
              )}
            </div>
            <p>
              {current.kind === 'like' ? 'Like' : 'Repost'} this post from your account? The
              post shown is what the artifact selected
              {current.kind === 'repost' ? ' — reposting shares it to your followers' : ''}.
            </p>
          </>
        )}

        {current.kind === 'follow' && (
          <>
            <div className="iconsent__subject">
              {current.subject?.displayName && (
                <span className="iconsent__subject-name">{current.subject.displayName}</span>
              )}
              <span className="iconsent__subject-handle">@{current.subject?.handle}</span>
            </div>
            <p>Follow this account from your account?</p>
          </>
        )}

        <div className="iconsent__actions">
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => decide(false)}>
            Deny
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => decide(true)}>
            {VERBS[current.kind]}
          </button>
        </div>
      </div>
    </ModalSheet>
  )
}
