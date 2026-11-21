import assert from "node:assert/strict"
import { test } from "node:test"
import { avenue, dropoff, lots, pickup, river, taxiSpawn } from "../src/taipei/map.ts"
import { createSimulation, distance, fresh, loadSave, save, saveKey, step, type Controls, type State } from "../src/taipei/simulation.ts"

const idle: Controls = { dt: 1 / 60, forward: 0, steer: 0, run: false, jump: false, interact: false, start: false, heading: Math.PI / 2 }
const advance = (state: State, frames: number, input: Partial<Controls>) => {
  for (let i = 0; i < frames; i++) state = step(state, { ...idle, ...input })
  return state
}

test("Taipei Ritmo schedule makes the taxi mission repeatable and pays once per completion", () => {
  const game = createSimulation(fresh())
  game.tick({ ...idle, interact: true })
  assert.equal(game.state.driving, true)
  assert.equal(game.state.progress, "pickup")
  for (const dest of [pickup, dropoff]) {
    for (let i = 0; i < 250 && distance(game.state.taxi, dest) > 1.8; i++) game.tick({ ...idle, forward: 1 })
    for (let i = 0; i < 50; i++) game.tick({ ...idle, jump: true })
  }
  assert.equal(game.state.progress, "complete")
  assert.equal(game.state.coins, 250)
  assert.equal(game.state.completed, 1)
  game.tick({ ...idle, start: true })
  assert.equal(game.state.progress, "pickup")
  assert.equal(game.state.coins, 250)
  game.tick({ ...idle, interact: true })
  assert.equal(game.state.driving, false)
})

test("buildings and the river block movement, and the avenue crosses into Sanchong", () => {
  const lot = lots[0]!
  const walker = { ...fresh(), player: { x: lot.x - lot.w / 2 - 0.85, y: lot.y } }
  const stopped = advance(walker, 100, { forward: 1, heading: -Math.PI / 2 })
  assert.ok(stopped.player.x <= lot.x - lot.w / 2 - 0.23 + 1e-8)
  assert.ok(stopped.player.x > walker.player.x)
  const taxi = { ...taxiSpawn, x: 40, y: 12, angle: Math.PI / 2, speed: 0, steering: 0 }
  const car = { ...fresh(), taxi, driving: true }
  assert.ok(advance(car, 160, { forward: 1 }).taxi.x <= river.start - 0.65 + 1e-8)
  const bridge = { ...car, taxi: { ...taxi, y: avenue } }
  assert.ok(advance(bridge, 160, { forward: 1 }).taxi.x > river.end)
})

test("save restores mission, vehicle and settings, with a safe fallback for invalid coordinates", () => {
  const data = new Map<string, string>()
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) }
  const state = { ...fresh(), coins: 250, completed: 1, night: true, progress: "complete" as const, driving: true }
  assert.ok(save(storage, state))
  assert.deepEqual(loadSave(storage), state)
  data.set(saveKey, JSON.stringify({ version: 1, player: { x: -500, y: 2 }, taxi: { x: 44, y: 10 } }))
  assert.deepEqual(loadSave(storage), fresh())
  data.set(saveKey, "!!")
  assert.deepEqual(loadSave(storage), fresh())
})
