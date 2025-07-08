import { GUI } from 'lil-gui'

export interface CarControlParams {
  speed: number
}

export class CarControlGUI {
  private gui: GUI
  private params: CarControlParams
  private callbacks: Map<string, (value: any) => void>
  private speedController: any // 保存速度控制器的引用

  constructor() {
    this.gui = new GUI({ title: '控制面板' })
    this.callbacks = new Map()

    this.params = {
      speed: 60
    }

    this.initializeControls()
  }

  private initializeControls(): void {
    // 速度控制组
    const speedFolder = this.gui.addFolder('速度控制')

    this.speedController = speedFolder
      .add(this.params, 'speed', 0, 200, 1)
      .name('当前速度 (km/h)')
      .onChange((value: number) => {
        this.triggerCallback('speed', value)
      })

    // 快速操作
    const actionsFolder = this.gui.addFolder('快速操作')

    const actions = {
      启动车辆: () => this.startVehicle(),
      停止车辆: () => this.stopVehicle(),
      重置设置: () => this.resetSettings()
    }

    Object.entries(actions).forEach(([name]) => {
      actionsFolder.add(actions, name as keyof typeof actions)
    })

    // 默认展开主要控制面板
    speedFolder.open()
  }

  private startVehicle(): void {
    // 启动车辆逻辑：设置初始速度为60km/h
    this.params.speed = 60
    this.speedController.updateDisplay() // 刷新GUI显示
    this.triggerCallback('vehicleStart', true)
    this.triggerCallback('speed', 60)
  }

  private stopVehicle(): void {
    this.params.speed = 0
    this.speedController.updateDisplay() // 刷新GUI显示
    this.triggerCallback('vehicleStop', false)
    this.triggerCallback('speed', 0)
  }

  private resetSettings(): void {
    this.params.speed = 0
    this.speedController.updateDisplay() // 刷新GUI显示

    // 触发所有回调以更新外部系统
    Object.entries(this.params).forEach(([key, value]) => {
      this.triggerCallback(key, value)
    })
  }

  // 事件回调系统
  public onSpeedChange(callback: (speed: number) => void): void {
    this.callbacks.set('speed', callback)
  }

  public onVehicleStart(callback: (isStarted: boolean) => void): void {
    this.callbacks.set('vehicleStart', callback)
  }

  public onVehicleStop(callback: (isStopped: boolean) => void): void {
    this.callbacks.set('vehicleStop', callback)
  }

  private triggerCallback(event: string, value: any): void {
    const callback = this.callbacks.get(event)
    if (callback) {
      callback(value)
    }
  }

  // 外部更新参数的方法
  public setSpeed(speed: number): void {
    this.params.speed = Math.max(0, Math.min(speed, 200))
    this.speedController.updateDisplay() // 刷新GUI显示
  }

  public getParams(): CarControlParams {
    return { ...this.params }
  }

  public show(): void {
    this.gui.show()
  }

  public hide(): void {
    this.gui.hide()
  }

  public destroy(): void {
    this.gui.destroy()
  }
}

// 导出单例实例
export const carControlGUI = new CarControlGUI()
