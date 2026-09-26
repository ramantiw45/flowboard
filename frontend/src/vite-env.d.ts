/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the REST API. Default: http://localhost:8080/api */
  readonly VITE_API_BASE_URL?: string;
  /** SockJS/STOMP endpoint. Default: derived from VITE_API_BASE_URL. */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
