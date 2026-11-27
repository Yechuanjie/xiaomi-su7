import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader'
import { getResourceUrl, loadGltf, loadTexture } from '@/utils/resource'
import { disposeObjects } from './dispose'
import { CameraMode, DriveMode, DriveSnapshot, Driving, TRAFFIC_CLEARANCE, TRAFFIC_LATERAL_CLEARANCE } from './driving'
import { createOcean, Landscape } from './landscape'
import { coastRoute, DRIVING_LANE, roadFrame } from './route'
import { createRoadway } from './roadway'
import { createScenery } from './scenery'
import { Vehicle } from './vehicle'

export const DEFAULT_PAINT = '#239b9f'
export type TimeOfDay = 'sunset' | 'day' | 'night'
export interface SceneLoadingProgress {
  completed: number
  total: number
}

const lighting = {
  sunset: {
    sky: 0.51, environment: 0.62, exposure: 1.08, sun: 3.3, sunColor: 0xffac74, altitude: 0.23,
    skyColor: 0xe5edff, ground: 0x92908e, fill: 1.22, fog: 0xb0aab3, sea: 0x286676, glint: 0.78,
    skyTint: 0xececff, horizonTint: 0xffd9bc
  },
  day: {
    sky: 0.69, environment: 0.72, exposure: 1.06, sun: 3.2, sunColor: 0xfff1da, altitude: 0.94,
    skyColor: 0xe2efff, ground: 0x8a8170, fill: 1.35, fog: 0xb4c6ce, sea: 0x2b7b96, glint: 0.3,
    skyTint: 0xffffff, horizonTint: 0xeaf6ff
  },
  night: {
    sky: 0.037, environment: 0.22, exposure: 1.08, sun: 0.36, sunColor: 0x8db6eb, altitude: 0.29,
    skyColor: 0x748bbc, ground: 0x474e58, fill: 0.69, fog: 0x202c45, sea: 0x102c42, glint: 0.1,
    skyTint: 0x8ca7ed, horizonTint: 0x9db5da
  }
}

const SKY_ROTATION = -THREE.MathUtils.degToRad(101)
const asset = (name: string) => `models/coast/${name}`
const loadSky = async (time: TimeOfDay) => {
  const texture = await new RGBELoader().loadAsync(getResourceUrl(asset(`${time}.hdr`)))
  texture.mapping = THREE.EquirectangularReflectionMapping
  return texture
}

async function loadCoastAssets(onProgress: (progress: SceneLoadingProgress) => void) {
  const palmManager = new THREE.LoadingManager()
  palmManager.setURLModifier(url => {
    if (url.endsWith('/Plam_4_Trunk_baseColor.png')) return getResourceUrl(asset('palm-bark.webp'))
    if (url.endsWith('/Palm_4_Leaf_baseColor.png')) return getResourceUrl(asset('palm-leaf.webp'))
    return url
  })
  const textureNames = ['asphalt.webp', 'asphalt-normal.webp', 'grass.webp', 'rock.webp']
  const total = 3 + textureNames.length
  let completed = 0
  onProgress({ completed, total })

  function track<T>(request: Promise<T>): Promise<T> {
    return request.then(result => {
      onProgress({ completed: ++completed, total })
      return result
    })
  }

  const modelStart = performance.now()
  const carRequest = loadGltf({ path: '/models/mesh/sm_car.gltf' }).then(car => {
    performance.measure('su7:model-load', { start: modelStart })
    return car
  })
  const [car, palm, sky, ...textures] = await Promise.all([
    track(carRequest),
    track(loadGltf({ path: '/models/palm_tree/scene.gltf', manager: palmManager })),
    track(loadSky('sunset')),
    ...textureNames.map(name => track(loadTexture({ path: asset(name) })))
  ] as const)
  for (const [index, texture] of textures.entries()) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.colorSpace = index === 1 ? THREE.NoColorSpace : THREE.SRGBColorSpace
  }
  return { car: car.scene, palm: palm.scene, sky, textures }
}

type CoastAssets = Awaited<ReturnType<typeof loadCoastAssets>>

