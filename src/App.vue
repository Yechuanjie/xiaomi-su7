<template>
  <div ref="appShell" class="drive-app">
    <header class="topbar" :inert="!ready">
      <div class="topbar-content">
        <div class="brand" aria-label="SU7 Drive">
          <span class="brand-emblem" aria-hidden="true"><i></i></span>
          <span class="brand-name">SU7 <b>DRIVE</b></span>
        </div>
        <nav class="mode-picker" aria-label="驾驶模式">
          <button type="button" :aria-pressed="mode === 'free'" @click="chooseMode('free')">自由驾驶</button>
          <button type="button" :aria-pressed="mode === 'lap'" @click="chooseMode('lap')">单圈计时</button>
        </nav>
        <div class="header-actions">
          <button class="utility-button guide-button" type="button" @click="guide?.showModal()">
            <span class="help-icon" aria-hidden="true">?</span><span>操作指南</span>
          </button>
          <button class="utility-button icon-button" type="button" :aria-label="isFullscreen ? '退出全屏' : '全屏'" :title="isFullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
            <span class="expand-icon" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    </header>

    <main class="drive-layout" :inert="!ready">
      <section class="scene" :class="{ 'scene-driving': drivingStarted, 'scene-night': timeOfDay === 'night' }" aria-label="海岸公路">
        <SU7 ref="sceneView" @ready="onReady" @update="onUpdate" @progress="loadProgress = $event" @error="onLoadError"></SU7>
        <div class="scene-shade" aria-hidden="true"></div>

        <div class="scene-intro">
          <div class="location-line"><span class="location-pin" aria-hidden="true"></span>岬角灯塔</div>
          <h1>海岸公路</h1>
          <p>全长 {{ routeLength }} km<span class="middle-dot">·</span>双向两车道</p>
          <div class="scene-cta">
            <button type="button" class="primary-button" :disabled="!ready" @click="startDriving">
              <span class="play-icon" aria-hidden="true"></span>{{ mode === 'lap' ? '开始计时' : '开始驾驶' }}
            </button>
            <button type="button" class="secondary-button" :disabled="!ready" :aria-pressed="cruising" @click="toggleCruise">
              自动巡航
            </button>
          </div>
        </div>

        <div class="scene-actions">
          <button v-if="drivingStarted" type="button" class="scene-button cruise-button" :disabled="!ready" :aria-pressed="cruising" @click="toggleCruise">
            <span class="status-dot" aria-hidden="true"></span>巡航
          </button>
          <button type="button" class="scene-button" :aria-label="paused ? '继续驾驶' : '暂停驾驶'" :title="paused ? '继续驾驶' : '暂停驾驶'" :disabled="!ready" @click="togglePause">
            <span :class="paused ? 'play-icon' : 'pause-icon'" aria-hidden="true"></span>
          </button>
          <button type="button" class="scene-button" aria-label="保存场景照片" title="保存场景照片" :disabled="!ready" @click="capturePhoto">
            <span class="camera-icon" aria-hidden="true"></span>
          </button>
        </div>

        <div v-if="mode === 'lap' && ready" class="lap-timer">
          <div class="lap-timer-heading"><span>{{ telemetry.lapComplete ? '单圈完成' : '单圈计时' }}</span><span>{{ telemetry.checkpoints }}/{{ LAP_CHECKPOINTS }}</span></div>
          <strong>{{ formatTime(telemetry.elapsed) }}</strong>
          <div class="checkpoint-progress" aria-label="检查点进度">
            <i v-for="index in LAP_CHECKPOINTS" :key="index" :class="{ reached: index <= telemetry.checkpoints }"></i>
          </div>
          <small>最佳 {{ bestLap ? formatTime(bestLap) : '—' }}</small>
          <button v-if="telemetry.lapComplete" type="button" class="lap-restart" @click="restartLap">再跑一圈</button>
        </div>

        <div v-if="paused && ready" class="pause-state" role="status"><span class="pause-icon" aria-hidden="true"></span>已暂停</div>

        <div v-if="ready" class="speed-hud" aria-label="车辆仪表">
          <div class="speed-readout"><strong>{{ displaySpeed }}</strong><span>KM/H</span></div>
          <div class="speed-track" role="progressbar" aria-label="车速" :aria-valuenow="speed" :aria-valuemax="MAX_SPEED_KPH">
            <i :style="{ width: speed / MAX_SPEED_KPH * 100 + '%' }"></i>
          </div>
          <div class="speed-status"><span class="status-dot"></span>{{ drivingStatus }}</div>
        </div>

        <aside v-if="ready" class="route-hud" aria-label="公路地图">
          <div class="route-heading"><span>环线地图</span><span class="map-compass">N <b aria-hidden="true">↗</b></span></div>
          <CoastMap :distance="telemetry.distance" :lateral="telemetry.lateral" :progress="routeProgress" :lap="mode === 'lap'" :checkpoints="telemetry.checkpoints"></CoastMap>
          <div class="route-progress"><span>路线进度</span><b>{{ Math.floor(routeProgress * 100) }}%</b></div>
        </aside>

        <div v-if="ready" class="touch-controls" aria-label="触屏驾驶">
          <div>
            <button type="button" aria-label="向左转向" :class="{ 'touch-held': touchHeld.has('left') }" @pointerdown="holdControl($event, 'left')" @lostpointercapture="releaseControl('left')" @pointerup="releaseControl('left')" @pointercancel="releaseControl('left')">←</button>
            <button type="button" aria-label="向右转向" :class="{ 'touch-held': touchHeld.has('right') }" @pointerdown="holdControl($event, 'right')" @lostpointercapture="releaseControl('right')" @pointerup="releaseControl('right')" @pointercancel="releaseControl('right')">→</button>
          </div>
          <div>
            <button type="button" aria-label="刹车或倒车" :class="{ 'touch-held': touchHeld.has('reverse') }" @pointerdown="holdControl($event, 'reverse')" @lostpointercapture="releaseControl('reverse')" @pointerup="releaseControl('reverse')" @pointercancel="releaseControl('reverse')">↓</button>
            <button type="button" aria-label="加速" class="touch-throttle" :class="{ 'touch-held': touchHeld.has('accelerate') }" @pointerdown="holdControl($event, 'accelerate')" @lostpointercapture="releaseControl('accelerate')" @pointerup="releaseControl('accelerate')" @pointercancel="releaseControl('accelerate')">↑</button>
          </div>
        </div>

        <div v-if="notice" class="scene-notice" role="status">{{ notice }}</div>
      </section>

      <section class="control-dock" aria-label="车辆与环境">
        <div class="dock-panel">
          <div class="dock-heading"><h2>车漆颜色</h2><span>{{ palettes[paint].name }}</span></div>
          <div class="paint-picker" role="group" aria-label="车漆颜色">
            <button v-for="(option, index) in palettes" :key="option.name" type="button" class="paint-swatch" :aria-label="option.name" :title="option.name" :aria-pressed="paint === index" :disabled="!ready" :style="{ '--paint': option.swatch }" @click="selectPaint(index)"></button>
          </div>
        </div>
        <div class="dock-panel">
          <div class="dock-heading"><h2>驾驶视角</h2><span class="orbit-hint" v-if="camera === 'orbit'">拖动旋转 · 滚轮缩放</span><span class="orbit-hint" v-else-if="camera === 'cockpit'">拖动看内饰</span></div>
          <div class="segment-control" role="group" aria-label="驾驶视角">
            <button v-for="option in cameras" :key="option.id" type="button" :aria-pressed="camera === option.id" :disabled="!ready" @click="selectCamera(option.id)">{{ option.label }}</button>
          </div>
        </div>
        <div class="dock-panel">
          <div class="dock-heading"><h2>环境光照</h2><span>{{ pendingTime ? '载入天空…' : times.find(time => time.id === timeOfDay)?.clock }}</span></div>
          <div class="segment-control" role="group" aria-label="环境光照">
            <button v-for="option in times" :key="option.id" type="button" :aria-pressed="timeOfDay === option.id" :aria-busy="pendingTime === option.id" :disabled="!ready" @click="selectTime(option.id)">{{ option.label }}</button>
          </div>
        </div>
      </section>

      <footer class="drive-footer">
        <div class="key-hints" aria-label="常用快捷键">
          <span><kbd>W</kbd> 加速</span><span><kbd>A</kbd><kbd>D</kbd> 转向</span>
          <span><kbd>S</kbd> 刹车 / 倒车</span><span><kbd>Space</kbd> 刹车</span><span><kbd>C</kbd> 换视角</span>
        </div>
        <button type="button" class="utility-button reset-button" :disabled="!ready" @click="resetDrive"><span class="reset-icon" aria-hidden="true">↺</span> 车辆复位 <kbd>R</kbd></button>
      </footer>
    </main>

    <Transition name="loading-screen">
      <div v-if="!ready" class="loading-screen">
        <p class="loading-brand" aria-label="Xiaomi SU7"><span v-for="(letter, index) in 'XIAOMI SU7'" :key="index" :style="{ '--letter': index }" aria-hidden="true">{{ letter }}</span></p>
        <template v-if="loadError">
          <p class="loading-message" role="alert">{{ loadError }}</p>
          <button type="button" class="primary-button" @click="retry">重试</button>
        </template>
        <template v-else>
          <p class="loading-message" role="status">{{ loadingMessage }}</p>
          <progress v-if="loadProgress.total && loadProgress.completed < loadProgress.total" class="loading-progress" :value="loadProgress.completed" :max="loadProgress.total" aria-label="已加载的资源组"></progress>
        </template>
      </div>
    </Transition>

    <dialog ref="guide" class="help-dialog">
      <form method="dialog">
        <div class="dialog-heading"><h2>操作指南</h2><button class="utility-button icon-button" type="submit" aria-label="关闭操作指南">×</button></div>
        <dl>
          <dt>加速</dt><dd><kbd>W</kbd> 或 <kbd>↑</kbd></dd>
          <dt>刹车 / 刹停后倒车</dt><dd><kbd>S</kbd> 或 <kbd>↓</kbd></dd>
          <dt>刹车</dt><dd><kbd>Space</kbd></dd>
          <dt>左右转向</dt><dd><kbd>A</kbd><kbd>D</kbd> 或 <kbd>←</kbd><kbd>→</kbd></dd>
          <dt>切换视角</dt><dd><kbd>C</kbd></dd>
          <dt>暂停 / 继续</dt><dd><kbd>P</kbd></dd>
          <dt>回到起点</dt><dd><kbd>R</kbd></dd>
        </dl>
        <p>巡航时车辆会沿环线行驶。踩下油门或刹车即可接管。单圈计时从车辆起步开始，完成后在当前浏览器保存最佳成绩。</p>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import CoastMap from '@/components/CoastMap.vue'
