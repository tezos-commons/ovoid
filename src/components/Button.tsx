import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'inverted' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  iconOnly?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconOnly = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        iconOnly && 'btn--icon-only',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {!iconOnly && children}
    </button>
  )
}