export class CoastScene {
  readonly driving = new Driving(coastRoute)
  private readonly scene = new THREE.Scene()
  private readonly renderer: THREE.WebGLRenderer
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 4000)
  private readonly orbit: OrbitControls
  private readonly resize: ResizeObserver
  private readonly sun = new THREE.DirectionalLight()
  private readonly hemisphere = new THREE.HemisphereLight()
  private readonly streetlight = new THREE.PointLight(0xffbf83, 0, 32, 2)
  private readonly sunDirection = new THREE.Vector3()
  private readonly fog = new THREE.FogExp2(0xa99eae, 0.00114)
  private readonly ocean = createOcean()
  private readonly roadway: ReturnType<typeof createRoadway>
  private readonly scenery: ReturnType<typeof createScenery>
  private readonly player: Vehicle
  private readonly traffic: { car: Vehicle; distance: number; speed: number; lateral: number }[]
  private readonly skyTextures = new Map<TimeOfDay, Promise<THREE.Texture>>()
  private readonly carFrame = roadFrame()
  private readonly trafficFrame = roadFrame()
  private readonly cameraPosition = new THREE.Vector3()
  private readonly cameraTarget = new THREE.Vector3()
  private readonly followTarget = new THREE.Vector3()
  private readonly orbitAnchor = new THREE.Vector3()
  private readonly orbitDelta = new THREE.Vector3()
  private cameraMode: CameraMode = 'orbit'
  private timeOfDay: TimeOfDay = 'sunset'
  private timeRequest = 0
  private previousFrame = 0
  private reportElapsed = 0
  private animation = 0
  private disposed = false
  private lastLateral = DRIVING_LANE

  static async create(
    container: HTMLElement,
    onUpdate: (state: DriveSnapshot) => void,
    onProgress: (progress: SceneLoadingProgress) => void
  ): Promise<CoastScene> {
    const loadStart = performance.now()
    const assets = await loadCoastAssets(onProgress)
    // 先绘制「准备 3D 场景」，再开始同步的地形生成和首帧渲染。
    if (document.visibilityState === 'visible') {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    }
    const renderStart = performance.now()
    const scene = new CoastScene(container, assets, onUpdate)
    performance.measure('su7:scene-setup', { start: renderStart })
    performance.measure('su7:scene-ready', { start: loadStart })
    return scene
  }

  private constructor(
    container: HTMLElement,
    private readonly assets: CoastAssets,
    private readonly onUpdate: (state: DriveSnapshot) => void
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.setAttribute('aria-label', '海岸公路 3D 场景，环绕视角可拖动')
    container.append(this.renderer.domElement)

    const [asphalt, normal, grass, rock] = assets.textures
    const anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8)
    for (const texture of assets.textures) texture.anisotropy = anisotropy

    this.scene.fog = this.fog
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -47
    this.sun.shadow.camera.right = this.sun.shadow.camera.top = 47
    this.sun.shadow.camera.near = 0.5
    this.sun.shadow.camera.far = 220
    this.sun.shadow.normalBias = 0.032
    this.sun.shadow.bias = -0.00022

    const landscape = new Landscape(coastRoute, grass, rock)
    this.roadway = createRoadway(coastRoute, asphalt, normal, rock)
    this.scenery = createScenery(coastRoute, landscape, assets.palm, rock)
    this.player = new Vehicle(assets.car, DEFAULT_PAINT, true)
    this.traffic = [
      { car: new Vehicle(assets.car, '#c9cdd2', false), distance: 83, lateral: DRIVING_LANE, speed: 16.1 },
      { car: new Vehicle(assets.car, '#503c53', false), distance: 388, lateral: DRIVING_LANE, speed: 18.4 },
      { car: new Vehicle(assets.car, '#b6b5a0', false), distance: -92, lateral: -DRIVING_LANE, speed: -15.2 },
      { car: new Vehicle(assets.car, '#385975', false), distance: 267, lateral: -DRIVING_LANE, speed: -16.8 }
    ]
    this.scene.add(this.sun, this.sun.target, this.hemisphere, this.streetlight, landscape.object, this.ocean.mesh, this.ocean.skyDome,
      this.roadway.group, this.scenery.scenery, this.player.object, ...this.traffic.map(({ car }) => car.object))

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement)
    this.orbit.enablePan = false
    this.orbit.enableDamping = true
    this.orbit.minDistance = 4.7
    this.orbit.maxDistance = 22
    this.orbit.minPolarAngle = 0.5
    this.orbit.maxPolarAngle = Math.PI * 0.49

    this.skyTextures.set('sunset', Promise.resolve(assets.sky))
    this.applyLighting('sunset', assets.sky)
    this.resize = new ResizeObserver(() => this.fit(container))
    this.resize.observe(container)
    this.fit(container)
    this.repositionCamera()
    this.render(0)
    this.animation = requestAnimationFrame(this.animate)
  }

  setCamera(mode: CameraMode): void {
    this.cameraMode = mode
    this.repositionCamera()
  }

  reset(mode: DriveMode): void {
    this.driving.reset(mode)
    this.roadway.grid.visible = mode === 'lap'
    this.lastLateral = DRIVING_LANE
    this.repositionCamera()
    this.onUpdate({ ...this.driving.state })
  }

  setPaint(color: string): void {
    this.player.paint.color.set(color)
  }

  async setTimeOfDay(time: TimeOfDay): Promise<void> {
    const request = ++this.timeRequest
    let pending = this.skyTextures.get(time)
    if (!pending) {
      pending = loadSky(time)
      this.skyTextures.set(time, pending)
    }
    try {
      const sky = await pending
      if (!this.disposed && request === this.timeRequest) this.applyLighting(time, sky)
    } catch (error) {
      if (this.skyTextures.get(time) === pending) this.skyTextures.delete(time)
      throw error
    }
  }

  capture(callback: (image: Blob | null) => void): void {
    this.renderer.render(this.scene, this.camera)
    this.renderer.domElement.toBlob(callback, 'image/png')
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.animation)
    this.resize.disconnect()
    this.orbit.dispose()
    this.sun.shadow.dispose()
    disposeObjects(this.scene)
    for (const texture of this.assets.textures) texture.dispose()
    for (const pending of this.skyTextures.values()) void pending.then(texture => texture.dispose()).catch(() => {})
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private fit(container: HTMLElement): void {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 700 ? 1.4 : 1.65))
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    if (this.cameraMode === 'orbit') this.camera.fov = this.orbitFov()
    this.camera.updateProjectionMatrix()
  }

  private orbitFov(): number {
    const aspect = this.camera.aspect
    if (aspect < 1) return THREE.MathUtils.clamp(60 + (0.76 - aspect) * 23, 56, 66)
    return THREE.MathUtils.clamp(51 - (aspect - 0.8) * 13, 34, 54)
  }

  private applyLighting(time: TimeOfDay, sky: THREE.Texture): void {
    const profile = lighting[time]
    this.timeOfDay = time
    this.scene.environment = sky
    this.scene.environmentRotation.y = SKY_ROTATION
    this.scene.environmentIntensity = profile.environment
    this.renderer.toneMappingExposure = profile.exposure
    this.sunDirection.set(-0.73, profile.altitude, 0.68).normalize()
    this.sun.color.set(profile.sunColor)
    this.sun.intensity = profile.sun
    this.hemisphere.color.set(profile.skyColor)
    this.hemisphere.groundColor.set(profile.ground)
    this.hemisphere.intensity = profile.fill
    this.fog.color.set(profile.fog)
    this.ocean.uniforms.uSky.value = sky
    this.ocean.uniforms.uRotation.value = SKY_ROTATION
    this.ocean.uniforms.uSkyIntensity.value = profile.sky
    this.ocean.uniforms.uSkyTint.value.set(profile.skyTint)
    this.ocean.uniforms.uHorizonTint.value.set(profile.horizonTint)
    this.ocean.uniforms.uSun.value.copy(this.sunDirection)
    this.ocean.uniforms.uSunColor.value.copy(this.sun.color)
    this.ocean.uniforms.uGlint.value = profile.glint
    this.ocean.uniforms.uWater.value.set(profile.sea)
    this.roadway.lampMaterial.emissiveIntensity = time === 'night' ? 3.5 : 0
    this.scenery.lantern.emissiveIntensity = time === 'night' ? 5 : 0.4
    this.scenery.windows.emissiveIntensity = time === 'night' ? 1.9 : 0
  }

  private setDrivingCameraTargets(): void {
    const { point, forward, right } = this.carFrame
    if (this.cameraMode === 'hood') {
      this.cameraPosition.copy(point).addScaledVector(forward, 1.15)
      this.cameraPosition.y += 1.32
      this.cameraTarget.copy(point).addScaledVector(forward, 25)
      this.cameraTarget.y += 1.33
    } else {
      this.cameraPosition.copy(point).addScaledVector(forward, -8.7).addScaledVector(right, 0.22)
      this.cameraPosition.y += 3.54
      this.cameraTarget.copy(point).addScaledVector(forward, 10)
      this.cameraTarget.y += 1.03
    }
  }

  private repositionCamera(): void {
    const { distance, lateral } = this.driving.state
    const { point, forward, right } = coastRoute.at(distance, this.carFrame, lateral)
    this.orbit.enabled = this.cameraMode === 'orbit'
    if (this.cameraMode === 'orbit') {
      const portrait = this.camera.aspect < 1
      this.orbitAnchor.copy(point)
      this.camera.position.copy(point).addScaledVector(forward, portrait ? 8.6 : 7.2).addScaledVector(right, portrait ? 5.3 : 4.95)
      this.camera.position.y += portrait ? 3.15 : 2.88
      this.orbit.target.copy(point).addScaledVector(forward, portrait ? 0.28 : -1.6).addScaledVector(right, portrait ? -0.56 : 0.5)
      this.orbit.target.y += portrait ? 0.97 : 1.68
      this.camera.fov = this.orbitFov()
      this.orbit.update()
    } else {
      this.setDrivingCameraTargets()
      this.camera.position.copy(this.cameraPosition)
      this.followTarget.copy(this.cameraTarget)
      this.camera.fov = this.cameraMode === 'hood' ? 64 : 55
      this.camera.lookAt(this.followTarget)
    }
    this.camera.updateProjectionMatrix()
  }

  private readonly animate = (time: number): void => {
    const delta = this.previousFrame ? Math.min((time - this.previousFrame) / 1000, 0.11) : 0
    this.previousFrame = time
    this.render(delta)
    this.animation = requestAnimationFrame(this.animate)
  }

  private render(delta: number): void {
    const state = this.driving.state
    const dt = this.driving.paused ? 0 : delta
    let trafficAhead = Infinity
    let trafficBehind = Infinity
    for (const { distance, lateral } of this.traffic) {
      if (Math.abs(lateral - state.lateral) >= TRAFFIC_LATERAL_CLEARANCE) continue
      const gap = coastRoute.wrap(distance - state.distance)
      if (gap <= coastRoute.length / 2) trafficAhead = Math.min(trafficAhead, gap)
      else trafficBehind = Math.min(trafficBehind, coastRoute.length - gap)
    }
    this.driving.update(dt, trafficAhead, trafficBehind)
    coastRoute.at(state.distance, this.carFrame, state.lateral)
    const steering = dt > 0 ? (state.lateral - this.lastLateral) / dt : 0
    this.lastLateral = state.lateral
    this.player.pose(this.carFrame, state.speed, dt, state.speed < 0 ? -steering : steering)
    this.player.lights(this.timeOfDay === 'night', state.braking)

    for (const traffic of this.traffic) {
      const direction = Math.sign(traffic.speed)
      let gap = Math.abs(state.lateral - traffic.lateral) < TRAFFIC_LATERAL_CLEARANCE
        ? coastRoute.wrap((state.distance - traffic.distance) * direction) : Infinity
      for (const other of this.traffic) {
        if (other === traffic || Math.abs(other.lateral - traffic.lateral) >= TRAFFIC_LATERAL_CLEARANCE) continue
        gap = Math.min(gap, coastRoute.wrap((other.distance - traffic.distance) * direction))
      }
      const speed = Math.min(Math.abs(traffic.speed), Math.max(0, gap - TRAFFIC_CLEARANCE) * 0.9)
      traffic.distance = coastRoute.wrap(traffic.distance + speed * direction * dt)
      coastRoute.at(traffic.distance, this.trafficFrame, traffic.lateral)
      if (traffic.speed < 0) this.trafficFrame.forward.negate()
      traffic.car.pose(this.trafficFrame, speed, dt, 0)
    }

    if (this.cameraMode === 'orbit') {
      this.orbitDelta.subVectors(this.carFrame.point, this.orbitAnchor)
      this.camera.position.add(this.orbitDelta)
      this.orbit.target.add(this.orbitDelta)
      this.orbitAnchor.copy(this.carFrame.point)
      this.orbit.update()
    } else {
      this.setDrivingCameraTargets()
      const blend = 1 - Math.exp(-delta * (this.cameraMode === 'hood' ? 22 : 8.5))
      this.camera.position.lerp(this.cameraPosition, blend)
      this.followTarget.lerp(this.cameraTarget, blend)
      this.camera.lookAt(this.followTarget)
      const fov = (this.cameraMode === 'hood' ? 64 : 55) + Math.abs(state.speed) * 0.16
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, fov, 5, delta)
      this.camera.updateProjectionMatrix()
    }

    this.sun.target.position.copy(this.carFrame.point)
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDirection, 102)
    if (this.timeOfDay === 'night') {
      let nearest = Infinity
      for (const lamp of this.roadway.lampPositions) {
        const squared = lamp.distanceToSquared(this.carFrame.point)
        if (squared >= nearest) continue
        nearest = squared
        this.streetlight.position.copy(lamp)
      }
      this.streetlight.intensity = 165
    } else {
      this.streetlight.intensity = 0
    }
    this.ocean.uniforms.uTime.value += dt
    this.renderer.render(this.scene, this.camera)

    this.reportElapsed += delta
    if (this.reportElapsed > 0.08) {
      this.reportElapsed = 0
      this.onUpdate({ ...state })
    }
  }
}
