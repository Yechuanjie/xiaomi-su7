# SU7 Drive · 海岸公路

Vue 和 Three.js 驱动的浏览器驾驶体验。沿海岸环线经过岬角灯塔，可自由驾驶、巡航，或记录单圈成绩。

## 运行

```sh
yarn
yarn dev
```

打开终端显示的地址。当前配置的页面路径是 `/xiaomi-su7/`。

```sh
yarn build
yarn preview
```

## 操作

| 操作 | 键盘 |
| --- | --- |
| 加速 | `W` 或 `↑` |
| 刹车、刹停后倒车 | 长按 `S` 或 `↓` |
| 刹车 | `Space` |
| 左右转向 | `A`、`D` 或 `←`、`→` |
| 环绕、跟车、车头视角 | `C` |
| 暂停、继续 | `P` |
| 回到起点 | `R` |

触屏使用场景底部的方向和踏板按钮，长按 `↓` 可以刹停并倒车。使用油门或刹车可以接管巡航。单圈通过四个检查点后完成，最佳成绩保存在当前浏览器。拍照按钮保存纯场景 PNG。

## 实现

- 道路网格、车辆位置、检查点和小地图共享同一条按距离采样的环线。
- `src/drive` 负责场景、驾驶与车辆，Vue 负责控制台、仪表和触屏输入。
- 渲染需要 WebGL 2。初次载入日落天空，切换日间与夜间时再加载对应素材。

## 素材来源

- 天空摄影来自 Poly Haven。 [Kloppenheim 06 (Pure Sky)](https://polyhaven.com/a/kloppenheim_06_puresky)、[Kloppenheim 05 (Pure Sky)](https://polyhaven.com/a/kloppenheim_05_puresky)、[Qwantani Moonrise (Pure Sky)](https://polyhaven.com/a/qwantani_moonrise_puresky)
- 路面、草地和岩石贴图来自 Poly Haven，使用 CC0 许可。 [Worn Asphalt](https://polyhaven.com/a/worn_asphalt)、[Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock)、[Coast Land Rocks 01](https://polyhaven.com/a/coast_land_rocks_01)
- This work is based on "Realistic Palm Tree 4 Free" (https://sketchfab.com/3d-models/realistic-palm-tree-4-free-917c18d6b2d04d33950dea6e20bc074f) by Next Spring (https://sketchfab.com/NextSpring) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
