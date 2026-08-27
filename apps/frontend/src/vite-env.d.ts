/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API root, no version segment. Each call names `/v1` or `/v2` itself. */
  readonly VITE_API_URL?: string
  /** Parent domain for the `aide_token` cookie; empty for host-only. */
  readonly VITE_COOKIE_DOMAIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
