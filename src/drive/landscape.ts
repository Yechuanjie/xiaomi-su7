import * as THREE from 'three'
import { CoastRoute, ROAD_HALF_WIDTH, smoothstep } from './route'

export const SEA_LEVEL = -0.7
const HEADLAND_CENTER = 207
const HEADLAND_WIDTH = 48
const HEADLAND_REACH = 62

export function coastX(z: number): number {
  return -57 + 12 * Math.sin(z * 0.012) + 5 * Math.sin(z * 0.039)
    - HEADLAND_REACH * Math.exp(-(((z - HEADLAND_CENTER) / HEADLAND_WIDTH) ** 2))
}

function hill(x: number, z: number, cx: number, cz: number, width: number, depth: number): number {
  return Math.exp(-(((x - cx) / width) ** 2 + ((z - cz) / depth) ** 2))
}

function relief(x: number, z: number): number {
  return Math.sin(x * 0.072 + z * 0.048) * 1.16
    + Math.cos(z * 0.106 - x * 0.042) * 0.82
    + Math.sin(x * 0.183 - z * 0.137) * 0.42
    + Math.cos(x * 0.44 + z * 0.31) * 0.23
}

export class Landscape {
  readonly object = new THREE.Group()
  readonly groundMaterial: THREE.MeshStandardMaterial

