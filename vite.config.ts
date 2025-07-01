import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import * as path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
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
