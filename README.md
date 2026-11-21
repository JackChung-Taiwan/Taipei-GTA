# Taipei GTA｜台北自由城

在風格化的台北街區步行探索、駕駛小黃，完成台北車站到台北 101 的接送任務。Phase 1 使用 TypeScript、Vite、PixiJS 3D 與 Ritmo ECS。

## 本機啟動

需要 Node.js 24 與 pnpm 10.17.1。

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 5232
```

開啟 http://127.0.0.1:5232/ 。原版城市建造器可從暫停選單開啟，也可直接前往 `/inkline-town.html`。兩個模式各自存檔。原版建造器的分享連結需要本機開發伺服器的 API，GitHub Pages 提供靜態遊戲。

## 開始遊玩

- WASD 移動，Shift 跑步，Space 跳躍。拖曳場景旋轉攝影機，V 切換跟隨與高角度視角。
- 靠近出生點旁的小黃按 E 上車。W 加速、S 煞車或倒車、A／D 轉向、Space 手煞車。停穩後按 E 下車。
- 上車會接下首趟任務。沿大道前往黃色接客圈，停車接乘客，再到台北 101 的黃色下車圈停車，獲得 250 金幣。任務完成後可重新挑戰。
- M 展開城市地圖，小地圖右下按鈕切換朝向。Esc 開啟暫停、畫質、音量與日夜設定。行動裝置可使用觸控方向鍵。
- 玩家位置、車輛位置、任務階段、獎勵和設定會儲存在本機瀏覽器。刷新時車輛從靜止狀態恢復。

## 檢查與製作發布版本

```sh
pnpm typecheck
pnpm check
pnpm test
pnpm build
pnpm preview --host 127.0.0.1 --port 4173
```

正式版本預覽路徑為 http://127.0.0.1:4173/Taipei-GTA/ 。要執行台北模式的 Playwright 測試，先執行 `pnpm exec playwright install chromium`，或用 `BROWSER_EXECUTABLE_PATH` 指定已安裝的 Chromium 瀏覽器。在伺服器啟動後，執行 `pnpm check:taipei`。可用 `TAIPEI_BASE_URL` 指向正式預覽網址。原版城市建造器的測試請見 [DEVELOPMENT.md](DEVELOPMENT.md)。

GitHub Pages 工作流程位於 `.github/workflows/pages.yml`，使用 Vite 的 `/Taipei-GTA/` 路徑與 `dist/` 成品。授權推送後，將儲存庫的 Pages 來源設為 GitHub Actions，即可從主分支的工作流程部署。

## Phase 1 範圍

遊戲包含信義區、西門町、台北車站及淡水河／三重。地圖使用簡化比例，橋梁可通行。原版建造器維持獨立場景與存檔。台北場景共用建造、NPC 與自動車流、其他載具、其餘四項任務及手機實機效能測試待後續階段。

## 授權

基於 Sandro Maglione 的 [Inkline Town](https://github.com/SandroMaglione/inkline-town)。保留 [LICENSE](LICENSE)、[NOTICE](NOTICE) 與 [上游說明](INKLINE-README.md)。地標、黃色計程車、介面及合成引擎音效為本專案製作。
