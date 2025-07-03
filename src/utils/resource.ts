import * as THREE from 'three'
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module'

export const getResourceUrl = (path: string): string => {
  const urlInfo = new URL(import.meta.url)
  const origin = urlInfo.origin
  const pathname = import.meta.env.VITE_BASE_URL
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return `${origin}${pathname}${normalizedPath}`
}

export const loadGltf = (params: { path: string; draco?: boolean }): Promise<GLTF> => {
  return new Promise((resolve, reject) => {
    const { path, draco } = params
    const url = getResourceUrl(path)

    // 加载gltf模型
    const loader = new GLTFLoader()
    if (draco) {
      // 解压缩模型
      const dracoLoader = new DRACOLoader()
      const dracoUrl = getResourceUrl('/jsm/draco/gltf/')

      dracoLoader.setDecoderPath(dracoUrl)
      loader.setDRACOLoader(dracoLoader)
      // Meshopt压缩的glTF模型
      loader.setMeshoptDecoder(MeshoptDecoder)
    }

    loader.load(
      url,
      gltf => {
        console.info(gltf)
        resolve(gltf)
      },
      progress => {},
      error => {
        reject(error)
      }
    )
  })
}

export const loadTexture = (params: { path: string }): Promise<THREE.Texture> => {
  return new Promise((resolve, reject) => {
    const textureLoader = new THREE.TextureLoader()
    const url = getResourceUrl(params.path)

    textureLoader
      .loadAsync(url)
      .then(texture => {
        resolve(texture)
      })
      .catch(error => {
        console.error('Error loading texture:', error)
        reject(error)
      })
  })
}

// 方法1: 使用 Box3 计算包围盒
export const getModelSize = (model: THREE.Object3D) => {
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  return {
    width: size.x,
    height: size.y,
    depth: size.z
  }
}
