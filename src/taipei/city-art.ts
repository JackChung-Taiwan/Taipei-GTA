import { Drawing, mix, type InkAsset, type Vertex } from "../render/pixi3d/assets/primitives.ts"
import { makePerson } from "../render/pixi3d/assets/people.ts"
import { makeTree } from "../render/pixi3d/assets/land.ts"
import { groundAsset } from "../render/pixi3d/models.ts"
import { key } from "../game/world/grid.ts"
import { avenue, crossStreets, depth, lots, river, streets, width, type Lot } from "./map.ts"

const ink = 0x354d48
const glass = 0x45767e
const shade = (color: number, amount = 0.19) => mix(color, ink, amount)
function block(d: Drawing, x: number, y: number, w: number, h: number, z: number, rise: number, color: number, edge = 0.9) {
  d.box(x, y, w / 2, h / 2, z, rise, mix(color, 0xfff5ce, 0.18), color, shade(color), edge, ink)
}

function slab(d: Drawing, x: number, y: number, w: number, h: number, z: number, c: number) {
  d.face([[x-w/2,y-h/2,z],[x+w/2,y-h/2,z],[x+w/2,y+h/2,z],[x-w/2,y+h/2,z]], c, 0)
}

function paste(d: Drawing, asset: InkAsset, x: number, y: number, size = 1, tint?: number) {
  const at = ([u, v, z]: Vertex): Vertex => [x + u * size, y + v * size, z * size]
  for (const face of asset.faces) d.face(face.points.map(at), tint === undefined ? face.color : mix(face.color, tint, 0.56), 0)
  for (const line of asset.strokes) d.line(line.points.map(at), line.width * size, line.color, line.opacity)
}

function windows(d: Drawing, lot: Lot, z: number, top: number, color: number) {
  const { x, y, w, d: span } = lot
  for (let floor = z; floor + 7 < top; floor += 15) {
    for (const side of [-1, 1]) {
      const front = y + side * (span / 2 + 0.007)
      const flank = x + side * (w / 2 + 0.007)
      for (let u = -w / 2 + 0.24; u + 0.27 < w / 2; u += 0.47) {
        d.face([[x+u,front,floor],[x+u+0.26,front,floor],[x+u+0.26,front,floor+7],[x+u,front,floor+7]], color, 0)
      }
      for (let v = -span / 2 + 0.23; v + 0.22 < span / 2; v += 0.45) {
        d.face([[flank,y+v,floor],[flank,y+v+0.24,floor],[flank,y+v+0.24,floor+7],[flank,y+v,floor+7]], shade(color), 0)
      }
    }
  }
}

