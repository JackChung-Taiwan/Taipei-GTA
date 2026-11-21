import { Descriptor, Schema } from "@typeonce/ritmo"
import type { Point } from "../game/world/iso.ts"
import { avenue, depth, dropoff, inWater, lots, onRoad, pickup, spawn, streets, taxiSpawn, width } from "./map.ts"

export const saveKey = "taipei-gta/phase-1"
export const reward = 250
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
export type Quality = "low" | "medium" | "high"
type Vehicle = Point & { angle: number; speed: number; steering: number }
export type Progress = "available" | "pickup" | "dropoff" | "complete"
export interface State {
  player: Point
  taxi: Vehicle
  driving: boolean
  face: number
  jump: number
  vertical: number
  progress: Progress
  coins: number
  completed: number
  time: number
  notice: string
  walking: boolean
  volume: number
  quality: Quality
  night: boolean
}

export const fresh = (): State => ({
  player: spawn, taxi: { ...taxiSpawn, speed: 0, steering: 0 }, driving: false, face: -Math.PI / 2,
  jump: 0, vertical: 0, progress: "available", coins: 0, completed: 0, time: 0,
  notice: "", walking: false, volume: 0.3, quality: "medium", night: false,
})

function allowed(p: Point, radius: number) {
  return p.x >= radius && p.y >= radius && p.x <= width - radius && p.y <= depth - radius
    && !inWater(p.x, p.y, radius)
    && !lots.some((l) => Math.abs(l.x - p.x) < l.w / 2 + radius && Math.abs(l.y - p.y) < l.d / 2 + radius)
}

function move(p: Point, dx: number, dy: number, canMove: (p: Point) => boolean) {
  const side = { x: p.x + dx, y: p.y }
  const x = canMove(side) ? side.x : p.x
  const next = { x, y: p.y + dy }
  return canMove(next) ? next : { x, y: p.y }
}

export function loadSave(storage: Pick<Storage, "getItem">): State {
  const initial = fresh()
  try {
    const data = JSON.parse(storage.getItem(saveKey) ?? "null")
    if (data?.version !== 1) return initial
    const point = (v: Point | undefined, fallback: Point, radius: number) =>
      v && Number.isFinite(v.x) && Number.isFinite(v.y) && allowed(v, radius) ? { x: v.x, y: v.y } : fallback
    const taxi = point(data.taxi, initial.taxi, 0.65)
    const angle = Number.isFinite(data.taxi?.angle) ? data.taxi.angle : initial.taxi.angle
    const progress = ["available", "pickup", "dropoff", "complete"].includes(data.progress) ? data.progress as Progress : initial.progress
    return {
      ...initial, player: point(data.player, spawn, 0.23), taxi: { ...taxi, angle, speed: 0, steering: 0 },
      driving: data.driving === true, progress, coins: Number.isSafeInteger(data.coins) && data.coins >= 0 ? data.coins : 0,
      completed: Number.isSafeInteger(data.completed) && data.completed >= 0 ? data.completed : 0,
      volume: Number.isFinite(data.volume) ? clamp(data.volume, 0, 1) : initial.volume,
      quality: ["low", "medium", "high"].includes(data.quality) ? data.quality : initial.quality, night: data.night === true,
    }
  } catch {
    return initial
  }
}

export function save(storage: Pick<Storage, "setItem">, state: State) {
  const { player, taxi, driving, progress, coins, completed, volume, quality, night } = state
  try {
    storage.setItem(saveKey, JSON.stringify({ version: 1, player, taxi, driving, progress, coins, completed, volume, quality, night }))
    return true
  } catch {
    return false
  }
}

export const focus = (s: State) => s.driving ? s.taxi : s.player
export const waypoint = (s: State) => s.progress === "available" ? s.taxi : s.progress === "pickup" ? pickup : s.progress === "dropoff" ? dropoff : null
export const redLight = (time: number, index: number) => (time + index * 3) % 20 >= 13

export interface Controls {
  dt: number
  forward: number
  steer: number
  run: boolean
  jump: boolean
  interact: boolean
  start: boolean
  heading: number
}

