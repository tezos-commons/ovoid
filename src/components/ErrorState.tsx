import { normalizeXrpcError } from '@/lib/api/errors'
import { Button } from './Button'

export interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  title?: string
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }: ErrorStateProps) {
  const { message } = normalizeXrpcError(error)
  return (
    <div className="state" role="alert">
      <div className="state__title">{title}</div>
      <p className="state__msg">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
