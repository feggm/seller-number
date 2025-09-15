/// <reference types="vite/client" />
/* eslint-disable @typescript-eslint/consistent-type-definitions */

interface ViteTypeOptions {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_POCKETBASE_URL: string
  readonly VITE_EVENT_CATEGORY_ID: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
