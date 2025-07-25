/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY: string;
  // tu peux ajouter d'autres variables ici
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
