import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { chromium } from "playwright"
import { saveKey, type State } from "../src/taipei/simulation.ts"

const executablePath = process.env.BROWSER_EXECUTABLE_PATH
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}),
  args: ["--disable-crash-reporter", "--disable-breakpad", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
})
const base = new URL(process.env.TAIPEI_BASE_URL ?? "http://127.0.0.1:5232/")
base.searchParams.set("renderer", "webgl")
const output = process.env.TAIPEI_SCREENSHOTS
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "zh-TW" })
const errors: string[] = []
page.on("pageerror", (error) => errors.push(error.message))
page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
page.setDefaultTimeout(25000)
const saved = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as State | null, saveKey)
const loaded = async () => {
  await page.locator("#loading").waitFor({ state: "hidden" })
  await page.waitForFunction((key) => !!localStorage.getItem(key), saveKey)
}
const text = async (selector: string, phrase: string) => {
  await page.waitForFunction(([selector, phrase]) => !!document.querySelector(selector!)?.textContent?.includes(phrase!), [selector, phrase])
}
const screenshot = async (name: string) => {
  if (!output) return
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: `${output}/${name}.png` })
}
async function driveTo(maxDistance: number, nextObjective: string) {
  await page.keyboard.down("w")
  await page.waitForFunction((max) => {
    const value = Number(document.querySelector("#distance")?.textContent?.match(/\d+/)?.[0])
    return value <= max
  }, maxDistance)
  await page.keyboard.up("w")
  await page.keyboard.down("Space")
  await text("#objective", nextObjective)
  await page.keyboard.up("Space")
}

try {
  const response = await page.goto(base.href)
  assert.equal(response?.status(), 200)
  await loaded()
  await page.locator("#labels .world-label").filter({ hasText: "台北 101" }).waitFor({ state: "visible" })
  assert.equal(await page.locator("canvas.world-canvas").count(), 1)
  await screenshot("taipei-phase-1")
  const before = (await saved())!.player
  const label = page.locator("#labels .destination")
  const screenBefore = await label.boundingBox()
  await page.keyboard.down("w")
  await page.waitForFunction((top) => Math.abs(document.querySelector<HTMLElement>("#labels .destination")!.getBoundingClientRect().top - top) > 3.5, screenBefore!.y)
  await page.keyboard.up("w")
  await page.waitForFunction(({ key, x }) => JSON.parse(localStorage.getItem(key)!).player.x < x - 0.12, { key: saveKey, x: before.x })
  assert.notDeepEqual((await label.boundingBox())?.y, screenBefore?.y)
  assert.equal(await page.locator("#interact").isVisible(), true, JSON.stringify(await saved()))
  await page.keyboard.press("e")
  await text("#travel-mode", "計程車駕駛")
  console.log("Taxi boarded.")
  await driveTo(23, "沿著大道")
  console.log("Passenger picked up.")
  await driveTo(30, "乘客已送達")
  await text("#coins", "250")
  assert.equal((await saved())!.completed, 1)
  await screenshot("taipei-mission-complete")
  await page.keyboard.press("e")
  await text("#travel-mode", "自由探索")
  const snapshot = await saved()
  await page.reload()
  await loaded()
  await text("#coins", "250")
  assert.deepEqual((await saved())!.player, snapshot!.player)
  assert.deepEqual((await saved())!.taxi.x, snapshot!.taxi.x)
  await text("#objective", "乘客已送達")
  await page.keyboard.press("m")
  await page.locator(".map.expanded").waitFor()
  await page.keyboard.press("m")
  await page.keyboard.press("v")
  await page.keyboard.press("Escape")
  assert.equal(await page.locator("#pause").isVisible(), true)
  await page.locator("#night").check()
  await page.getByRole("button", { name: "繼續探索" }).click()
  assert.equal(await page.locator("#game.night").count(), 1)
  await page.keyboard.press("Escape")
  await page.locator("#night").uncheck()
  await page.getByRole("button", { name: "繼續探索" }).click()
  await page.getByRole("button", { name: /重新挑戰/ }).click()
  await text("#objective", "駕駛小黃")
  assert.equal((await saved())!.coins, 250)
  assert.equal(errors.join("\n"), "")
  console.log("Taipei desktop: rendering, walking, follow camera, taxi pickup/dropoff, reward, exit, reload, map, settings, repeatable mission.")

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: "zh-TW" })
  phone.on("pageerror", (error) => errors.push(error.message))
  await phone.goto(base.href)
  await phone.locator("#loading").waitFor({ state: "hidden" })
  await phone.getByRole("button", { name: "前進", exact: true }).waitFor()
  await phone.locator("#interact").tap()
  await phone.locator("#speed").waitFor()
  assert.equal(await phone.getByRole("button", { name: "手煞車" }).isVisible(), true)
  assert.equal(errors.join("\n"), "")
  console.log("Taipei mobile emulation: responsive HUD, touch entry, driving controls.")
} finally {
  await browser.close()
}
