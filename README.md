# 天空顏色模擬器 PWA

可部署到 GitHub Pages 的靜態 PWA。App 會使用瀏覽器定位取得經緯度，依日期與時間計算日出、日落、太陽高度，並即時調整天空背景與太陽位置。

## 本地預覽

```bash
python3 -m http.server 8080
```

開啟 `http://localhost:8080/`。

## 部署到 GitHub Pages

1. 將這個資料夾內容推到 GitHub repository。
2. 在 GitHub repository 的 `Settings` -> `Pages` 選擇要發布的 branch 與資料夾。
3. 發布後使用 HTTPS 網址開啟，定位與 PWA 安裝才會正常運作。

若部署在 project pages，例如 `https://Ray941216.github.io/sky-color-simulator/`，目前的 `manifest.json`、Service Worker 與資源路徑已使用相對路徑，可直接運作。

## 已修正的原始碼問題

- 修正 `<html lang="zh-Hant>` 少了結尾引號。
- 修正 Service Worker 中錯誤的 `event.ไหน`、`((((cache)` 與 `addEventListener.addEventListener`。
- 修正 SunCalc 呼叫方式，使用 `getPosition(...).altitude` 取得太陽高度。
- 移除外部 CDN 與遠端 icon 依賴，改成本地 `suncalc-lite.js` 與 SVG icon。
- 增加定位失敗時的台北預設座標，避免 `userCoords` 不存在時整個畫面狀態不準。
- 使用相對路徑，適合 GitHub Pages 的子路徑部署。
- 天空顏色改用太陽高度連續插值，避免日出日落門檻附近出現突兀跳色。