export function step(s: State, input: Controls): State {
  const { dt, steer, forward, jump, interact, heading } = input
  const next = { ...s, time: s.time + dt, walking: false }
  if (input.start && (s.progress === "available" || s.progress === "complete")) {
    next.progress = "pickup"
    next.notice = "已接單，前往接客點。"
  }
  if (interact) {
    if (!s.driving && distance(s.player, s.taxi) < 2.7) {
      next.driving = true
      next.jump = 0
      next.vertical = 0
      next.progress = next.progress === "available" ? "pickup" : next.progress
      next.notice = "已上車。W 加速，S 煞車及倒車。"
    } else if (s.driving && Math.abs(s.taxi.speed) < 1.3) {
      const { x, y, angle } = s.taxi
      for (const offset of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
        const exit = { x: x + Math.cos(angle + offset) * 1.25, y: y - Math.sin(angle + offset) * 1.25 }
        if (!allowed(exit, 0.23)) continue
        next.player = exit
        next.driving = false
        next.taxi = { ...s.taxi, speed: 0, steering: 0 }
        next.notice = "已下車。"
        break
      }
    } else if (s.driving) {
      next.notice = "停穩後即可下車。"
    }
  }
  if (next.driving) {
    const car = next.taxi
    const max = onRoad(car) ? 9.3 : 4.2
    const acceleration = forward < 0 && car.speed > 0 ? 13 : 6.1
    const friction = jump ? 7 : forward ? 0.25 : 2.65
    let speed = car.speed + forward * acceleration * dt
    speed = clamp(Math.sign(speed) * Math.max(0, Math.abs(speed) - friction * dt), -3.3, max)
    if (jump) speed *= Math.exp(-6 * dt)
    const steering = car.steering + (steer - car.steering) * (1 - Math.exp(-10 * dt))
    const angle = (car.angle - steering * Math.sign(speed) * Math.min(Math.abs(speed), 2.5) * 0.88 * dt) % (Math.PI * 2)
    const dx = Math.sin(angle) * speed * dt
    const dy = Math.cos(angle) * speed * dt
    const oldPoint = next.taxi
    const pos = move(car, dx, dy, (p) => allowed(p, 0.65))
    if (Math.hypot(pos.x - car.x - dx, pos.y - car.y - dy) > 0.01) {
      if (Math.abs(speed) > 2.2) next.notice = "注意車距，避開路邊障礙。"
      speed *= 0.4
    }
    next.taxi = { ...pos, angle, speed, steering }
    const crossed = streets.findIndex((x) => (oldPoint.x - x) * (pos.x - x) < 0)
    if (crossed >= 0 && Math.abs(pos.y - avenue) < 2.1 && redLight(next.time, crossed)) next.notice = "交通提醒：路口紅燈，請停車等候。"
    if (next.progress === "pickup" && distance(pos, pickup) < 1.65 && Math.abs(speed) < 1.4) {
      next.progress = "dropoff"
      next.notice = "乘客已上車，下一站台北 101。"
    } else if (next.progress === "dropoff" && distance(pos, dropoff) < 1.65 && Math.abs(speed) < 1.4) {
      next.progress = "complete"
      next.coins += reward
      next.completed++
      next.notice = "任務完成！獲得 250 金幣。"
    }
  } else {
    const length = Math.max(1, Math.hypot(steer, forward))
    const dx = (-forward * Math.sin(heading) + steer * Math.cos(heading)) / length
    const dy = (-forward * Math.cos(heading) - steer * Math.sin(heading)) / length
    const pace = input.run ? 5.1 : 3
    next.player = move(next.player, dx * pace * dt, dy * pace * dt,
      (p) => allowed(p, 0.23) && distance(p, next.taxi) > 0.73)
    next.walking = distance(s.player, next.player) > 0.0001
    if (dx || dy) next.face = Math.atan2(dx, dy)
    const up = jump && s.jump === 0 ? 24 : s.vertical
    next.jump = Math.max(0, s.jump + up * dt)
    next.vertical = next.jump > 0 ? up - 78 * dt : 0
  }
  return next
}

// An isolated Ritmo schedule keeps the Taipei driving loop independent of the mayor simulation.
const Session = Descriptor.Resource<State>()("Taipei/Session")
const Input = Descriptor.Service<() => Controls>()("Taipei/Input")
const City = Schema.bind(Schema.fragment({ resources: { Session } }), Schema.defineRoot("Taipei"))
const Drive = City.System("Taipei/Drive", {
  resources: { session: City.System.writeResource(Session) },
  services: { input: City.System.service(Input) },
}, ({ resources, services }) => resources.session.set(step(resources.session.get(), services.input())))
const schedule = City.Schedule(Drive)
const Read = City.Inspector("Taipei/Read", {
  resources: { session: City.System.readResource(Session) },
}, ({ resources }) => resources.session.get())

export function createSimulation(initial: State) {
  const input: Controls = { dt: 0, forward: 0, steer: 0, run: false, jump: false, interact: false, start: false, heading: 0 }
  const made = City.Runtime.make({ resources: { Session: initial }, services: City.Runtime.services(City.Runtime.service(Input, () => input)) })
  if (!made.ok) throw new Error("無法啟動城市系統")
  const runtime = made.value
  return {
    get state() { return runtime.inspect(Read) },
    tick(controls: Controls) {
      Object.assign(input, controls)
      const result = runtime.tick(schedule)
      if (!result.ok) throw new Error("城市模擬更新失敗")
      return runtime.inspect(Read)
    },
  }
}
