import { defineConfig, ConfigEnv, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
// @ts-ignore
import * as path from 'path'

// https://vitejs.dev/config/
export default ({ mode }: ConfigEnv) => {
  // 获取环境变量
  const envConfig = loadEnv(mode, process.cwd())

  return defineConfig({
    base: envConfig.VITE_BASE_URL,
    resolve: {
      // @ts-ignore
      alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }]
    },
    plugins: [
      vue(),
      AutoImport({
        resolvers: [],
        imports: ['vue'],
        dts: 'src/types/auto-imports.d.ts',
        eslintrc: {
          enabled: true
        }
      })
    ]
  })
}
