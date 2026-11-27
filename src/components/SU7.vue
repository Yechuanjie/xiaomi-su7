<template>
  <div ref="viewport" class="scene-viewport"></div>
</template>

<script setup lang="ts">
import { CoastScene } from '@/drive/coastScene'
import type { DriveSnapshot } from '@/drive/driving'

const emits = defineEmits<{
  ready: [scene: CoastScene]
  update: [state: DriveSnapshot]
  error: [message: string]
}>()

const viewport = ref<HTMLDivElement>()
let scene: CoastScene | undefined
let generation = 0

async function load() {
  if (!viewport.value) return
  const id = ++generation
  scene?.dispose()
  scene = undefined
  try {
    const next = await CoastScene.create(viewport.value, state => {
      if (id === generation) emits('update', state)
    })
    if (id !== generation) {
      next.dispose()
      return
    }
    scene = next
    emits('ready', next)
  } catch (error) {
    if (id !== generation) return
    console.error(error)
    const message = error instanceof Error && /webgl|graphics context/i.test(error.message)
      ? '当前浏览器无法创建 WebGL 2 场景。启用图形加速后重试。'
      : '海岸公路资源加载失败，请重试。'
    emits('error', message)
  }
}

defineExpose({ load })
onMounted(load)
onBeforeUnmount(() => {
  generation++
  scene?.dispose()
})
</script>
