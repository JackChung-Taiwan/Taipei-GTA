import "./style.css"
import { GameScene } from "../render/pixi3d/scene.ts"
import { buildAsset, floorScale } from "../render/pixi3d/assets/renderer.ts"
import type { InkAsset } from "../render/pixi3d/assets/primitives.ts"
import { buildings, marker, person, shadow, signal, taxi, terrain } from "./city-art.ts"
import { avenue, crossStreets, depth, landmarks, lots, river, streets, width } from "./map.ts"
import { clamp, createSimulation, distance, focus, loadSave, redLight, save, waypoint, type Quality, type State } from "./simulation.ts"

function get<T extends HTMLElement>(id: string) {
  const element = document.getElementById(id)
  if (!element) throw new Error(`缺少畫面元素 ${id}`)
  return element as T
}

const labels = get("labels")
function label(name: string, destination = false) {
  const el = document.createElement("div")
  el.className = destination ? "world-label destination" : "world-label"
  const dot = document.createElement("i")
  const text = document.createElement("span")
  text.textContent = name
  el.append(dot, text)
  labels.append(el)
  return { el, text }
}

const minimap = get<HTMLCanvasElement>("minimap")
const mapContext = minimap.getContext("2d")
function drawMap(s: State, rotation: number, expanded: boolean) {
  if (!mapContext) return
  const g = mapContext
  const scale = rotation ? 3.14 : 3.76
  const target = waypoint(s)
  const pos = focus(s)
  g.fillStyle = "#28484d"
  g.fillRect(0, 0, minimap.width, minimap.height)
  g.save()
  g.translate(130, 102)
  g.rotate(rotation)
  g.translate(-width * scale / 2, -depth * scale / 2)
  g.scale(scale, scale)
  g.fillStyle = "#3b5e58"
  g.fillRect(0, 0, width, depth)
  g.fillStyle = "#468895"
  g.fillRect(river.start, 0, river.end - river.start, depth)
  g.fillStyle = "#9aa99b"
  for (const x of streets) g.fillRect(x - 1, 0, 2, depth)
  for (const y of crossStreets) {
    g.fillRect(0, y - 0.9, y === avenue ? width : river.start, 1.8)
    g.fillRect(river.end, y - 0.9, width - river.end, 1.8)
  }
  g.fillStyle = "#71927b"
  for (const l of lots) g.fillRect(l.x - l.w / 2, l.y - l.d / 2, l.w, l.d)
  if (target) {
    g.beginPath()
    g.setLineDash([0.6, 0.72])
    g.lineWidth = 0.36
    g.strokeStyle = "#ffdd77"
    g.moveTo(pos.x, pos.y)
    g.lineTo(target.x, target.y)
    g.stroke()
    g.setLineDash([])
    g.fillStyle = "#ffd477"
    g.beginPath()
    g.arc(target.x, target.y, 1.35, 0, Math.PI * 2)
    g.fill()
  }
  for (const l of landmarks) {
    g.save()
    g.translate(l.x,l.y)
    g.rotate(-rotation)
    g.fillStyle = "#f8e5b8"
    g.beginPath()
    g.arc(0, 0, 0.68, 0, Math.PI * 2)
    g.fill()
    g.font = "bold 2.6px sans-serif"
    g.textAlign = "center"
    if (expanded) g.fillText(l.name, 0, -1.4)
    g.restore()
  }
  g.translate(pos.x, pos.y)
  g.rotate(-(s.driving ? s.taxi.angle : s.face))
  g.fillStyle = "#bdf3c9"
  g.strokeStyle = "#132d32"
  g.lineWidth = 0.38
  g.beginPath()
  g.moveTo(0, 2.0)
  g.lineTo(-1.18, -0.9)
  g.lineTo(0, -0.44)
  g.lineTo(1.18, -0.9)
  g.closePath()
  g.fill()
  g.stroke()
  g.restore()
  g.fillStyle = "#f6ebce"
  g.font = "bold 12px sans-serif"
  g.fillText(rotation ? "↗" : "N", 12, 19)
}

function engine() {
  let audio: AudioContext | undefined
  let oscillator: OscillatorNode | undefined
  let gain: GainNode | undefined
  return {
    unlock() {
      if (audio) {
        if (audio.state === "suspended") void audio.resume()
        return
      }
      audio = new AudioContext()
      oscillator = audio.createOscillator()
      gain = audio.createGain()
      const filter = audio.createBiquadFilter()
      filter.type = "lowpass"
      filter.frequency.value = 160
      gain.gain.value = 0
      oscillator.type = "triangle"
      oscillator.connect(filter).connect(gain).connect(audio.destination)
      oscillator.start()
      void audio.resume()
    },
    update(speed: number, volume: number) {
      if (!audio || !oscillator || !gain) return
      oscillator.frequency.setTargetAtTime(37 + Math.abs(speed) * 6, audio.currentTime, 0.1)
      gain.gain.setTargetAtTime(volume * 0.11, audio.currentTime, 0.09)
    },
  }
}