  constructor(private readonly route: CoastRoute, grass: THREE.Texture, rock: THREE.Texture) {
    this.groundMaterial = new THREE.MeshStandardMaterial({ roughness: 0.95 })
    this.groundMaterial.onBeforeCompile = shader => {
      shader.uniforms.grassMap = { value: grass }
      shader.uniforms.rockMap = { value: rock }
      shader.vertexShader = `varying vec3 vLandPosition;\nvarying vec3 vLandNormal;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLandPosition = position;\nvLandNormal = normal;')
      shader.fragmentShader = `
        uniform sampler2D grassMap;
        uniform sampler2D rockMap;
        varying vec3 vLandPosition;
        varying vec3 vLandNormal;
        ${shader.fragmentShader}`.replace('#include <map_fragment>', `
          vec3 n = normalize(vLandNormal);
          vec3 w = pow(abs(n), vec3(5.0));
          w /= w.x + w.y + w.z;
          vec3 p = vLandPosition;
          vec3 grass = texture2D(grassMap, p.xz / 12.0).rgb;
          vec3 rock = texture2D(rockMap, p.zy / 11.0).rgb * w.x
            + texture2D(rockMap, p.xz / 11.0).rgb * w.y
            + texture2D(rockMap, p.xy / 11.0).rgb * w.z;
          float variation = sin(p.x * 0.037 + p.z * 0.048) * cos(p.z * 0.073 - p.x * 0.016);
          float grassCover = smoothstep(0.49, 0.91, n.y + variation * 0.22) * smoothstep(0.0, 4.5, p.y);
          vec3 sand = rock * vec3(1.32, 1.23, 1.02) + vec3(0.055, 0.033, 0.018);
          vec3 solid = mix(sand, rock, smoothstep(1.5, 6.5, p.y));
          diffuseColor.rgb *= mix(solid, grass * vec3(0.91, 0.97, 0.76), grassCover) * (0.94 + variation * 0.13);
        `)
    }

    const terrain = new THREE.PlaneGeometry(748, 1032, 264, 344)
    terrain.rotateX(-Math.PI / 2)
    terrain.translate(146, 0, -15)
    const positions = terrain.attributes.position
    for (let i = 0; i < positions.count; i++) positions.setY(i, this.height(positions.getX(i), positions.getZ(i)))
    terrain.computeVertexNormals()
    const mesh = new THREE.Mesh(terrain, this.groundMaterial)
    mesh.receiveShadow = true
    this.object.add(mesh)

    this.addHeadland(-414, 652, 509, 525, 105)
    this.addHeadland(-695, 916, 460, 571, 152)
    this.addHeadland(-1031, 1285, 695, 421, 185)
  }

  height(x: number, z: number): number {
    const coast = x - coastX(z)
    const hills = 6.2
      + 86 * hill(x, z, 123, -118, 107, 154)
      + 34 * hill(x, z, 72, -299, 75, 128)
      + 44 * hill(x, z, 359, -134, 139, 208)
      + 43 * hill(x, z, 99, 94, 130, 92)
      + relief(x, z) * 1.75
    const bluff = 3.25 + relief(x, z) * 0.52
      + 15 * hill(x, z, -80, 213, 49, 42) + 5 * hill(x, z, -21, 283, 61, 80)
    const inland = THREE.MathUtils.lerp(bluff, hills, smoothstep(-5, 84, x))
    const coastalShelf = smoothstep(-18, 21, coast) * (1 - smoothstep(364, 495, z - Math.max(x, 0) * 0.32))
    const natural = THREE.MathUtils.lerp(-9.5, inland, coastalShelf)
    const nearest = this.route.nearest(x, z)
    const shoulder = nearest.height - 0.19 - Math.max(0, nearest.distance - ROAD_HALF_WIDTH) * 0.15
    return THREE.MathUtils.lerp(shoulder, natural, smoothstep(ROAD_HALF_WIDTH + 2.4, 30, nearest.distance))
  }

  private addHeadland(x: number, z: number, width: number, depth: number, height: number): void {
    const geometry = new THREE.PlaneGeometry(width, depth, 78, 66)
    geometry.rotateX(-Math.PI / 2)
    geometry.translate(x, 0, z)
    const positions = geometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i) - x
      const pz = positions.getZ(i) - z
      const edge = Math.hypot(px / (width * 0.5), pz / (depth * 0.5))
      const shape = Math.max(0, 1 - edge * edge) ** 2.4
      const peak = 0.57 + Math.sin(px * 0.021 + pz * 0.016) * 0.13 + Math.cos(pz * 0.025) * 0.15
      positions.setY(i, -5 + shape * (height * peak + relief(px * 0.43, pz * 0.48) * 8.5))
    }
    geometry.computeVertexNormals()
    this.object.add(new THREE.Mesh(geometry, this.groundMaterial))
  }
}

export function createOcean() {
  const uniforms = {
    uTime: { value: 0 },
    uSky: { value: null as THREE.Texture | null },
    uRotation: { value: 0 },
    uSkyIntensity: { value: 1 },
    uSkyTint: { value: new THREE.Color(0xffffff) },
    uHorizonTint: { value: new THREE.Color(0xffffff) },
    uSun: { value: new THREE.Vector3(-0.73, 0.14, 0.66) },
    uSunColor: { value: new THREE.Color(0xffb27a) },
    uWater: { value: new THREE.Color(0x317678) },
    uFoam: { value: new THREE.Color(0xb1d9d0) },
    uGlint: { value: 0.9 }
  }
  const sampleSky = `
    uniform float uRotation, uSkyIntensity;
    uniform sampler2D uSky;
    uniform vec3 uSkyTint, uHorizonTint;
    vec3 sky(vec3 ray) {
      float x = atan(ray.z, ray.x) + uRotation;
      vec2 uv = vec2(fract(0.5 + x * 0.15915494), 0.5 + asin(clamp(ray.y, 0.015, 1.0)) * 0.31830989);
      vec3 tint = mix(uHorizonTint, uSkyTint, smoothstep(0.01, 0.37, ray.y));
      return texture2D(uSky, uv).rgb * uSkyIntensity * tint;
    }
  `

  const skyDome = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec3 vRay;
      void main() {
        vRay = position;
        vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
        gl_Position = clip.xyww;
      }
    `,
    fragmentShader: `
      ${sampleSky}
      varying vec3 vRay;
      void main() {
        gl_FragColor = vec4(sky(normalize(vRay)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }))
  skyDome.frustumCulled = false
  skyDome.renderOrder = -10

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }
    `,
    fragmentShader: `
      ${sampleSky}
      uniform float uTime, uGlint;
      uniform vec3 uSun, uSunColor, uWater, uFoam;
      varying vec3 vWorld;

      vec3 softenedReflection(vec3 color) {
        return color / (1.0 + dot(color, vec3(0.2126, 0.7152, 0.0722)) * 1.12);
      }

      void main() {
        vec2 p = vWorld.xz;
        vec3 view = normalize(cameraPosition - vWorld);
        float distanceToEye = length(cameraPosition - vWorld);
        vec2 swell = p + vec2(sin(dot(p, vec2(0.052, 0.081)) + uTime * 0.31), cos(dot(p, vec2(-0.063, 0.033)) + uTime * 0.27)) * 3.6;
        float a = dot(swell, vec2(0.24, 0.46)) + uTime * 0.71;
        float b = dot(swell, vec2(-1.46, 0.83)) + uTime * 1.48;
        float c = dot(swell, vec2(2.3, 2.99)) - uTime * 2.2;
        float d = dot(swell, vec2(5.21, -2.22)) + uTime * 2.6;
        float detail = 1.0 - smoothstep(22.0, 170.0, distanceToEye);
        float swellScale = 1.0 - smoothstep(170.0, 520.0, distanceToEye) * 0.88;
        vec3 normal = normalize(vec3(
          (cos(a) * 0.028 + cos(b) * 0.019 + cos(c) * 0.025 * detail) * swellScale,
          1.0,
          (sin(a) * 0.031 - cos(b) * 0.015 + cos(d) * 0.021 * detail) * swellScale));
        vec3 reflected = reflect(-view, normal);
        reflected.y = max(0.031, reflected.y);
        float fresnel = 0.09 + 0.59 * pow(1.0 - max(0.0, dot(normal, view)), 4.4);
        vec3 reflection = softenedReflection(sky(normalize(reflected))) * vec3(0.55, 0.69, 0.75);
        float spec = pow(max(0.0, dot(reflected, uSun)), 169.0) * uGlint;
        float ripple = 0.88 + (sin(a) * swellScale + (sin(b) + sin(c) * 0.43) * detail) * 0.078;
        vec3 color = mix(uWater * ripple, reflection, fresnel) + uSunColor * spec;
        float headland = (p.y - ${HEADLAND_CENTER.toFixed(1)}) / ${HEADLAND_WIDTH.toFixed(1)};
        float shore = -57.0 + 12.0 * sin(p.y * 0.012) + 5.0 * sin(p.y * 0.039)
          - ${HEADLAND_REACH.toFixed(1)} * exp(-headland * headland);
        float inshore = abs(p.x - shore - 3.0);
        float surge = sin((p.x - shore) * 1.31 - uTime * 1.7 + sin(p.y * 0.22) * 1.24);
        float foam = smoothstep(0.72, 0.98, surge) * (1.0 - smoothstep(0.0, 19.0, inshore));
        foam *= 1.0 - smoothstep(270.0, 446.0, abs(p.y));
        color = mix(color, uFoam, foam * 0.39);
        vec3 horizon = softenedReflection(sky(normalize(vec3(-view.x, 0.022, -view.z))));
        color = mix(color, horizon * 0.69, smoothstep(255.0, 2900.0, distanceToEye));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(7400, 7400).rotateX(-Math.PI / 2), material)
  mesh.position.y = SEA_LEVEL
  return { mesh, skyDome, uniforms }
}