import SU7 from '@/components/SU7.vue'
import { CoastScene, DEFAULT_PAINT, type SceneLoadingProgress, type TimeOfDay } from '@/drive/coastScene'
import { LAP_CHECKPOINTS, MAX_SPEED_KPH, type CameraMode, type DriveControl, type DriveMode, type DriveSnapshot } from '@/drive/driving'
import { coastRoute, DRIVING_LANE, START_DISTANCE } from '@/drive/route'

const palettes = [
  { name: '海湾蓝', color: DEFAULT_PAINT, swatch: '#46aeb1' },
  { name: '橄榄绿', color: '#637843', swatch: '#839568' },
  { name: '流星紫', color: '#493954', swatch: '#847191' },
  { name: '熔岩橙', color: '#c34429', swatch: '#df643e' },
  { name: '雅灰', color: '#929ba4', swatch: '#c1c9cf' }
]
const cameras: { id: CameraMode; label: string }[] = [
  { id: 'orbit', label: '环绕' },
  { id: 'chase', label: '跟车' },
  { id: 'hood', label: '车头' },
  { id: 'cockpit', label: '驾驶舱' }
]
const times: { id: TimeOfDay; label: string; clock: string }[] = [
  { id: 'day', label: '白天', clock: '13:20' },
  { id: 'sunset', label: '日落', clock: '18:40' },
  { id: 'night', label: '夜间', clock: '22:10' }
]
const keyControls: Partial<Record<string, DriveControl>> = {
  KeyW: 'accelerate', ArrowUp: 'accelerate',
  KeyS: 'reverse', ArrowDown: 'reverse', Space: 'brake',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right'
}

