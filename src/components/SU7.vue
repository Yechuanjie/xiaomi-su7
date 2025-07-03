<template>
  <div ref="su7Ref"></div>
</template>
<script setup lang="ts" name="">
import * as THREE from 'three'

import Stats from 'three/examples/jsm/libs/stats.module'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment'

import { getModelSize, loadGltf, loadTexture } from '@/utils/resource'

const su7Ref = ref<HTMLDivElement>()
const emits = defineEmits<{
  (e: 'ready'): void
}>()

let animationFrame = 0
const setting = {
  // 速度 km/h
  speed: 60,
  // 速度换算系数 转换为米/秒
  get speedRatio() {
    return (this.speed / 3600) * 1000
  },
  // 轮胎半径(米)
  wheelRadius: 0.3,
  // 纹理重复
  textureRepeatLength: 8,
  // 假设60fps, 每帧时间约0.016秒
  fpsTime: 0.016
}

const init = async () => {
  const { scene, stats, controls, renderer, camera } = initScene()

  // 加载su7模型
  const { su7Model, rotateWheel } = await initSu7Model(scene)

  // 创建马路
  const { road, moveRoad } = await initRoad(scene)

  // 创建树
  const { treeGroup, moveTreeGroup } = await initTree(scene, road)

  emits('ready')

  const animate = () => {
    animationFrame = requestAnimationFrame(animate)
    controls.update()
    stats.update()

    rotateWheel()
    moveRoad()
    moveTreeGroup()

    renderer.render(scene, camera)
  }

  animate()

  window.onresize = function () {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
}

const initScene = () => {
  const container = su7Ref.value!

  // 帧率显示
  const stats = new Stats()
  container.appendChild(stats.dom)

  // 渲染器 添加抗锯齿
  const renderer = new THREE.WebGLRenderer({
    antialias: true
    // powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  // // 优化阴影
  // renderer.shadowMap.enabled = true
  // renderer.shadowMap.type = THREE.PCFSoftShadowMap
  // renderer.shadowMap.autoUpdate = false // 仅在需要时更新阴影

  container.appendChild(renderer.domElement)

  // 添加场景
  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xeaeaea)
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.02).texture

  // 添加相机
  const camera = new THREE.PerspectiveCamera(33.4, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.updateProjectionMatrix()
  camera.position.set(6, 9, -16)
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

  return { scene, camera, renderer, controls, stats, pmremGenerator }
}

const initSu7Model = async (scene: THREE.Scene) => {
  const su7Gltf = await loadGltf({
    path: '/models/mesh/sm_car.gltf',
    draco: true
  })

  const su7Model = su7Gltf.scene

  // 模型遍历子对象
  const modelParts: THREE.Object3D<THREE.Object3DEventMap>[] = []
  // 轮子
  let wheelModel: THREE.Object3D<THREE.Object3DEventMap> = null!
  // 车身材质
  let bodyMat: THREE.MeshStandardMaterial | null = null

  // 平铺模型
  su7Model.traverse(obj => modelParts.push(obj))

  wheelModel = modelParts[35]

  const body = modelParts[2] as THREE.Mesh
  bodyMat = body.material as THREE.MeshStandardMaterial

  // 海湾蓝
  // bodyMat.color = new THREE.Color('#26d6e9')

  // 璀璨洋红
  // bodyMat.color = new THREE.Color('#A62058')

  // 雅灰
  // bodyMat.color = new THREE.Color('#888888')

  // @ts-ignore
  modelParts.forEach((item: THREE.Mesh) => {
    if (item.isMesh) {
      const mat = item.material as THREE.MeshStandardMaterial
      mat.aoMap = null
    }
  })

  const rotateWheel = () => {
    //  v = ωr，ω = v/r
    // 角速度 = 线速度/半径
    const angularVelocity = setting.speedRatio / setting.wheelRadius
    wheelModel?.children.forEach(item => {
      // 每帧旋转角度 = 角速度 * 帧时间
      item.rotateZ(-angularVelocity * setting.fpsTime)
    })
  }

  scene.add(su7Model)

  return { su7Model, rotateWheel }
}

const initTree = async (
  scene: THREE.Scene,
  road: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial, THREE.Object3DEventMap>
) => {
  const treeGltf = await loadGltf({
    path: '/models/palm_tree/scene.gltf',
    draco: true
  })

  const treeModel = treeGltf.scene
  treeModel.scale.set(0.4, 0.4, 0.4)

  // 创建一个组来容纳所有树
  const treeGroup = new THREE.Group()

  const roadWidth = road.geometry.parameters.width
  const roadLength = road.geometry.parameters.height

  const treeCount = 8
  const treeSpacing = roadLength / treeCount

  for (let i = 0; i < treeCount; i++) {
    // 左侧树
    const leftTree = treeModel.clone()
    leftTree.position.set(-roadWidth / 2 - 0.5, 0, -roadLength / 2 + i * treeSpacing)
    treeGroup.add(leftTree)

    // 右侧树
    const rightTree = treeModel.clone()
    rightTree.position.set(roadWidth / 2 + 0.5, 0, -roadLength / 2 + i * treeSpacing)
    treeGroup.add(rightTree)
  }

  // 旋转整个树组,使其与道路方向一致
  treeGroup.rotation.y = Math.PI / 2

  // 将树组添加到场景
  scene.add(treeGroup)

  const moveTreeGroup = () => {
    const offset = setting.speedRatio * setting.fpsTime
    treeGroup.position.x -= offset

    // 计算马路的一半长度
    const halfRoadLength = roadLength / 2

    // 当树组移动超过一定距离时，提前重置位置
    if (treeGroup.position.x < -halfRoadLength / 2) {
      // 重置位置时，设置到略微超前的位置，避免突然出现
      treeGroup.position.x += halfRoadLength
    }

    // 为了确保树不会超出马路范围，添加边界检查
    if (treeGroup.position.x > halfRoadLength) {
      treeGroup.position.x = halfRoadLength
    }
  }

  return { treeGroup, moveTreeGroup }
}

// 创建马路
const initRoad = async (scene: THREE.Scene) => {
  // 创建道路平面几何体 - 调整大小以适应场景
  const roadGeometry = new THREE.PlaneGeometry(10, 10 * setting.textureRepeatLength)

  // 加载道路纹理
  const roadTexture = await loadTexture({ path: '/models/highway/highway-lanes_albedo.png' })

  // 设置纹理重复
  roadTexture.wrapS = THREE.RepeatWrapping
  roadTexture.wrapT = THREE.RepeatWrapping
  roadTexture.repeat.set(1, setting.textureRepeatLength) // 设置纹理重复次数

  const roadMaterial = new THREE.MeshStandardMaterial({
    map: roadTexture
  })

  const road = new THREE.Mesh(roadGeometry, roadMaterial)
  road.rotation.x = -Math.PI / 2 // 使平面水平
  road.rotation.z = -Math.PI / 2 // 使平面垂直于z轴
  road.position.y = -0.1 // 略微下沉避免z-fighting

  const moveRoad = () => {
    const offset = (setting.speedRatio * setting.fpsTime) / setting.textureRepeatLength
    roadTexture.offset.y += offset
    if (roadTexture.offset.y > 1) {
      roadTexture.offset.y = 0
    }
  }

  scene.add(road)

  return { road, moveRoad }
}

onMounted(() => {
  init()
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrame)
})
</script>
<style lang="scss" scoped></style>
