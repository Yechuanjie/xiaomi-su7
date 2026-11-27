import { BufferGeometry, Material, Mesh, Object3D, Texture } from 'three'

export function disposeObjects(root: Object3D): void {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()

  root.traverse(object => {
    if (!(object instanceof Mesh)) return
    geometries.add(object.geometry)
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of meshMaterials) materials.add(material)
  })
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof Texture) textures.add(value)
    }
    material.dispose()
  }
  for (const texture of textures) texture.dispose()
  for (const geometry of geometries) geometry.dispose()
}
