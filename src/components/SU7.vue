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
import * as dat from 'dat.gui'

const su7Ref = ref<HTMLDivElement>()

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
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 100)
  camera.position.set(-10, 0, 0)
  // camera.lookAt(0, 0, 0)

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
  const gridHelper = new THREE.GridHelper(10, 10) // 创建一个网格帮助器，参数为网格的宽度和高度
  gridHelper.material.transparent = true // 开启网格帮助器的透明度
  gridHelper.material.opacity = 0.5 // 设置网格帮助器的透明度
  scene.add(gridHelper)

  // 加载su7模型
  const loader = new GLTFLoader()
  // 解压loader
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/public/jsm/draco/gltf/')
  loader.setDRACOLoader(dracoLoader)

  loader.load(
    '/public/models/su7/source/SU7.glb',
    gltf => {
      const model = gltf.scene
      // model.position.set(1, 1, 1)
      // model.scale.set(0.5, 0.5, 0.5)
      scene.add(model)
      mixer = new THREE.AnimationMixer(model)
      animate()
    },
    undefined,
    e => {
      console.error(e)
    }
  )

  window.onresize = function () {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

  const animate = () => {
    requestAnimationFrame(animate)
    const delta = clock.getDelta()
    mixer.update(delta)
    controls.update()
    stats.update()
    renderer.render(scene, camera)
  }
}

onMounted(() => {
  init()
})
</script>
<style lang="scss" scoped></style>
