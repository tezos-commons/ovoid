import type { DetailedHTMLProps, HTMLAttributes } from 'react'

// Ambient JSX typing for the <model-viewer> web component (@google/model-viewer).
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        poster?: string
        alt?: string
        ar?: boolean
        'camera-controls'?: boolean
        'auto-rotate'?: boolean
        'interaction-prompt'?: string
        'shadow-intensity'?: string
        exposure?: string
        'touch-action'?: string
        loading?: string
      }
    }
  }
}
