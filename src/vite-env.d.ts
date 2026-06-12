/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Production OAuth client_id (URL of hosted client-metadata.json). Empty in dev. */
  readonly VITE_CLIENT_ID?: string
  /** Production redirect URI; must be present in client-metadata.json redirect_uris. */
  readonly VITE_REDIRECT_URI?: string
  /** Base URL of the Ovoid notify service (push backend). Push UI hidden when unset. */
  readonly VITE_NOTIFY_URL?: string
  /** The notify service's DID — the `aud` of minted service-auth tokens. */
  readonly VITE_NOTIFY_DID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
