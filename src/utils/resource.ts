import * as THREE from 'three'
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module'

export const getResourceUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return `${import.meta.env.BASE_URL}${normalizedPath}`
}

export const loadGltf = async (params: {
  path: string
  draco?: boolean
  manager?: THREE.LoadingManager
}): Promise<GLTF> => {
  const loader = new GLTFLoader(params.manager).setMeshoptDecoder(MeshoptDecoder)
  const draco = params.draco ? new DRACOLoader(params.manager).setDecoderPath(getResourceUrl('/jsm/draco/gltf/')) : null
  if (draco) loader.setDRACOLoader(draco)

  try {
    return await loader.loadAsync(getResourceUrl(params.path))
  } finally {
    draco?.dispose()
  }
}

export const loadTexture = ({ path }: { path: string }): Promise<THREE.Texture> =>
  new THREE.TextureLoader().loadAsync(getResourceUrl(path))
