/// <reference types="vite/client" />
declare module '*.vue' {
  import { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {}

interface ImportMetaEnv {
  /** 上下文环境 */
  readonly VITE_BASE_URL: string
}