const appShell = ref<HTMLElement>()
const sceneView = ref<InstanceType<typeof SU7>>()
const guide = ref<HTMLDialogElement>()
const ready = ref(false)
const loadError = ref('')
const loadProgress = ref<SceneLoadingProgress>({ completed: 0, total: 0 })
const mode = ref<DriveMode>('free')
const drivingStarted = ref(false)
const paused = ref(false)
const cruising = ref(false)
const camera = ref<CameraMode>('orbit')
const paint = ref(0)
const timeOfDay = ref<TimeOfDay>('sunset')
const pendingTime = ref<TimeOfDay>()
const isFullscreen = ref(false)
const touchHeld = ref(new Set<DriveControl>())
const heldKeys = new Set<string>()
const notice = ref('')
const bestLap = ref(0)
const telemetry = shallowRef<DriveSnapshot>({
  distance: START_DISTANCE, lateral: DRIVING_LANE, speed: 0,
  elapsed: 0, checkpoints: 0, lapComplete: false, braking: false
})

const routeLength = (coastRoute.length / 1000).toFixed(2)
const loadingMessage = computed(() => {
  const { completed, total } = loadProgress.value
  if (total === 0) return '正在启动驾驶体验…'
  if (completed === total) return '正在准备 3D 场景…'
  return `正在加载车辆与场景资源 ${completed} / ${total}`
})
const speed = computed(() => Math.round(Math.abs(telemetry.value.speed) * 3.6))
const displaySpeed = computed(() => String(speed.value).padStart(3, '0'))
const drivingStatus = computed(() => {
  if (cruising.value) return '自动巡航'
  if (telemetry.value.speed < 0) return '倒车'
  return speed.value > 0 ? '行驶中' : '驻车'
})
const routeProgress = computed(() => {
  const travelled = Math.max(0, telemetry.value.distance - START_DISTANCE)
  if (mode.value === 'lap') return telemetry.value.lapComplete ? 1 : travelled / coastRoute.length
  return coastRoute.wrap(travelled) / coastRoute.length
})

