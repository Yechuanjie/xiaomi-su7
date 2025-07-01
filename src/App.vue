<template>
  <div id="sketch">
    <SU7 @ready="modelReady"></SU7>
  </div>
  <div class="loader-screen" ref="loaderScreen">
    <div class="loading-container">
      <div class="loading">
        <span style="--i: 0">X</span>
        <span style="--i: 1">I</span>
        <span style="--i: 2">A</span>
        <span style="--i: 3">O</span>
        <span style="--i: 4">M</span>
        <span style="--i: 5">I</span>
        <span>&nbsp;</span>
        <span style="--i: 6">S</span>
        <span style="--i: 6">U</span>
        <span style="--i: 6">7</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SU7 from '@/components/SU7.vue'

const loaderScreen = ref<HTMLDivElement>()
const modelReady = () => {
  loaderScreen.value!.classList.add('hideLoading')
}
</script>

<style scoped lang="scss">
body {
  margin: 0;
}

#app {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

#sketch {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.loader-screen {
  position: fixed;
  z-index: 5;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transition: 0.3s;
  background: black;
  &.hideLoading {
    pointer-events: none;
    animation: hide 0.5s linear forwards;
    @keyframes hide {
      0% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }
  }
}

.loading-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.loading {
  color: white;
  font-size: 1.875rem;
  letter-spacing: 0.1em;
}

.loading span {
  animation: blur 1.5s calc(var(--i) / 5 * 1s) alternate infinite;
}

@keyframes blur {
  to {
    filter: blur(2px);
  }
}
</style>