async function boot() {
  const loaded = loadSave(localStorage)
  const simulation = createSimulation(loaded)
  const sound = engine()
  const world = get("world")
  const scene = await GameScene.create(world)
  scene.canvas.setAttribute("aria-label", "台北自由城 3D 場景，拖曳旋轉視角")
  scene.app.renderer.background.color = 0xaacabd

  const mount = (asset: InkAsset) => {
    const model = buildAsset(asset, { batchFaces: true, meshInk: true, contours: true, contourRods: true, surfaceEffects: false })
    scene.objects.addChild(model.group)
    return model.group
  }
  mount(terrain())
  mount(buildings())
  const car = mount(taxi())
  const carShadow = mount(shadow(0.68))
  const playerShadow = mount(shadow(0.28))
  const poses = [0, 1, 2, 3, 4, 5].map((p) => mount(person(p * Math.PI / 3)))
  const passenger = mount(person(0, true))
  const goal = mount(marker())
  const lights = streets.map((x) => {
    const green = mount(signal(0x74e2a6))
    const red = mount(signal(0xed7867))
    for (const lamp of [green, red]) lamp.position.set((x+2.05)*floorScale,0,(avenue+2.45)*floorScale)
    return { green, red }
  })

  const placeLabels = landmarks.map((l) => ({ ...l, ...label(l.name) }))
  const destination = label("", true)
  const moveLabel = (element: HTMLElement, x: number, y: number, height: number) => {
    const p = scene.project(x, y, height)
    element.style.left = `${p.x}px`
    element.style.top = `${p.y}px`
    element.hidden = p.x < 35 || p.x > innerWidth - 35 || p.y < 84 || p.y > innerHeight - 130
  }
  const pause = get<HTMLDialogElement>("pause")
  const mapPanel = get("map-panel")
  const volumeField = get<HTMLInputElement>("volume")
  const qualityField = get<HTMLSelectElement>("quality")
  const nightField = get<HTMLInputElement>("night")
  const interact = get<HTMLButtonElement>("interact")
  const money = get("coins")
  const speedometer = get("speed")
  const km = get("km")
  const district = get("district")
  const missionButton = document.querySelector<HTMLButtonElement>('[data-action="mission"]')!
  const toast = get("toast")
  const keys = new Set<string>()
  const mobileKeys = new Map<number, string>()
  const pressed = (code: string) => keys.has(code) || [...mobileKeys.values()].includes(code)
  let interactQueued = false
  let missionQueued = false
  let volume = loaded.volume
  let quality = loaded.quality
  let night = loaded.night
  let savePending = false
  let saveAt = 0
  let heading = 1.18
  let elevation = 0.60
  let overview = false
  let rotatingMap = false
  let lastView = ""
  let lastNotice = ""
  let toastUntil = 0
  let stride = 0
  let accumulator = 0
  let mapAt = 0
  let cameraX = focus(loaded).x - 10.1
  let cameraY = focus(loaded).y - 4.0
  let zoom = innerWidth < 760 ? 0.47 : 0.72
  const persist = () => {
    const saved = save(localStorage, { ...simulation.state, volume, quality, night })
    if (!saved && !savePending) {
      savePending = true
      toast.textContent = "瀏覽器無法儲存進度。"
      toast.hidden = false
      toastUntil = performance.now() + 5000
    }
    return saved
  }

  const applySettings = () => {
    get("game").classList.toggle("night", night)
    const resolution = quality === "low" ? 0.75 : quality === "medium" ? 1 : Math.min(devicePixelRatio, 2)
    scene.app.renderer.resize(world.clientWidth, world.clientHeight, resolution)
  }
  volumeField.value = String(volume)
  qualityField.value = quality
  nightField.checked = night
  applySettings()
  volumeField.addEventListener("input", () => { volume = Number(volumeField.value); persist() })
  qualityField.addEventListener("change", () => { quality = qualityField.value as Quality; applySettings(); persist() })
  nightField.addEventListener("change", () => { night = nightField.checked; applySettings(); persist() })
  window.addEventListener("pagehide", persist)
  document.addEventListener("visibilitychange", () => { if (document.hidden) persist() })
  const action = (name: string) => {
    if (name === "pause") {
      if (pause.open) pause.close()
      else {
        keys.clear()
        mobileKeys.clear()
        pause.showModal()
        persist()
      }
    }
    if (pause.open) return
    if (name === "map") mapPanel.classList.toggle("expanded")
    if (name === "rotate-map") rotatingMap = !rotatingMap
    if (name === "view") overview = !overview
    if (name === "interact") interactQueued = true
    if (name === "mission") missionQueued = true
  }
  document.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => { sound.unlock(); action(button.dataset.action!) })
  })
  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape" && pause.open) return
    if (pause.open || (event.code === "Space" && event.target instanceof HTMLButtonElement)) return
    if (!["KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","Space","KeyE","KeyM","KeyV","Escape"].includes(event.code)) return
    event.preventDefault()
    sound.unlock()
    keys.add(event.code)
    if (event.repeat) return
    const shortcuts: Record<string, string> = { KeyE: "interact", KeyM: "map", KeyV: "view", Escape: "pause" }
    const name = shortcuts[event.code]
    if (name) action(name)
  })
  window.addEventListener("keyup", (event) => keys.delete(event.code))
  window.addEventListener("blur", () => { keys.clear(); mobileKeys.clear() })
  for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-key]")) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault()
      button.setPointerCapture(event.pointerId)
      sound.unlock()
      mobileKeys.set(event.pointerId, button.dataset.key!)
    })
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(type, (event) => mobileKeys.delete((event as PointerEvent).pointerId))
    }
  }
  scene.canvas.addEventListener("pointerdown", (event) => {
    scene.canvas.focus({ preventScroll: true })
    scene.canvas.setPointerCapture(event.pointerId)
  })
  scene.canvas.addEventListener("pointermove", (event) => {
    if (!scene.canvas.hasPointerCapture(event.pointerId)) return
    heading -= event.movementX * 0.005
    elevation = clamp(elevation + event.movementY * 0.004, 0.31, 1.08)
  })
  scene.canvas.addEventListener("contextmenu", (event) => event.preventDefault())

  const objective = get("objective")
  const remaining = get("distance")
  const progressText = get("mission-state")
  const pickupStage = get("step-pickup")
  const dropoffStage = get("step-dropoff")
  const travel = get("travel-mode")
  const shortcuts = get("shortcuts")
  const jumpLabel = get("jump")
  const sprint = get("sprint")
  function updateHud(s: State, now: number) {
    const signature = `${s.progress}:${s.coins}:${s.driving}`
    if (signature !== lastView) {
      lastView = signature
      const text = {
        available: ["可接任務", "找到街上的小黃，接送乘客前往台北 101。", "開始任務"],
        pickup: ["進行中", "駕駛小黃前往黃色接客圈，減速停車。", "任務進行中"],
        dropoff: ["進行中", "沿著大道前往台北 101，到黃色下車圈停車。", "任務進行中"],
        complete: ["已完成", "乘客已送達台北 101，已收到 250 金幣。", "重新挑戰"],
      }[s.progress]
      progressText.textContent = text[0]!
      objective.textContent = text[1]!
      missionButton.firstChild!.textContent = text[2]! + " "
      missionButton.disabled = s.progress === "pickup" || s.progress === "dropoff"
      pickupStage.className = s.progress === "pickup" ? "active" : s.progress === "dropoff" || s.progress === "complete" ? "done" : ""
      dropoffStage.className = s.progress === "dropoff" ? "active" : s.progress === "complete" ? "done" : ""
      money.textContent = s.coins.toLocaleString("zh-TW")
      get("level").textContent = String(1 + Math.floor(s.completed / 3)).padStart(2, "0")
      travel.textContent = s.driving ? "計程車駕駛" : "自由探索"
      shortcuts.innerHTML = s.driving
        ? "<span><kbd>W</kbd> 加速</span><span><kbd>S</kbd> 煞車／倒車</span><span><kbd>Space</kbd> 手煞車</span>"
        : "<span><kbd>W A S D</kbd> 移動</span><span><kbd>Shift</kbd> 跑步</span><span><kbd>Space</kbd> 跳躍</span>"
      jumpLabel.textContent = s.driving ? "手煞車" : "跳躍"
      sprint.hidden = s.driving
      speedometer.hidden = !s.driving
      persist()
    }
    if (s.notice && s.notice !== lastNotice) {
      lastNotice = s.notice
      toast.textContent = s.notice
      toastUntil = now + 3600
    }
    toast.hidden = now > toastUntil
    interact.hidden = !s.driving && distance(s.player, s.taxi) >= 2.7
    interact.innerHTML = s.driving ? "<kbd>E</kbd> 下車" : "<kbd>E</kbd> 上車"
    const target = waypoint(s)
    remaining.hidden = !target || s.progress === "available"
    if (target) remaining.textContent = "距離目的地 " + Math.round(distance(focus(s), target) * 12) + " 公尺"
    if (s.driving) km.textContent = String(Math.round(Math.abs(s.taxi.speed) * 7))
    const p = focus(s)
    const nearest = p.x > 48 ? "三重" : p.x > 42 ? "淡水河橋" : p.x < 22 ? "信義商圈" : p.y > 28 ? "西門町" : "台北車站"
    if (district.dataset.place !== nearest) {
      district.dataset.place = nearest
      district.innerHTML = `<span>●</span> ${nearest}`
    }
  }

  const tick = 1 / 60
  const qualityFPS: Record<Quality, number> = { low: 12, medium: 18, high: 24 }
  let loading = true
  scene.subscribe(({ deltaMS }) => {
    const dt = Math.min(deltaMS / 1000, 0.1)
    const now = performance.now()
    if (!pause.open && !document.hidden) {
      accumulator += dt
      while (accumulator >= tick) {
        simulation.tick({
          dt: tick, forward: Number(pressed("KeyW")) - Number(pressed("KeyS")), steer: Number(pressed("KeyD")) - Number(pressed("KeyA")),
          run: pressed("ShiftLeft") || pressed("ShiftRight"), jump: pressed("Space"), interact: interactQueued,
          start: missionQueued, heading,
        })
        interactQueued = false
        missionQueued = false
        accumulator -= tick
      }
    }
    const s = simulation.state
    const p = focus(s)
    const smoothing = 1 - Math.exp(-dt * 5.5)
    const angle = s.driving ? s.taxi.angle + Math.PI : heading
    const viewHeading = heading + Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading)) * (s.driving && !overview ? 0.34 : 0)
    const lead = overview ? 0 : s.driving ? 3.4 : 10.5
    cameraX += (p.x - Math.sin(viewHeading) * lead - cameraX) * smoothing
    cameraY += (p.y - Math.cos(viewHeading) * lead - cameraY) * smoothing
    const idealZoom = innerWidth < 760 ? (overview ? 0.35 : 0.47) : (overview ? 0.49 : s.driving ? 1.04 : 0.72)
    zoom += (idealZoom - zoom) * smoothing
    scene.setView({ x: cameraX, y: cameraY, heading: viewHeading, elevation: overview ? 1.11 : elevation, zoom })
    car.position.set(s.taxi.x * floorScale, 0, s.taxi.y * floorScale)
    car.rotation.y = s.taxi.angle
    carShadow.position.set(s.taxi.x * floorScale, 0, s.taxi.y * floorScale)
    playerShadow.visible = !s.driving
    playerShadow.position.set(s.player.x * floorScale, 0, s.player.y * floorScale)
    if (s.walking && !pause.open) stride += dt * qualityFPS[quality]
    const pose = s.walking ? Math.floor(stride) % poses.length : 0
    poses.forEach((model, i) => {
      model.visible = !s.driving && i === pose
      if (!model.visible) return
      model.position.set(s.player.x * floorScale, s.jump * 1.2, s.player.y * floorScale)
      model.scale.set(1.5, 1.5, 1.5)
      model.rotation.y = s.face - Math.PI / 2
    })
    const target = waypoint(s)
    goal.visible = target !== null
    passenger.visible = s.progress === "pickup"
    if (target) {
      goal.position.set(target.x * floorScale, 0, target.y * floorScale)
      passenger.position.set((target.x + 0.32) * floorScale, 0, (target.y + 0.65) * floorScale)
      destination.text.textContent = s.progress === "available" ? "小黃計程車" : s.progress === "pickup" ? "接客點" : "下車點"
      moveLabel(destination.el,target.x,target.y,33)
    } else destination.el.hidden = true
    for (const l of placeLabels) moveLabel(l.el,l.x,l.y,l.height)
    lights.forEach(({ green, red }, i) => { red.visible = redLight(s.time,i); green.visible = !red.visible })
    updateHud(s, now)
    if (now >= mapAt) {
      drawMap(s, rotatingMap ? viewHeading : 0, mapPanel.classList.contains("expanded"))
      mapAt = now + 90
    }
    sound.update(s.taxi.speed, s.driving && !pause.open && !document.hidden ? volume : 0)
    if (now >= saveAt) {
      persist()
      saveAt = now + 1000
    }
    if (loading) {
      loading = false
      get("loading").hidden = true
    }
  })
}

void boot().catch((error: unknown) => {
  console.error(error)
  get("loading").textContent = "無法啟動 3D 場景。請確認瀏覽器已啟用硬體加速與 WebGL，然後重新整理。"
})
