import * as THREE from 'three'
import { RoadFrame } from './route'

const WHEEL_RADIUS = 0.36

export class Vehicle {
  readonly object = new THREE.Group()
  readonly model: THREE.Object3D
  readonly paint: THREE.MeshPhysicalMaterial
  private readonly wheels: THREE.Object3D[]
  private readonly tailLights: THREE.MeshStandardMaterial[] = []
  private readonly frontLights: THREE.MeshStandardMaterial[] = []
  private readonly headlamps: THREE.SpotLight[] = []
  private wheelAngle = 0

  constructor(source: THREE.Object3D, color: string, player: boolean) {
    this.model = source.clone(true)
    this.paint = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.23,
      metalness: 0.46,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.15
    })
    this.object.rotation.order = 'YZX'
    this.object.add(this.model)
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(5.75, 2.65).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          vec2 edge = abs(vUv * 2.0 - 1.0);
          float falloff = 1.0 - smoothstep(0.4, 1.0, length(edge * edge));
          gl_FragColor = vec4(0.028, 0.026, 0.022, falloff * 0.56);
        }
      `
    }))
    this.object.add(contact)

    const partPosition = new THREE.Vector3()
    this.model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return
      node.castShadow = player && !node.name.startsWith('interior')
      node.receiveShadow = player && !node.name.startsWith('interior')
      const customize = (material: THREE.MeshStandardMaterial) => {
        if (material.name === 'Car_body') return this.paint
        if (player && material.name === 'Car_ight' && material.emissiveMap) {
          const light = material.clone()
          const lights = node.getWorldPosition(partPosition).x > 0 ? this.frontLights : this.tailLights
          lights.push(light)
          return light
        }
        return material
      }
      node.material = Array.isArray(node.material) ? node.material.map(customize) : customize(node.material)
      if (!player && node.name.startsWith('interior')) node.visible = false
    })
    this.wheels = this.model.getObjectByName('Wheel')?.children ?? []

    if (player) {
      for (const side of [-1, 1]) {
        const light = new THREE.SpotLight(0xfff0d4, 0, 70, 0.32, 0.78, 1.35)
        light.position.set(2.28, 0.71, side * 0.72)
        light.target.position.set(25, 0.05, side * 1.8)
        this.object.add(light, light.target)
        this.headlamps.push(light)
      }
    }
  }

  pose(frame: RoadFrame, speed: number, delta: number, drift: number): void {
    const { forward, point } = frame
    this.object.position.copy(point)
    this.object.position.y += 0.035
    this.object.rotation.set(
      -drift * 0.015,
      Math.atan2(-forward.z, forward.x) - drift * 0.065,
      Math.asin(forward.y)
    )
    this.wheelAngle = (this.wheelAngle - speed * delta / WHEEL_RADIUS) % (Math.PI * 2)
    for (const wheel of this.wheels) wheel.rotation.z = this.wheelAngle
  }

  lights(night: boolean, braking: boolean): void {
    for (const headlamp of this.headlamps) headlamp.intensity = night ? 160 : 0
    for (const light of this.frontLights) light.emissiveIntensity = night ? 7.5 : 1.25
    for (const light of this.tailLights) light.emissiveIntensity = braking ? 5 : night ? 2.6 : 1
  }
}