function building(d: Drawing, lot: Lot, index: number) {
  const { x, y, w, d: span, h, color, kind } = lot
  slab(d, x + 0.56, y + 0.2, w + 0.55, span + 0.27, 0.64, 0x9cad92)
  block(d, x, y, w + 0.22, span + 0.22, 1, 3, 0xe0d9b8, 0)
  if (kind === "tower") {
    const firstFace = d.asset.faces.length
    const firstStroke = d.asset.strokes.length
    block(d, x, y, w, span, 4, 38, 0x7ba8a4)
    block(d, x, y, 2.2, 2.2, 42, 63, 0x419791)
    windows(d, { ...lot, w: 2.2, d: 2.2 }, 50, 103, 0x6eb7b9)
    for (let i = 0; i < 8; i++) {
      const z = 105 + 35 * i
      const wide = 2.85 - i * 0.106
      const narrow = wide * 0.77
      const bottom: Vertex[] = [[x-narrow/2,y-narrow/2,z],[x+narrow/2,y-narrow/2,z],[x+narrow/2,y+narrow/2,z],[x-narrow/2,y+narrow/2,z]]
      const top: Vertex[] = [[x-wide/2,y-wide/2,z+30],[x+wide/2,y-wide/2,z+30],[x+wide/2,y+wide/2,z+30],[x-wide/2,y+wide/2,z+30]]
      for (let side = 0; side < 4; side++) {
        const n = (side + 1) % 4
        d.face([bottom[side]!, bottom[n]!, top[n]!, top[side]!], side % 2 ? 0x258782 : 0x58b3a9, 1, ink)
        for (let j = 1; j < 9; j++) {
          const t = j / 9
          const a = bottom[side]!, b = bottom[n]!, c = top[side]!, e = top[n]!
          d.line([[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,z],[c[0]+(e[0]-c[0])*t,c[1]+(e[1]-c[1])*t,z+30]], 0.57, 0x215d62)
        }
      }
      block(d, x, y, wide * 1.04, wide * 1.04, z + 29, 5, 0x92c7ac)
    }
    block(d, x, y, 1.07, 1.07, 383, 24, 0x327a79)
    block(d, x, y, 0.55, 0.55, 407, 13, 0x7db2aa)
    block(d, x, y, 0.12, 0.12, 420, 20, 0x42666b, 0.35)
    const scaleHeight = ([u,v,z]: Vertex): Vertex => [u,v,z*0.69]
    for (const face of d.asset.faces.slice(firstFace)) face.points = face.points.map(scaleHeight)
    for (const stroke of d.asset.strokes.slice(firstStroke)) stroke.points = stroke.points.map(scaleHeight)
    return
  }
  block(d, x,y,w,span,4,h-4,color)
  windows(d, lot, 15, h, kind === "redhouse" ? 0x644e48 : glass)
  if (kind === "station") {
    block(d, x,y,w+0.4,span+0.3,25,5,0xeed0a1)
    block(d, x,y,w+0.22,span+0.19,h,5,0x814d52)
    for (let i = 0; i < 4; i++) block(d,x,y,(w-i*0.45)*0.78,span-i*0.54,h+5+i*3,3,0x91595a,0.55)
    for (let i = -2; i <= 2; i++) block(d,x+i*0.91,y+span/2+0.05,0.13,0.34,4,24,0xede2c4,0)
    return
  }
  if (kind === "redhouse") {
    block(d,x,y,w+0.24,span+0.18,h-4,5,0xf0c688)
    for (let i = 0; i < 5; i++) block(d,x,y,w-i*0.79,span-i*0.65,h+i*3,3,0x655565,0.65)
    block(d,x,y+span/2,1.15,0.65,4,21,0xf0b193)
    return
  }
  block(d,x,y,w+0.16,span+0.16,h-2,4,shade(color),0.55)
  block(d,x-0.3,y+0.08,w*0.44,span*0.39,h+2,7,index % 2 ? 0x9cb1a9 : 0xd4d3af)
  block(d,x,y+span/2-0.01,w*0.86,0.55,19,4,[0xb85850,0x33998f,0xdfb851][index%3]!)
}

export function terrain() {
  const d = new Drawing("taipei-terrain", "台北街道", "")
  slab(d,width/2,depth/2,width+16,depth+16,-1,0xadcab5)
  slab(d,river.start/2,depth/2,river.start,depth,0,0xbed2ac)
  slab(d,(river.end+width)/2,depth/2,width-river.end,depth,0,0xb5cda5)
  const water = new Set<number>()
  for (let x=river.start; x<river.end; x++) for (let y=0; y<depth; y++) water.add(key(x,y))
  paste(d,groundAsset(new Set(),water),0,0,1,0x57bcc5)
  for (let y=0; y<depth; y+=1.35) slab(d,44.8+Math.sin(y)*1.3,y,1.5,0.045,0.6,0x92d4d4)
  // Sidewalks, then road decks. The east-west avenue also forms the playable bridge.
  for (const x of streets) {
    slab(d,x,depth/2,3.65,depth,0.65,0xe1d9ba)
    slab(d,x,depth/2,2.8,depth,0.75,0x657879)
  }
  for (const y of crossStreets) {
    const primary = y === avenue
    for (const [a,b] of primary ? [[0,width]] : [[0,river.start],[river.end,width]]) {
      slab(d,(a!+b!)/2,y,b!-a!,primary?5.6:3.55,0.81,0xe3d9ba)
      slab(d,(a!+b!)/2,y,b!-a!,primary?4.2:2.8,0.92,0x657879)
    }
  }
  for (const x of streets) {
    for (const y of crossStreets) slab(d,x,y,2.8,y===avenue?5.62:3.57,1.02,0x657879)
    for (let y=1; y<depth; y+=1.25) {
      if (crossStreets.every((r)=>Math.abs(r-y)>3)) slab(d,x,y,0.04,0.62,1.08,0xf2dfa3)
    }
  }
  for (const y of crossStreets) {
    for (let x=1; x<width; x+=1.28) {
      if ((y===avenue || x<river.start || x>river.end) && streets.every((r)=>Math.abs(r-x)>2.3)) slab(d,x,y,0.67,0.057,1.1,0xf2dfa3)
    }
  }
  for (const x of streets) for (const side of [-1,1]) {
    for (let i=-3;i<=3;i++) slab(d,x+side*1.87,avenue+i*0.45,0.46,0.25,1.16,0xf7efdb)
  }
  for (const side of [-1,1]) {
    block(d,45,avenue+side*2.56,6.2,0.11,0,12,0x60858a)
    for (let x=42;x<=48;x++) block(d,x,avenue+side*2.56,0.12,0.15,0,15,0xd9d8b6,0.55)
  }
  return d.asset
}

