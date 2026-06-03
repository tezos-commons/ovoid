import clsx from 'clsx'
import type { ElementType, ReactNode } from 'react'

export interface TextProps {
  as?: ElementType
  size?: 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl'
  weight?: 'regular' | 'medium' | 'semibold' | 'bold'
  tone?: 'default' | 'muted' | 'faint'
  className?: string
  children?: ReactNode
}

const weightClass: Record<NonNullable<TextProps['weight']>, string | undefined> = {
  regular: undefined,
  medium: 'text--medium',
  semibold: 'text--semibold',
  bold: 'text--bold',
}

const toneClass: Record<NonNullable<TextProps['tone']>, string | undefined> = {
  default: undefined,
  muted: 'text--muted',
  faint: 'text--faint',
}

export function Text({
  as: Tag = 'span',
  size = 'base',
  weight = 'regular',
  tone = 'default',
  className,
  children,
}: TextProps) {
  return (
    <Tag
      className={clsx('text', `text--${size}`, weightClass[weight], toneClass[tone], className)}
    >
      {children}
    </Tag>
  )
}
