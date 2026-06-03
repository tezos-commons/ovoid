import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label — required since there is no visible text. */
  label: string
  children: ReactNode
}

/** Bare round icon-only control for ⋯ menus, headers, action affordances. */
export function IconButton({ label, className, children, ...rest }: IconButtonProps) {
  return (
    <button className={clsx('iconbtn', className)} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  )
}
