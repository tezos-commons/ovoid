import { CURATE, MODLIST, REFERENCE } from './use-list'

interface PurposeMeta {
  label: string
  cls: string
}

export function purposeMeta(purpose: string | undefined): PurposeMeta {
  switch (purpose) {
    case CURATE:
      return { label: 'User list', cls: 'purpose-chip--curate' }
    case MODLIST:
      return { label: 'Moderation list', cls: 'purpose-chip--mod' }
    case REFERENCE:
      return { label: 'Starter pack', cls: 'purpose-chip--ref' }
    default:
      return { label: 'List', cls: 'purpose-chip--ref' }
  }
}

export function isCurate(purpose: string | undefined): boolean {
  return purpose === CURATE
}

export function isModlist(purpose: string | undefined): boolean {
  return purpose === MODLIST
}

/** Small pill describing a list's purpose (curate / moderation / reference). */
export function PurposeChip({ purpose }: { purpose: string | undefined }) {
  const m = purposeMeta(purpose)
  return <span className={`purpose-chip ${m.cls}`}>{m.label}</span>
}
