<template>
  <div>
    <div ref="su7Ref"></div>
  </div>
</template>
<script setup lang="ts" name="">
import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module'
import * as dat from 'dat.gui'
import { loadResourceByName } from '@/utils/resources'

const su7Ref = ref<HTMLDivElement>()
let animationFrame = 0
const init = () => {
  let mixer: THREE.AnimationMixer

  const clock = new THREE.Clock()
  const container = su7Ref.value!
  const stats = new Stats()
  container.appendChild(stats.dom)

  // 渲染器 添加抗锯齿
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setClearColor('#000') // 设置画面颜色
  renderer.setSize(window.innerWidth, window.innerHeight)
  container.appendChild(renderer.domElement)

  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  // 添加场景
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xbfe3dd)
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.04).texture
  // 添加相机
  const camera = new THREE.PerspectiveCamera(33.4, window.innerWidth / window.innerHeight, 1, 100)
  camera.updateProjectionMatrix()
  camera.position.set(0, 0.8, -11)
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

  // const gui = new dat.GUI();
  // gui.add(controls,'rotateSpeed',0,0.05)
  // gui.add(controls,'zoomSpeed',0,0.05)

  // 添加网格地面
  const gridHelper = new THREE.GridHelper(20, 20) // 创建一个网格帮助器，参数为网格的宽度和高度
  gridHelper.material.transparent = true // 开启网格帮助器的透明度
  gridHelper.material.opacity = 0.5 // 设置网格帮助器的透明度
  scene.add(gridHelper)

  // 加载su7模型
  const loader = new GLTFLoader()
  // 解压loader
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/public/jsm/draco/gltf/')
  loader.setDRACOLoader(dracoLoader)
  // Meshopt压缩的glTF模型
  loader.setMeshoptDecoder(MeshoptDecoder)

  loader.load(
    '/public/models/mesh/sm_car.gltf',
    gltf => {
      const model = gltf.scene
      initModel(model)
      scene.add(model)
      mixer = new THREE.AnimationMixer(model)
      animate()
    },
    undefined,
    e => {
      console.error(e)
    }
  )

  let wheelModel: THREE.Object3D<THREE.Object3DEventMap> = null!

  const initModel = async (model: THREE.Group<THREE.Object3DEventMap>) => {
    console.info('model', model)
    const modelParts: THREE.Object3D<THREE.Object3DEventMap>[] = []
    model.traverse(obj => {
      modelParts.push(obj)
    })

    console.info('modelParts', modelParts)

    wheelModel = modelParts[35]

    const aoMap = await loadResourceByName('ut_car_body_ao')
    // const body = modelParts[2] as THREE.Mesh
    // const bodyMat = body.material as THREE.MeshStandardMaterial
    // bodyMat.color = new THREE.Color('#26d6e9')
    // @ts-ignore
    modelParts.forEach((item: THREE.Mesh) => {
      if (item.isMesh) {
        const mat = item.material as THREE.MeshStandardMaterial
        aoMap && (mat.aoMap = aoMap)
      }
    })
  }

  const rotateWheel = () => {
    wheelModel?.children.forEach(item => {
      item.rotateZ(-1 * 0.03)
    })
    //控制网格的z轴移动
    gridHelper.position.x += -1 * 0.03
  }

  window.onresize = function () {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

  const animate = () => {
    animationFrame = requestAnimationFrame(animate)
    const delta = clock.getDelta()
    mixer.update(delta)
    controls.update()
    stats.update()

    rotateWheel()

    renderer.render(scene, camera)
  }
}

onMounted(() => {
  init()
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrame)
})
</script>
<style lang="scss" scoped></style>
