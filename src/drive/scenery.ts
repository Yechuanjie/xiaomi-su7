import * as THREE from 'three'
import { Landscape } from './landscape'
import { CoastRoute, roadFrame } from './route'

function seededRandom(seed: number): () => number {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function grassGeometry(random: () => number): THREE.BufferGeometry {
  const vertices: number[] = []
  const colors: number[] = []
  const root = new THREE.Color(0x3c4823)
  const apex = new THREE.Color(0x8b8d4e)
  for (let i = 0; i < 8; i++) {
    const angle = random() * Math.PI * 2
    const x = (random() - 0.5) * 0.43
    const z = (random() - 0.5) * 0.43
    const width = 0.025 + random() * 0.038
    const height = 0.16 + random() * 0.42
    const dx = Math.cos(angle)
    const dz = Math.sin(angle)
    vertices.push(x - dx * width, 0, z - dz * width, x + dx * width, 0, z + dz * width, x + dz * height * 0.42, height, z - dx * height * 0.42)
    colors.push(root.r, root.g, root.b, root.r, root.g, root.b, apex.r, apex.g, apex.b)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

export function createScenery(route: CoastRoute, landscape: Landscape, palm: THREE.Object3D, rockMap: THREE.Texture) {
  const scenery = new THREE.Group()
  const frame = roadFrame()
  const dummy = new THREE.Object3D()
  const random = seededRandom(3974)

  const palmLocations = [
    [-12, -11.2, 0.58], [-24, 9.7, 0.74], [-44, -14.5, 0.79], [-61, -19, 0.63], [-69, 10.9, 0.68],
    [-108, -12.6, 0.73], [-151, 12.2, 0.76], [-180, -13.5, 0.64], [-208, -19, 0.74], [-235, 10.4, 0.83],
    [17, 11.5, 0.71], [38, -11.5, 0.69], [61, -14.5, 0.76], [84, 12.7, 0.8], [122, -11, 0.69],
    [139, -15, 0.64], [165, 11.1, 0.83], [196, -18, 0.72], [229, 11.5, 0.71], [295, -10, 0.84],
    [339, 14, 0.84], [376, -14, 0.81], [441, 13, 0.76], [508, -11, 0.81], [682, 11, 0.76], [718, -12, 0.78],
    [773, -11, 0.62], [812, -13.5, 0.79], [869, 14, 0.72], [915, 12, 0.78], [954, -13, 0.82]
  ]
  const palmMatrices = palmLocations.map(([distance, offset, size]) => {
    route.at(distance, frame, offset)
    dummy.position.copy(frame.point)
    dummy.position.y = landscape.height(frame.point.x, frame.point.z) - 0.22
    dummy.rotation.set((random() - 0.5) * 0.13, random() * Math.PI * 2, (random() - 0.5) * 0.15)
    dummy.scale.setScalar(size)
    dummy.updateMatrix()
    return dummy.matrix.clone()
  })
  palm.updateMatrixWorld(true)
  palm.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return
    const instances = new THREE.InstancedMesh(node.geometry, node.material, palmMatrices.length)
    const matrix = new THREE.Matrix4()
    palmMatrices.forEach((position, i) => instances.setMatrixAt(i, matrix.multiplyMatrices(position, node.matrixWorld)))
    instances.castShadow = true
    instances.receiveShadow = true
    scenery.add(instances)
  })

  const grassCount = 5200
  const grass = new THREE.InstancedMesh(grassGeometry(random), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.98 }), grassCount)
  const stone = new THREE.DodecahedronGeometry(1, 1)
  const stonePositions = stone.attributes.position
  for (let i = 0; i < stonePositions.count; i++) {
    const x = stonePositions.getX(i)
    const y = stonePositions.getY(i)
    const z = stonePositions.getZ(i)
    const scale = 0.91 + Math.sin(x * 7 + y * 4 + z * 8) * 0.18 + Math.cos(y * 11 - z * 6) * 0.08
    stonePositions.setXYZ(i, x * scale, y * scale, z * scale)
  }
  stone.computeVertexNormals()
  const rocks = new THREE.InstancedMesh(stone, new THREE.MeshStandardMaterial({ color: 0xc6bdb0, map: rockMap, roughness: 0.93 }), 640)
  const tint = new THREE.Color()

  for (let i = 0; i < grassCount; i++) {
    const side = random() > 0.5 ? 1 : -1
    const offset = side * (8.1 + random() ** 2 * 37)
    route.at(random() * route.length, frame, offset)
    dummy.position.copy(frame.point)
    dummy.position.y = landscape.height(frame.point.x, frame.point.z) - 0.07
    dummy.rotation.set(0, random() * 6.283, 0)
    dummy.scale.setScalar(0.45 + random() ** 2 * 1.8)
    dummy.updateMatrix()
    grass.setMatrixAt(i, dummy.matrix)
    tint.setScalar(0.61 + random() * 0.52)
    grass.setColorAt(i, tint)
  }
  scenery.add(grass)

  for (let i = 0; i < rocks.count; i++) {
    const side = random() > 0.5 ? 1 : -1
    const offset = side * (8.2 + random() ** 1.8 * 94)
    route.at(random() * route.length, frame, offset)
    const size = 0.23 + random() ** 2 * (Math.abs(offset) > 13 ? 4.1 : 1.15)
    dummy.position.copy(frame.point)
    dummy.position.y = landscape.height(frame.point.x, frame.point.z) - size * 0.25
    dummy.rotation.set(random() * 4, random() * 8, random() * 4)
    dummy.scale.set(size * (0.72 + random() * 0.75), size * (0.63 + random() * 0.44), size)
    dummy.updateMatrix()
    rocks.setMatrixAt(i, dummy.matrix)
    tint.setScalar(0.69 + random() * 0.32)
    rocks.setColorAt(i, tint)
  }
  rocks.receiveShadow = true
  scenery.add(rocks)

  const lighthouse = new THREE.Group()
  const lighthouseX = -92
  const lighthouseZ = 214
  lighthouse.position.set(lighthouseX, landscape.height(lighthouseX, lighthouseZ) - 0.7, lighthouseZ)
  lighthouse.scale.setScalar(0.87)
  const plaster = new THREE.MeshStandardMaterial({ color: 0xf0e2c7, roughness: 0.85 })
  const blue = new THREE.MeshStandardMaterial({ color: 0x313c44, roughness: 0.65 })
  const lantern = new THREE.MeshStandardMaterial({ color: 0x8c765f, emissive: 0xffbc74, emissiveIntensity: 0.4, metalness: 0.28, roughness: 0.38 })
  const towerPart = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number) => {
    const part = new THREE.Mesh(geometry, material)
    part.position.y = y
    lighthouse.add(part)
  }
  towerPart(new THREE.CylinderGeometry(2.6, 3.55, 20.4, 22), plaster, 10.2)
  towerPart(new THREE.CylinderGeometry(3.67, 3.68, 0.53, 22), plaster, 0.4)
  towerPart(new THREE.CylinderGeometry(3.28, 3.22, 0.72, 22), blue, 20.8)
  towerPart(new THREE.TorusGeometry(3.09, 0.053, 7, 36).rotateX(Math.PI / 2), blue, 21.81)
  towerPart(new THREE.TorusGeometry(3.09, 0.049, 7, 36).rotateX(Math.PI / 2), blue, 21.37)
  towerPart(new THREE.CylinderGeometry(2.07, 2.07, 3.42, 12), lantern, 22.83)
  towerPart(new THREE.ConeGeometry(2.87, 2.5, 16), blue, 25.68)
  towerPart(new THREE.CylinderGeometry(0.11, 0.24, 1.9, 8), blue, 27.4)
  const window = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.17), blue)
  window.position.set(0.4, 14, -2.89)
  lighthouse.add(window)
  scenery.add(lighthouse)

  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x67473a, map: rockMap, roughness: 0.93 })
  const foundation = new THREE.MeshStandardMaterial({ color: 0x796c5d, roughness: 0.98 })
  const windows = new THREE.MeshStandardMaterial({ color: 0x352f2e, emissive: 0xffb76c, emissiveIntensity: 0, roughness: 0.34 })
  const buildingBase = new THREE.BoxGeometry(1, 1, 1)
  const roofShape = new THREE.CylinderGeometry(1, 1, 1, 3, 1)
  roofShape.rotateX(Math.PI * 0.5)
  const houseLocations = [[-69, 201], [-62, 209], [-74, 228], [-54, 238], [-51, 219], [-55, 194]]
  for (const [x, z] of houseLocations) {
    const width = 5.4 + random() * 4
    const height = 3.8 + random() * 2.7
    const depth = 6.5 + random() * 4.8
    const y = landscape.height(x, z) - 1.25
    const building = new THREE.Mesh(buildingBase, plaster)
    building.position.set(x, y + height * 0.5, z)
    building.scale.set(width, height, depth)
    const roof = new THREE.Mesh(roofShape, roofMaterial)
    roof.position.set(x, y + height + 0.75, z)
    roof.rotation.z = Math.PI
    roof.scale.set(width * 0.65, 1.75, depth * 1.1)
    const trim = new THREE.Mesh(buildingBase, foundation)
    trim.position.set(x, y + 0.2, z)
    trim.scale.set(width * 1.02, 0.88, depth * 1.02)
    scenery.add(building, roof, trim)
    for (const side of [-1, 1]) {
      const pane = new THREE.Mesh(buildingBase, windows)
      pane.position.set(x + side * width * 0.25, y + height * 0.61, z - depth * 0.502)
      pane.scale.set(0.78, 1, 0.12)
      const sill = new THREE.Mesh(buildingBase, foundation)
      sill.position.set(pane.position.x, pane.position.y - 0.51, pane.position.z - 0.08)
      sill.scale.set(0.95, 0.12, 0.27)
      scenery.add(pane, sill)
    }
    const door = new THREE.Mesh(buildingBase, blue)
    door.position.set(x, y + 1.03, z - depth * 0.504)
    door.scale.set(1.04, 2.08, 0.12)
    scenery.add(door)
  }
  return { scenery, lantern, windows }
}
