<template>
  <canvas ref="canvas" class="coast-map-canvas" role="img" aria-label="环线小地图，亮点表示车辆位置"></canvas>
</template>

<script setup lang="ts">
import { coastRoute, roadFrame } from '@/drive/route'
import { coastX } from '@/drive/landscape'
import { LAP_CHECKPOINTS } from '@/drive/driving'

const props = defineProps<{ distance: number; lateral: number; progress: number; lap: boolean; checkpoints: number }>()
const canvas = ref<HTMLCanvasElement>()
const position = roadFrame()
const northBound = Math.min(...coastRoute.points.map(point => point.z))
const southBound = Math.max(...coastRoute.points.map(point => point.z))
const eastBound = Math.max(...coastRoute.points.map(point => point.x))
let observer: ResizeObserver | undefined

function draw() {
  const element = canvas.value
  if (!element) return
  const width = element.clientWidth
  const height = element.clientHeight
  const scale = Math.min(devicePixelRatio, 2)
  if (!width || !height) return
  if (element.width !== Math.round(width * scale) || element.height !== Math.round(height * scale)) {
    element.width = Math.round(width * scale)
    element.height = Math.round(height * scale)
  }
  const ctx = element.getContext('2d')
  if (!ctx) return
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const pixels = Math.min((width - 30) / (southBound - northBound), (height - 23) / (eastBound + 28))
  const routeWidth = (southBound - northBound) * pixels
  const project = (x: number, z: number) => [width / 2 - routeWidth / 2 + (southBound - z) * pixels, 13 + (x + 26) * pixels] as const

  ctx.lineWidth = 1
  ctx.strokeStyle = '#edfaca15'
  ctx.beginPath()
  for (let x = 13; x < width; x += 17) { ctx.moveTo(x, 0); ctx.lineTo(x, height) }
  for (let y = 10; y < height; y += 17) { ctx.moveTo(0, y); ctx.lineTo(width, y) }
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(0, height)
  for (let z = southBound + 200; z >= northBound - 200; z -= 8) {
    ctx.lineTo(...project(coastX(z), z))
  }
  ctx.lineTo(width, height)
  ctx.fillStyle = '#e0edab0a'
  ctx.fill()

  ctx.beginPath()
  coastRoute.points.forEach(point => ctx.lineTo(...project(point.x, point.z)))
  ctx.closePath()
  ctx.lineJoin = 'round'
  ctx.lineWidth = 5
  ctx.strokeStyle = '#101511'
  ctx.stroke()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#a4ad89a8'
  ctx.stroke()

  const stop = props.progress * (coastRoute.points.length - 1)
  ctx.beginPath()
  for (let i = 0; i <= stop; i += 2) {
    const point = coastRoute.points[i]
    ctx.lineTo(...project(point.x, point.z))
  }
  ctx.strokeStyle = '#dcf783'
  ctx.stroke()

  if (props.lap) {
    for (let i = 0; i < LAP_CHECKPOINTS; i++) {
      coastRoute.at(coastRoute.length * i / LAP_CHECKPOINTS, position)
      ctx.beginPath()
      ctx.arc(...project(position.point.x, position.point.z), 2.5, 0, Math.PI * 2)
      ctx.fillStyle = i < props.checkpoints ? '#dcf783' : '#a2aa92'
      ctx.fill()
    }
  }

  coastRoute.at(props.distance, position, props.lateral)
  const [x, y] = project(position.point.x, position.point.z)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.atan2(position.forward.x, -position.forward.z))
  ctx.strokeStyle = '#131a11'
  ctx.fillStyle = '#dcf783'
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.moveTo(6.5, 0)
  ctx.lineTo(-4, 4.25)
  ctx.lineTo(-2.2, 0)
  ctx.lineTo(-4, -4.25)
  ctx.closePath()
  ctx.stroke()
  ctx.fill()
  ctx.restore()
}

watch(() => [props.distance, props.lateral, props.progress, props.lap, props.checkpoints], draw)
onMounted(() => {
  if (!canvas.value) return
  observer = new ResizeObserver(draw)
  observer.observe(canvas.value)
  draw()
})
onBeforeUnmount(() => observer?.disconnect())
</script>