let world: CoastScene | undefined
let noticeTimer = 0
let lightingRequest = 0
const bestKey = 'su7-coast-best-lap'

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = (Math.floor(seconds * 100) % 6000 / 100).toFixed(2)
  return String(minutes).padStart(2, '0') + ':' + remainder.padStart(5, '0')
}

function onReady(scene: CoastScene) {
  world = scene
  scene.reset(mode.value)
  ready.value = true
}

function onUpdate(snapshot: DriveSnapshot) {
  const justFinished = snapshot.lapComplete && !telemetry.value.lapComplete
  telemetry.value = snapshot
  if (world) cruising.value = world.driving.cruising
  if (justFinished && (!bestLap.value || snapshot.elapsed < bestLap.value)) {
    bestLap.value = snapshot.elapsed
    try { localStorage.setItem(bestKey, String(snapshot.elapsed)) } catch { /* Storage can be disabled. */ }
  }
}

function onLoadError(message: string) {
  ready.value = false
  loadError.value = message
}

function retry() {
  loadError.value = ''
  loadProgress.value = { completed: 0, total: 0 }
  void sceneView.value?.load()
}

function chooseMode(next: DriveMode) {
  if (mode.value === next) return
  mode.value = next
  resetDrive()
}

function resetDrive() {
  clearControls()
  world?.reset(mode.value)
  selectCamera('orbit')
  drivingStarted.value = false
  paused.value = false
  cruising.value = false
}

function selectCamera(next: CameraMode) {
  camera.value = next
  world?.setCamera(next)
}

function enterDrive() {
  if (!drivingStarted.value && camera.value === 'orbit') selectCamera('chase')
  drivingStarted.value = true
}

