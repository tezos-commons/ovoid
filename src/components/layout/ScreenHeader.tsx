import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton } from '../IconButton'
import { BackIcon } from '../Icon'

export interface ScreenHeaderProps {
  title?: ReactNode
  /** Show a back button that pops the history stack. */
  showBack?: boolean
  /** Right-aligned actions (menu, settings, etc.). */
  actions?: ReactNode
  /** Optional sticky tab strip rendered below the title bar. */
  children?: ReactNode
}

/** Sticky 52px header used by route screens (title / back / actions + optional tabs). */
export function ScreenHeader({ title, showBack, actions, children }: ScreenHeaderProps) {
  const navigate = useNavigate()
  return (
    <>
      <header className="screen-header">
        {showBack && (
          <IconButton label="Back" onClick={() => navigate(-1)}>
            <BackIcon size={20} />
          </IconButton>
        )}
        {title && <span className="screen-header__title">{title}</span>}
        <span style={{ flex: 1 }} />
        {actions}
      </header>
      {children}
    </>
  )
}
