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
  ],
  css: {
    preprocessorOptions: {
      scss: {
        // 注入全局样式变量，可以直接在组件中使用变量或mixin
        additionalData: `@use "./src/assets/style/variable.scss" as *;`
      }
    },
    postcss: {
      plugins: [
        {
          postcssPlugin: 'internal:charset-removal',
          AtRule: {
            // 移除打包时 scss 的 @charset "UTF-8" 警告
            charset: atRule => {
              if (atRule.name === 'charset') {
                atRule.remove()
              }
            }
          }
        }
      ]
    }
  }
})
