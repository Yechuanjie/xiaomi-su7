import * as THREE from 'three'

export const resources = [
  {
    name: 'bgm',
    type: 'audio',
    path: '/models/audio/bgm.mp3'
  },
  {
    name: 'sm_car',
    type: 'gltfModel',
    path: '/models/mesh/sm_car.gltf'
  },
  {
    name: 'sm_startroom',
    type: 'gltfModel',
    path: '/models/mesh/sm_startroom.raw.gltf'
  },
  {
    name: 'sm_speedup',
    type: 'gltfModel',
    path: '/models/mesh/sm_speedup.gltf'
  },
  {
    name: 'ut_car_body_ao',
    type: 'texture',
    path: '/models/texture/t_car_body_AO.raw.jpg'
  },
  {
    name: 'ut_startroom_ao',
    type: 'texture',
    path: '/models/texture/t_startroom_ao.raw.jpg'
  },
  {
    name: 'ut_startroom_light',
    type: 'texture',
    path: '/models/texture/t_startroom_light.raw.jpg'
  },
  {
    name: 'ut_floor_normal',
    type: 'texture',
    path: '/models/texture/t_floor_normal.webp'
  },
  {
    name: 'ut_floor_roughness',
    type: 'texture',
    path: '/models/texture/t_floor_roughness.webp'
  },
  {
    name: 'ut_env_night',
    type: 'hdrTexture',
    path: '/models/texture/t_env_night.hdr'
  },
  {
    name: 'ut_env_light',
    type: 'hdrTexture',
    path: '/models/texture/t_env_light.hdr'
  }
]

export const loadResourceByName = async (name: string): Promise<THREE.Texture | undefined> => {
  const item = resources.find(resource => resource.name === name)
  // 加载item path对应的资源
  if (item) {
    const textureLoader = new THREE.TextureLoader()
    textureLoader.load(
      item.path,
      texture => {
        return Promise.resolve(texture)
      },
      () => {},
      () => {
        return Promise.reject('加载失败')
      }
    )
  } else {
    return Promise.reject('请检查资源是否存在')
  }
}
