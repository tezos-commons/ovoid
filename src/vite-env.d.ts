/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Production OAuth client_id (URL of hosted client-metadata.json). Empty in dev. */
  readonly VITE_CLIENT_ID?: string
  /** Production redirect URI; must be present in client-metadata.json redirect_uris. */
  readonly VITE_REDIRECT_URI?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
