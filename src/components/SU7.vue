<template>
  <div ref="su7Ref"></div>
</template>
<script setup lang="ts" name="">
import * as THREE from 'three'

import Stats from 'three/examples/jsm/libs/stats.module'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module'

const su7Ref = ref<HTMLDivElement>()
const emits = defineEmits<{
  (e: 'ready'): void
}>()

let animationFrame = 0
const setting = {
  speed: 0.09 // 轮子转动速度
}

const init = () => {
  const container = su7Ref.value!

  // 帧率显示
  const stats = new Stats()
  container.appendChild(stats.dom)

  // 渲染器 添加抗锯齿
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  container.appendChild(renderer.domElement)

  // 添加场景
  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xbfe3dd)
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.02).texture

  // 添加相机
  const camera = new THREE.PerspectiveCamera(33.4, window.innerWidth / window.innerHeight, 1, 100)
  camera.updateProjectionMatrix()
  camera.position.set(6, -2, -8)
  const lookAt = new THREE.Vector3(0, 0.8, 0)
  camera.lookAt(lookAt)

  // 添加控制器
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.update()
  controls.enablePan = false
  controls.enableDamping = true // 启用阻尼
  controls.minPolarAngle = 0.5 // 最小绕y轴角度
  controls.maxPolarAngle = 1.35 // 最大绕y轴角度
  controls.zoomSpeed = 1 // 缩放速度

  // 创建动态网格地面
  const { gridHelper, moveGrid } = createDynamicGrid()
  scene.add(gridHelper)

  // 加载su7模型
  const loader = new GLTFLoader()
  // 解压loader
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/jsm/draco/gltf/')
  loader.setDRACOLoader(dracoLoader)
  // Meshopt压缩的glTF模型
  loader.setMeshoptDecoder(MeshoptDecoder)

  loader.load(
    '/models/mesh/sm_car.gltf',
    async gltf => {
      const model = gltf.scene
      scene.add(model)
      initModel(model)
      setTimeout(() => {
        emits('ready')
        animate()
      }, 2000)
    },
    undefined,
    e => {
      console.error(e)
    }
  )

  // 模型遍历子对象
  const modelParts: THREE.Object3D<THREE.Object3DEventMap>[] = []
  // 轮子
  let wheelModel: THREE.Object3D<THREE.Object3DEventMap> = null!
  // 车身材质
  let bodyMat: THREE.MeshStandardMaterial | null = null

  // 模型初始化
  const initModel = async (model: THREE.Group<THREE.Object3DEventMap>) => {
    // 平铺模型
    model.traverse(obj => modelParts.push(obj))
    console.info('modelParts', modelParts)

    wheelModel = modelParts[35]

    const body = modelParts[2] as THREE.Mesh
    bodyMat = body.material as THREE.MeshStandardMaterial

    // 海湾蓝
    bodyMat.color = new THREE.Color('#26d6e9')

    // 雅灰
    // bodyMat.color = new THREE.Color('#888888')

    // @ts-ignore
    modelParts.forEach((item: THREE.Mesh) => {
      if (item.isMesh) {
        const mat = item.material as THREE.MeshStandardMaterial
        mat.aoMap = null
      }
    })
  }

  const rotateWheel = () => {
    wheelModel?.children.forEach(item => {
      item.rotateZ(-1 * setting.speed)
    })
  }

  window.onresize = function () {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

  const animate = () => {
    animationFrame = requestAnimationFrame(animate)
    controls.update()
    stats.update()

    rotateWheel()
    moveGrid()

    renderer.render(scene, camera)
  }
}

const createDynamicGrid = () => {
  const size = 20 // 网格大小
  const divisions = 20 // 分割数
  const gridHelper = new THREE.GridHelper(size, divisions)
  gridHelper.material.transparent = true
  gridHelper.material.opacity = 0.5

  // 动态移动网格
  const moveGrid = () => {
    gridHelper.position.x -= setting.speed // 根据速度移动网格
    if (gridHelper.position.x < -size / 10) {
      gridHelper.position.x = 0 // 重置位置
    }
  }

  return { gridHelper, moveGrid }
}

onMounted(() => {
  init()
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrame)
})
</script>
<style lang="scss" scoped></style>
