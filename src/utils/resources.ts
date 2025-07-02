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
  },
  {
    name: 'decal',
    type: 'texture',
    path: '/models/texture/decal.png'
  },

  {
    name: 'highway_lanes_albedo',
    type: 'texture',
    path: '/models/texture/highway/highway-lanes_albedo.png'
  }
]

export const loadResourceAsnyc = async (name: string) => {
  const item = resources.find(resource => resource.name === name)
  if (!item) {
    return Promise.reject(new Error('Resource not found'))
  }
  const textureLoader = new THREE.TextureLoader()
  const url = new URL(item.path, import.meta.url).href
  return textureLoader.loadAsync(url)
}