function startDriving() {
  if (!world) return
  enterDrive()
  world.driving.start()
  paused.value = false
}

function restartLap() {
  resetDrive()
  startDriving()
}

function toggleCruise() {
  if (!world) return
  if (!world.driving.cruising) startDriving()
  world.driving.cruising = !world.driving.cruising
  cruising.value = world.driving.cruising
}

function togglePause() {
  if (!world) return
  world.driving.paused = !world.driving.paused
  paused.value = world.driving.paused
  if (paused.value) clearControls()
  onUpdate({ ...world.driving.state })
}

function selectPaint(index: number) {
  paint.value = index
  world?.setPaint(palettes[index].color)
}

async function selectTime(next: TimeOfDay) {
  if (!world || (next === timeOfDay.value && !pendingTime.value)) return
  const request = ++lightingRequest
  pendingTime.value = next
  try {
    await world.setTimeOfDay(next)
    if (request === lightingRequest) timeOfDay.value = next
  } catch {
    if (request === lightingRequest) showNotice('天空资源加载失败，请重试。')
  } finally {
    if (request === lightingRequest) pendingTime.value = undefined
  }
}

function showNotice(message: string) {
  notice.value = message
  window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { notice.value = '' }, 2400)
}

function capturePhoto() {
  world?.capture(image => {
    if (!image) {
      showNotice('照片保存失败，请重试。')
      return
    }
    const url = URL.createObjectURL(image)
    const link = document.createElement('a')
    link.href = url
    link.download = 'SU7-海岸公路.png'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
    showNotice('已生成场景照片')
  })
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await appShell.value?.requestFullscreen()
    }
  } catch {
    showNotice('当前浏览器无法打开全屏。')
  }
}

function syncFullscreen() {
  isFullscreen.value = document.fullscreenElement === appShell.value
}

function syncControl(control: DriveControl) {
  const pressed = touchHeld.value.has(control) || [...heldKeys].some(code => keyControls[code] === control)
  if (pressed && (control === 'accelerate' || control === 'reverse') && !paused.value) enterDrive()
  world?.driving.setControl(control, pressed)
}

function holdControl(event: PointerEvent, control: DriveControl) {
  if (paused.value) togglePause()
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  touchHeld.value.add(control)
  syncControl(control)
}

function releaseControl(control: DriveControl) {
  touchHeld.value.delete(control)
  syncControl(control)
}

function clearControls() {
  heldKeys.clear()
  touchHeld.value.clear()
  world?.driving.input.clear()
}

function onKeyDown(event: KeyboardEvent) {
  if (!world || guide.value?.open || event.altKey || event.ctrlKey || event.metaKey) return
  const control = keyControls[event.code]
  if (control) {
    if (event.code === 'Space' && !drivingStarted.value && event.target instanceof HTMLButtonElement) return
    event.preventDefault()
    if (!paused.value && !heldKeys.has(event.code)) {
      heldKeys.add(event.code)
      syncControl(control)
    }
    return
  }
  if (event.repeat) return
  if (event.code === 'KeyR') resetDrive()
  if (event.code === 'KeyP') togglePause()
  if (event.code === 'KeyC') selectCamera(cameras[(cameras.findIndex(option => option.id === camera.value) + 1) % cameras.length].id)
}

function onKeyUp(event: KeyboardEvent) {
  const control = keyControls[event.code]
  if (!control || !heldKeys.delete(event.code)) return
  event.preventDefault()
  syncControl(control)
}

onMounted(() => {
  try {
    const stored = Number(localStorage.getItem(bestKey))
    if (Number.isFinite(stored) && stored > 0) bestLap.value = stored
  } catch { /* Storage can be disabled. */ }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', clearControls)
  document.addEventListener('visibilitychange', clearControls)
  document.addEventListener('fullscreenchange', syncFullscreen)
})

onBeforeUnmount(() => {
  lightingRequest++
  window.clearTimeout(noticeTimer)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', clearControls)
  document.removeEventListener('visibilitychange', clearControls)
  document.removeEventListener('fullscreenchange', syncFullscreen)
})
</script>