export function buildings() {
  const d = new Drawing("taipei-buildings", "台北地標", "")
  lots.forEach((lot, i) => building(d,lot,i))
  const tree = makeTree("broadleaf", 1, "街樹", { x: 23, y: 55, segments: 8 })
  for (let x=3; x<width-1; x+=2.65) {
    if (streets.some((r)=>Math.abs(r-x)<2) || (x>river.start-0.5 && x<river.end+0.5)) continue
    for (const y of [20.72,27.25,37.15]) paste(d,tree,x,y,1.28,0x539d70)
    for (const y of [21.56,26.49]) {
      block(d,x,y,0.08,0.08,1,28,0x4f6465,0.4)
      block(d,x,y-0.12,0.13,0.31,26,4,0xefe5b6,0.35)
    }
  }
  return d.asset
}

export function taxi() {
  const d = new Drawing("yellow-taxi", "小黃計程車", "")
  for (const x of [-0.34,0.34]) for (const y of [-0.39,0.39]) {
    block(d,x,y,0.185,0.23,1,7,0x333948,0.65)
  }
  block(d,0,0,0.84,1.33,4,9,0xf5be37)
  block(d,0,-0.07,0.67,0.67,13,10,0x355863)
  block(d,0,-0.07,0.7,0.71,22,2,0xf9cc44,0.65)
  block(d,0,-0.09,0.34,0.17,24,4,0xfff0a0,0.65)
  for (const x of [-0.27,0.27]) {
    block(d,x,0.68,0.18,0.047,8,3,0xffefc8,0.4)
    block(d,x,-0.68,0.19,0.047,8,3,0xd25f59,0.4)
  }
  return d.asset
}

export function person(phase: number, passenger = false) {
  return makePerson("taipei-person", "台北居民",
    { coat: passenger ? 0xdc726b : 0x307f99, trim: 0xf6c548, skin: 0xdca07c, hat: "cap", long: false },
    { kind:"none" },null,phase)
}

export function marker() {
  const d = new Drawing("mission", "任務目的地", "")
  for(let i=0;i<24;i++) {
    const at = (angle:number,r:number):Vertex => [Math.cos(angle)*r,Math.sin(angle)*r,2]
    const a=i*Math.PI/12, b=(i+1)*Math.PI/12
    d.face([at(a,1.03),at(b,1.03),at(b,0.92),at(a,0.92)],0xffcc4e,0)
  }
  return d.asset
}

export function signal(color: number) {
  const d = new Drawing("signal", "紅綠燈", "")
  block(d,0,0,0.09,0.09,1,23,0x334f56,0.4)
  block(d,0,0,0.23,0.19,21,10,0x334f56,0.65)
  for (const y of [-0.108,0.108]) block(d,0,y,0.12,0.02,24,4,color,0)
  return d.asset
}

export function shadow(radius: number) {
  const d = new Drawing("shadow", "陰影", "")
  d.face(Array.from({ length: 14 }, (_, i): Vertex => {
    const a = i*Math.PI/7
    return [Math.cos(a)*radius,Math.sin(a)*radius*0.76,1.3]
  }),0x354c55,0,0,0.3)
  return d.asset
}
