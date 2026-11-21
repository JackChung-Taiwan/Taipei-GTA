import { inside, type Point } from "../game/world/iso.ts"
import { GridBuilder, isRoad } from "../game/world/grid.ts"

export type Lot = Point & { w: number; d: number; h: number; color: number; kind?: "tower" | "station" | "redhouse" }
export const width = 60
export const depth = 47
export const avenue = 24
export const streets = [8, 22, 37, 52]
export const crossStreets = [7, avenue, 40]
export const river = { start: 42, end: 48 }
export const spawn = { x: 33.8, y: 25.6 }
export const taxiSpawn = { x: 32.3, y: 25.5, angle: -Math.PI / 2 }
export const pickup = { x: 26.4, y: 25.5 }
export const dropoff = { x: 13.2, y: 25.5 }
export const landmarks = [
  { name: "台北 101", x: 16.2, y: 16, height: 237, code: "信義區" },
  { name: "台北車站", x: 32, y: 17, height: 78, code: "中正區" },
  { name: "西門町", x: 30, y: 32, height: 93, code: "萬華區" },
  { name: "淡水河橋", x: 45, y: 24, height: 42, code: "河岸" },
  { name: "三重", x: 55, y: 18, height: 67, code: "新北市" },
]

export const lots: Lot[] = [
  { x: 16.2, y: 16, w: 4.3, d: 4.1, h: 304, color: 0x29968f, kind: "tower" },
  { x: 32, y: 17, w: 6.2, d: 3, h: 72, color: 0xf2c696, kind: "station" },
  { x: 30, y: 32, w: 4.6, d: 3.9, h: 82, color: 0xb55a48, kind: "redhouse" },
  { x: 11, y: 18, w: 2, d: 2.4, h: 54, color: 0xe3b97d },
  { x: 19, y: 17, w: 2.1, d: 3.8, h: 118, color: 0x83b8b8 },
  { x: 26, y: 17, w: 2, d: 2.6, h: 75, color: 0x9eb2de },
  { x: 4, y: 17, w: 3.6, d: 4, h: 76, color: 0x9baad4 },
  { x: 39.8, y: 17, w: 1.75, d: 4.2, h: 85, color: 0x72a9bf },
  { x: 55.8, y: 18, w: 3.1, d: 4.5, h: 65, color: 0xe9a381 },
  { x: 55.9, y: 31, w: 3.3, d: 5, h: 91, color: 0x82b4ae },
  { x: 39.9, y: 31, w: 1.9, d: 4.4, h: 48, color: 0xd2ac81 },
]
const colors = [0xe7ad86, 0x97b8c7, 0xe3cb90, 0xd997a5, 0xabc3a5, 0xa79bc9]
for (const [row, y] of [3, 11, 34, 44].entries()) {
  for (const [column, x] of [3.5, 11.4, 15.7, 19, 25.7, 34.1, 39.9, 55.6].entries()) {
    if (row === 2 && x === 39.9) continue
    const color = colors[(row * 3 + column) % colors.length]!
    lots.push({ x, y, w: 2.25, d: 2.7, h: 36 + ((column * 27 + row * 43) % 90), color })
  }
}

export function roadAt(x: number, y: number) {
  if (!inside(x, y) || x >= width || y >= depth) return false
  if (x >= river.start && x < river.end) return Math.abs(y - avenue) < 2.1
  return streets.some((street) => Math.abs(x - street) < 1.4)
    || crossStreets.some((street) => Math.abs(y - street) < (street === avenue ? 2.1 : 1.4))
}

export function inWater(x: number, y: number, radius: number) {
  return x + radius > river.start && x - radius < river.end && Math.abs(y - avenue) + radius > 2.1
}

export const roadGrid = new GridBuilder()
for (let y = 0; y < depth; y++) {
  for (let x = 0; x < width; x++) {
    if (roadAt(x + 0.5, y + 0.5)) roadGrid.claim({ x, y, size: 1 }, 1, "road")
  }
}
export const onRoad = (p: Point) => isRoad(roadGrid.value(), Math.floor(p.x), Math.floor(p.y))
