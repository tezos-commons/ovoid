import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components'
import { useSubscription } from './use-subscription'

/**
 * Subscribe / Unsubscribe toggle for a publication. Subscribing writes to the
 * viewer's repo, so signed-out readers get a button that routes to login and
 * returns them here.
 */
export function SubscribeButton({ pubUri }: { pubUri: string }) {
  const location = useLocation()
  const { isAuthed, subscribed, loading, pending, toggle } = useSubscription(pubUri)

  if (!isAuthed) {
    return (
      <Link
        to="/login"
        state={{ from: location.pathname + location.search }}
        className="rdr-login"
      >
        Subscribe
      </Link>
    )
  }

  return (
    <Button
      variant={subscribed ? 'secondary' : 'primary'}
      size="sm"
      loading={pending || loading}
      onClick={toggle}
    >
      {subscribed ? 'Unsubscribe' : 'Subscribe'}
    </Button>
  )
}
