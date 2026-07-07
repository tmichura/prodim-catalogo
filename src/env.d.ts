/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_WHATSAPP_NUMBER: string;
  readonly PUBLIC_EMPRESA_NOMBRE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
