import { MathUtils } from 'three'
import { CoastRoute, DRIVING_LANE, ROAD_HALF_WIDTH, START_DISTANCE } from './route'

export const LAP_CHECKPOINTS = 4
export const MAX_SPEED_KPH = 185
const MAX_REVERSE_SPEED_KPH = 24
export const TRAFFIC_CLEARANCE = 5.6
export const TRAFFIC_LATERAL_CLEARANCE = 1.94
export type CameraMode = 'orbit' | 'chase' | 'hood' | 'cockpit'
export type DriveMode = 'free' | 'lap'
export type DriveControl = 'accelerate' | 'reverse' | 'brake' | 'left' | 'right'

export interface DriveSnapshot {
  distance: number
  lateral: number
  speed: number
  elapsed: number
  checkpoints: number
  lapComplete: boolean
  braking: boolean
}

export class Driving {
  readonly state: DriveSnapshot = {
    distance: START_DISTANCE,
    lateral: DRIVING_LANE,
    speed: 0,
    elapsed: 0,
    checkpoints: 0,
    lapComplete: false,
    braking: false
  }
  readonly input = new Set<DriveControl>()
  mode: DriveMode = 'free'
  cruising = false
  paused = false
  private steeringVelocity = 0

  constructor(private readonly route: CoastRoute) {}

  reset(mode: DriveMode = this.mode): void {
    this.mode = mode
    this.cruising = false
    this.paused = false
    this.steeringVelocity = 0
    this.input.clear()
    this.state.distance = START_DISTANCE
    this.state.lateral = DRIVING_LANE
    this.state.speed = 0
    this.state.elapsed = 0
    this.state.checkpoints = 0
    this.state.lapComplete = false
    this.state.braking = false
  }

  start(): void {
    this.paused = false
    if (this.mode === 'lap' && this.state.lapComplete) this.reset()
    if (this.state.speed >= 0 && this.state.speed < 0.1) this.state.speed = 8
  }

  setControl(control: DriveControl, pressed: boolean): void {
    if (pressed) {
      this.input.add(control)
      if (control === 'accelerate' || control === 'reverse' || control === 'brake') this.cruising = false
    } else {
      this.input.delete(control)
    }
  }

  update(delta: number, trafficAhead: number, trafficBehind: number): void {
    if (this.paused) return

    const state = this.state
    const steering = Number(this.input.has('right')) - Number(this.input.has('left'))
    const accelerate = this.input.has('accelerate')
    const reverse = this.input.has('reverse')
    const pedal = Number(accelerate) - Number(reverse)
    const previousSpeed = state.speed
    const direction = Math.sign(previousSpeed)
    const requestedDirection = this.cruising ? 1 : pedal || direction
    const brake = this.input.has('brake') || (accelerate && reverse) || requestedDirection * direction < 0
    const shoulder = Math.abs(state.lateral) > ROAD_HALF_WIDTH - 1.4

    if (this.cruising && steering === 0) {
      state.lateral = MathUtils.damp(state.lateral, DRIVING_LANE, 2, delta)
    }

    const speed = Math.abs(previousSpeed)
    if (brake) {
      state.speed = direction * Math.max(0, speed - 10.6 * delta)
    } else {
      const reversing = requestedDirection < 0
      const speedLimit = (reversing ? MAX_REVERSE_SPEED_KPH : MAX_SPEED_KPH) / 3.6
      const resistance = shoulder ? 3.7 : 0.35 + speed * 0.022
      let driveForce = 0
      if (this.cruising) {
        const cruiseSpeed = MathUtils.clamp((trafficAhead - TRAFFIC_CLEARANCE) * 0.8, 0, 21)
        driveForce = MathUtils.clamp((cruiseSpeed - speed) * 1.2, -6, 5)
      } else if (pedal !== 0) {
        const acceleration = reversing ? 5.2 : 6.9
        driveForce = acceleration * (1 - speed / (speedLimit + 12))
      }
      state.speed = requestedDirection * MathUtils.clamp(speed + (driveForce - resistance) * delta, 0, speedLimit)
    }
    state.braking = brake || (this.cruising && state.speed < previousSpeed - 0.04)

    const steeringSpeed = Math.min(5.5, Math.abs(state.speed) * 0.45 + (pedal !== 0 ? 1.5 : 0))
    this.steeringVelocity = MathUtils.damp(this.steeringVelocity, steering * steeringSpeed, 7, delta)
    state.lateral = MathUtils.clamp(state.lateral + this.steeringVelocity * delta, -ROAD_HALF_WIDTH + 1, ROAD_HALF_WIDTH - 1)

    const requestedStep = state.speed * delta
    const gap = requestedStep < 0 ? trafficBehind : trafficAhead
    const step = Math.sign(requestedStep) * Math.min(Math.abs(requestedStep), Math.max(0, gap - TRAFFIC_CLEARANCE))
    if (delta > 0 && step !== requestedStep) {
      state.speed = step / delta
      state.braking = true
    }

    // 计时使用沿环线的有向位移，渲染时再取模。
    const travelled = state.distance - START_DISTANCE
    const next = travelled + step
    if (this.mode === 'lap' && !state.lapComplete && (state.elapsed > 0 || step !== 0)) {
      const checkpoints = Math.min(LAP_CHECKPOINTS, Math.floor(next / this.route.length * LAP_CHECKPOINTS))
      state.checkpoints = Math.max(state.checkpoints, checkpoints)
      state.lapComplete = next >= this.route.length
      state.elapsed += state.lapComplete ? delta * (this.route.length - travelled) / step : delta
    }
    state.distance = START_DISTANCE + next
  }
}
