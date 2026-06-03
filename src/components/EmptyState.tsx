import type { ReactNode } from 'react'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  message?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="state">
      {icon && <div className="state__icon">{icon}</div>}
      <div className="state__title">{title}</div>
      {message && <p className="state__msg">{message}</p>}
      {action}
    </div>
  )
}
