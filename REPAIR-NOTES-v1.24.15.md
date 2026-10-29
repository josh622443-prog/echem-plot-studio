# Echem Plot Studio v1.24.15 — Custom Axes repair

原始來源：E:/Download/Echem_Plot_Studio_v1.24.14.html；與截圖中的 (1) 副本 SHA-256 相同。
原始 SHA-256：09f8098f8327aba745be862e6bfa5599c880b26fcB7D54BD9855137DB1ECB4AB

## 證據與修正
- 舊版 numCol 使用 Number(raw)。HH:MM:SS 字串變成 NaN，pairwiseClean 刪掉所有配對，SVG 使用 0–1 預設範圍。
- 新版僅於 Custom Axes 的 time/charge_time/discharge_time 解析 HH:MM:SS[.sss]、超過 24 小時的時長，以及 D d HH:MM:SS；冒號時長先換成秒，再換顯示單位。數值時間仍依欄位單位換算；無單位 Time 沿用秒的既有約定。不解析絕對日期時間或猜測 Excel 日期序號。
- 空白仍為缺值；無效列依配對刪除，保留 X/Y 行對齊。
- 欄位未映射時顯示空白選項，避免下拉選單看似選中第一欄，但內部映射其實為 null。
- 載入完成先刷新 Custom Axes 再刷新電池卡；切換工作表同步刷新物理量選項。
- 加入每顆電池有效 X/Y1 配對數、實際欄位與單位。Loaded 僅表示檔案解析完成。
- 原有 markers-only 分支與 render triggers 在有有效資料時正常；未以換成線圖掩蓋問題。

## 瀏覽器驗證
Microsoft Edge headless, Playwright。
1. 舊版同一組三筆時長資料：X 全部 NaN（JSON 中為 null），0 個 circle。
2. 新版：X = [0, 0.5, 1] h，Y = [3, 3.5, 4] V；3 個資料 marker 加 1 個圖例 marker。
3. 真實 CSV 檔案上傳及 dropdown 操作通過，Y2 留空、Markers only，沒有 pageerror。見 upload-test-results.json 和 Custom_Axes_verified.png。
4. 數值 min→h、mV→V、空白缺值、長時長/小數/天數、無效字串、line/line-markers/scatter 觸發、單位 change、Y2、零有效點診斷通過。

## 使用
打開 Echem_Plot_Studio_v1.24.15.html，選 Multi-Cell Overlay → Custom Axes，X quantity=Time、unit=h，Y1=Voltage、unit=V，Y2=None，Markers only，上傳 custom_axes_duration.csv。預期 3 / 3 valid X/Y1 pairs，三筆電壓點。
HTML 保留原本 CDN 依賴，非完全離線版。

## Codex 接續與重跑
在此資料夾執行 npm install playwright，再執行 node test.cjs 和 node upload-test.cjs。Windows 預設使用 Edge；其他系統設定 BROWSER_PATH 到 Chromium/Edge 執行檔。測試會覆寫驗證圖與 JSON。
baseline_v1.24.14.html 保留未改來源，供差異比較。

## 限制
未取得截圖所用 c7 原始 workbook。已證明並修正時長字串導致空圖的缺陷，但不能證明該 workbook 的唯一根因。仍需以原始 workbook 復測；新診斷可辨識缺映射、零有效配對等情況。未宣稱所有主頁與嵌入 DRT 功能完成全面回歸。
