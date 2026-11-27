import * as THREE from 'three'
import { CoastRoute, ROAD_HALF_WIDTH, roadFrame } from './route'

function offsetGeometry(
  route: CoastRoute,
  start: number,
  end: number,
  profile: readonly [offset: number, height: number][],
  step = 1.5
): THREE.BufferGeometry {
  const samples = Math.max(1, Math.ceil((end - start) / step))
  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const frame = roadFrame()

  for (let row = 0; row <= samples; row++) {
    const distance = THREE.MathUtils.lerp(start, end, row / samples)
    route.at(distance, frame)
    for (let column = 0; column < profile.length; column++) {
      const [offset, height] = profile[column]
      vertices.push(frame.point.x + frame.right.x * offset, frame.point.y + height, frame.point.z + frame.right.z * offset)
      uvs.push((offset + ROAD_HALF_WIDTH) / 3.6, distance / 3.6)
      if (row < samples && column < profile.length - 1) {
        const a = row * profile.length + column
        indices.push(a, a + 1, a + profile.length, a + 1, a + profile.length + 1, a + profile.length)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function signMaterial(title: string, subtitle: string): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const context = canvas.getContext('2d')!
  context.fillStyle = '#25483e'
  context.fillRect(0, 0, 512, 256)
  context.strokeStyle = '#eee9cd'
  context.lineWidth = 7
  context.strokeRect(14, 14, 484, 228)
  context.font = 'bold 54px system-ui'
  context.textAlign = 'center'
  context.fillStyle = '#fff7dd'
  context.fillText(title, 256, 108)
  context.font = 'bold 25px system-ui'
  context.fillText(subtitle, 256, 165)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.78, side: THREE.DoubleSide })
}

export function createRoadway(route: CoastRoute, asphalt: THREE.Texture, normal: THREE.Texture, rock: THREE.Texture) {
  const group = new THREE.Group()
  const full = route.length
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const result = new THREE.Mesh(geometry, material)
    result.receiveShadow = true
    group.add(result)
    return result
  }
  const stripe = (offset: number, width: number, material: THREE.Material) => {
    return mesh(offsetGeometry(route, 0, full, [[offset - width / 2, 0.013], [offset + width / 2, 0.013]]), material)
  }

  const gravel = new THREE.MeshStandardMaterial({ map: rock, color: 0x938981, roughness: 1 })
  for (const side of [-1, 1]) {
    const edges = side < 0
      ? [[-7.75, -0.21], [-ROAD_HALF_WIDTH, -0.004]] : [[ROAD_HALF_WIDTH, -0.004], [7.75, -0.21]]
    mesh(offsetGeometry(route, 0, full, edges as [number, number][]), gravel)
  }

  const surface = new THREE.MeshStandardMaterial({
    color: 0xaaaeb1,
    roughness: 0.87,
    map: asphalt,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.59, 0.59)
  })
  mesh(offsetGeometry(route, 0, full, [[-ROAD_HALF_WIDTH, 0], [ROAD_HALF_WIDTH, 0]]), surface)
  const creamPaint = new THREE.MeshStandardMaterial({ color: 0xe8e2ca, roughness: 0.85, normalMap: normal })
  const yellowPaint = new THREE.MeshStandardMaterial({ color: 0xe9a643, roughness: 0.78, normalMap: normal })
  for (const side of [-1, 1]) {
    stripe(side * (ROAD_HALF_WIDTH - 0.32), 0.14, creamPaint)
    stripe(side * 0.135, 0.117, yellowPaint)
  }

  const frame = roadFrame()
  const dummy = new THREE.Object3D()
  const steel = new THREE.MeshStandardMaterial({ color: 0xabb2ad, roughness: 0.51, metalness: 0.53, side: THREE.DoubleSide })
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x64716b, roughness: 0.62, metalness: 0.40 })
  const railOffset = -7.35
  const coastStart = -251
  const coastEnd = 296

  const rail = mesh(offsetGeometry(route, coastStart, coastEnd, [
    [railOffset - 0.13, 0.71], [railOffset + 0.04, 0.72], [railOffset + 0.11, 0.67],
    [railOffset + 0.025, 0.56], [railOffset + 0.11, 0.45], [railOffset + 0.02, 0.40]
  ]), steel)
  rail.castShadow = true

  const postCount = Math.ceil((coastEnd - coastStart) / 3.9)
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 1.23, 0.19), steelDark, postCount)
  const reflectors = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 0.08, 0.105), creamPaint, Math.ceil(postCount / 3))
  for (let i = 0; i < postCount; i++) {
    const distance = coastStart + i * 3.9
    route.at(distance, frame, railOffset - 0.07)
    dummy.position.copy(frame.point)
    dummy.position.y += 0.055
    dummy.rotation.y = Math.atan2(frame.right.x, frame.right.z) - Math.PI / 2
    dummy.updateMatrix()
    posts.setMatrixAt(i, dummy.matrix)
    if (i % 3 === 0) {
      dummy.position.addScaledVector(frame.right, 0.23)
      dummy.position.y += 0.5
      dummy.updateMatrix()
      reflectors.setMatrixAt(i / 3, dummy.matrix)
    }
  }
  posts.castShadow = true
  group.add(posts, reflectors)

  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xeee4bc, emissive: 0xffbe6c, emissiveIntensity: 0 })
  const lampPole = new THREE.CylinderGeometry(0.047, 0.075, 6.2, 7)
  const lampArm = new THREE.BoxGeometry(0.09, 0.075, 1.5)
  const lampShell = new THREE.BoxGeometry(0.32, 0.13, 0.72)
  const lampGlass = new THREE.BoxGeometry(0.25, 0.036, 0.57)
  const lampPositions: THREE.Vector3[] = []
  for (const distance of [-192, -119, -57, -12, 38, 113, 189, 355, 532, 787, 986]) {
    route.at(distance, frame, 7.45)
    const light = new THREE.Group()
    light.position.copy(frame.point)
    light.position.y -= 0.24
    light.rotation.y = Math.atan2(-frame.right.x, -frame.right.z)
    const post = new THREE.Mesh(lampPole, steelDark)
    const arm = new THREE.Mesh(lampArm, steelDark)
    const shell = new THREE.Mesh(lampShell, steelDark)
    const glass = new THREE.Mesh(lampGlass, lampMaterial)
    post.position.y = 3.1
    arm.position.set(0, 6.02, 0.75)
    shell.position.set(0, 6.02, 1.56)
    glass.position.set(0, 5.95, 1.56)
    post.castShadow = true
    light.add(post, arm, shell, glass)
    group.add(light)
    lampPositions.push(light.localToWorld(new THREE.Vector3(0, 5.82, 1.56)))
  }

  route.at(-26, frame, -6.84)
  const sign = new THREE.Group()
  sign.position.copy(frame.point)
  sign.rotation.y = Math.atan2(frame.forward.x, frame.forward.z)
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 1.62), signMaterial('海岸公路', 'COAST LOOP'))
  panel.position.y = 2.14
  sign.add(panel)
  for (const x of [-1.1, 1.1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.085, 2.4, 0.09), steelDark)
    post.position.set(x, 1.05, -0.02)
    sign.add(post)
  }
  group.add(sign)

  const grid = new THREE.Group()
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 14; column++) {
      if ((row + column) % 2 !== 0) continue
      const x = -ROAD_HALF_WIDTH + 0.65 + column * 0.715
      grid.add(new THREE.Mesh(offsetGeometry(route, row * 0.53 - 0.66, row * 0.53 - 0.14, [[x, 0.021], [x + 0.70, 0.021]]), creamPaint))
    }
  }
  grid.visible = false
  group.add(grid)
  return { group, grid, lampMaterial, lampPositions }
}
