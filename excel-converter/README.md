# Echem Excel Converter v1.0.0

1. 解壓縮整個資料夾。需要 Windows 與 Python 3.9 以上。第一次使用需連網安裝 Excel 讀取套件。
2. 雙擊 `Convert Echem Excel.cmd`，選擇新威或藍電匯出的 `.xlsx`。也可以把單一檔案拖到 .cmd 上。
3. 在原資料夾找到 `原檔名_Echem.xlsx`，用 Echem Plot Studio 的拖曳區或 Data Library 開啟。

- `record` 儲存逐點紀錄。匯出時勾選 Cycle、Voltage、Capacity，並保留單位。建議一併匯出 Current、Test Time、Step Type。
- `cycle` 儲存已有的循環統計。若匯出檔包含帶單位的放電容量，可加上充電容量與 Coulombic Efficiency。
- 轉檔會統一可辨識的欄名，保留資料列。電壓標成 mV 時會換算成 V。容量保留原單位，不把 Ah 換算成 mAh/g。若容量是 mAh 或 Ah，繪圖時請核對座標軸標籤。未辨識欄位會沿用原名。公式只讀 Excel 已儲存的結果。轉檔前如有使用公式，請先在 Excel 重新計算並存檔。
- 這版支援表頭在前 50 列的獨立工作表。每類若找到多張符合的工作表，會請你選一張。來源只有其中一類時，只輸出找到的那一類，不自動推算循環統計。不合併多張拆分工作表；建議匯出時分開選「循環統計」和「逐點紀錄」，每個檔案只含一顆電池。
- 舊 `.xls` 請先另存為 `.xlsx`。若欄名不匹配，可提供只有工作表名稱與表頭的範例。
