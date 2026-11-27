import { CatmullRomCurve3, Vector3 } from 'three'

export const ROAD_HALF_WIDTH = 5.6
export const DRIVING_LANE = 2.35
export const START_DISTANCE = 0

const checkpoints = [
  [-10, 5.8, 24], [-15, 7, -81], [-7, 13, -166], [24, 23, -231],
  [96, 33, -272], [168, 42, -252], [234, 45, -171], [253, 39, -78],
  [236, 28, 22], [214, 19, 115], [161, 13, 194], [77, 9, 224],
  [16, 7, 187], [-18, 6.1, 115]
]

export interface RoadFrame {
  point: Vector3
  forward: Vector3
  right: Vector3
}

export function roadFrame(): RoadFrame {
  return { point: new Vector3(), forward: new Vector3(), right: new Vector3() }
}

export function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

export class CoastRoute {
  readonly points: Vector3[]
  readonly length: number
  readonly step: number
  private readonly segments: { start: Vector3; dx: number; dz: number; dy: number; inverseLength: number }[]

  constructor() {
    const curve = new CatmullRomCurve3(checkpoints.map(([x, y, z]) => new Vector3(x, y, z)), true)
    curve.arcLengthDivisions = 3000
    this.length = curve.getLength()
    this.points = curve.getSpacedPoints(Math.ceil(this.length / 1.55))
    this.step = this.length / (this.points.length - 1)
    this.segments = this.points.slice(0, -1).map((start, i) => {
      const end = this.points[i + 1]
      const dx = end.x - start.x
      const dz = end.z - start.z
      return { start, dx, dz, dy: end.y - start.y, inverseLength: 1 / (dx * dx + dz * dz) }
    })
  }

  wrap(distance: number): number {
    return ((distance % this.length) + this.length) % this.length
  }

  at(distance: number, target: RoadFrame, lateral = 0): RoadFrame {
    const index = this.wrap(distance) / this.step
    const start = Math.min(this.segments.length - 1, Math.floor(index))
    const t = index - start
    const before = this.segments[(start + this.segments.length - 1) % this.segments.length]
    const current = this.segments[start]
    const next = this.segments[(start + 1) % this.segments.length]

    target.forward.set(
      current.dx + (next.dx * t + before.dx * (1 - t)),
      current.dy + (next.dy * t + before.dy * (1 - t)),
      current.dz + (next.dz * t + before.dz * (1 - t))
    ).normalize()
    target.right.set(-target.forward.z, 0, target.forward.x).normalize()
    target.point.copy(current.start).addScaledVector(target.right, lateral)
    target.point.x += current.dx * t
    target.point.y += current.dy * t
    target.point.z += current.dz * t
    return target
  }

  nearest(x: number, z: number): { distance: number; height: number } {
    let closestSquared = Infinity
    let height = 0
    for (const { start, dx, dz, dy, inverseLength } of this.segments) {
      const sx = x - start.x
      const sz = z - start.z
      const t = Math.max(0, Math.min(1, (sx * dx + sz * dz) * inverseLength))
      const deltaX = sx - dx * t
      const deltaZ = sz - dz * t
      const squared = deltaX * deltaX + deltaZ * deltaZ
      if (squared < closestSquared) {
        closestSquared = squared
        height = start.y + dy * t
      }
    }
    return { distance: Math.sqrt(closestSquared), height }
  }
}

export const coastRoute = new CoastRoute()
