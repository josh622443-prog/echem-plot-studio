# Echem Plot Studio

**新威／藍電 Excel 轉檔工具（Windows）：** [下載 Echem Excel Converter v1.1.0](https://github.com/josh622443-prog/echem-plot-studio/raw/refs/heads/main/downloads/Echem-Excel-Converter-v1.1.0-Windows.zip)。解壓縮並執行 Convert Echem Excel.cmd。可拖入檔案，或在視窗開啟期間每小時掃描所選資料夾，把 .xlsx 的逐點紀錄和已有的循環統計整理成 record／cycle 工作表。

NDAX 匯入會從檔名預填活性物質質量，例如 `sample_45_55mg.ndax` → `0.04555 g`。支援 `g`、`mg` 和 `µg`（也接受 `μg`、`ug`），以及小數點或底線。匯入前可確認或修改。檔名缺少單位、沒有可辨識數值或包含多個質量時，請手動輸入。

**資料庫試用**。在圖表左側的「資料庫」選擇資料夾，可逐層點進子資料夾。用 ← 返回、→ 前進、↑ 上一層，或點路徑列跳轉。清單依列顯示名稱與檔案修改時間，搜尋仍會查找整個所選資料夾。切換繪圖頁籤時側欄保持可用，窄視窗會將資料庫放在圖表上方。搜尋檔名或路徑後，點檔名匯入單檔，或勾選支援的檔案後按「比較勾選檔案」。「全選」會勾選目前資料夾或搜尋結果內所有頁面的檔案。「取消全選」會清除全部勾選。本機啟動版可以開啟和比較 NDAX，每個 NDAX 檔案需要填入自己的活性物質質量（g）。重新開啟頁面後需重新選擇資料夾。

圖表區使用兩層選單。「循環與性能」包含 GCD、dQ/dV、循環壽命、Retention、CbC Retention、倍率性能與穩態過電位。「EIS / DRT」可切換 Nyquist / EIS 與 DRT。多檔比較集中在「多電池疊圖」。

**單一 HTML 版：[下載 Browser Edition](https://github.com/josh622443-prog/echem-plot-studio/raw/refs/heads/main/downloads/Echem_Plot_Studio_v1.27.8_Browser.html)**。將檔案儲存為 `.html` 並用瀏覽器開啟。支援 TXT、CSV、XLSX 和 XLS，以及圖表和數據拷貝。無需 Python 或本機伺服器。頁面透過網路載入瀏覽器套件，不提供 NDAX 匯入或原生 OPJU 匯出。可用 `python build_standalone_html.py` 從目前版本重新產生。

**macOS 使用者：[下載 v1.27.8 macOS 使用包](https://github.com/josh622443-prog/echem-plot-studio/raw/refs/heads/main/downloads/Echem-Plot-Studio-v1.27.8-macOS.zip)**

解壓縮後，TXT、CSV 和 Excel 可直接用瀏覽器開啟 **index.html**。匯入 NDAX 請先安裝 [Python 3.10 以上](https://www.python.org/downloads/macos/)（建議 Python 3.12），再雙擊 **Start Echem Plot Studio.command**。首次安裝套件需連網，使用時請保持 Terminal 開啟。原生 OPJU 匯出需要 Windows 上已安裝並授權的 Origin。

**Windows 使用者：[下載目前可用的 v1.27.8 Windows 使用包](https://github.com/josh622443-prog/echem-plot-studio/raw/refs/heads/main/downloads/Echem-Plot-Studio-v1.27.8-Windows.zip)**

完整解壓縮 → 雙擊 **Start Echem Plot Studio.cmd** → 首次連網安裝套件 → 使用自動開啟的頁面。需先安裝 Python 3.9 以上。使用包只含目前版本及必要檔案，無須挑選歷史 HTML。

**下載位置提醒：** 右側 Releases 的 v1.24.7 是歷史發布；網址含 `/tree/300da08...` 或 `/tree/a5d8d3f...` 是固定的舊快照，沒有 2026-11-02 的啟動修正。請使用上方直接下載，或 [main 主分支](https://github.com/josh622443-prog/echem-plot-studio/tree/main) 的 Code → Download ZIP。

Browser-based electrochemical data visualization and analysis tool for CSV and Excel data. The current release includes cycle-life, retention, charge/discharge, dQ/dV, rate-performance, EIS/Nyquist, multi-cell comparison, and integrated DRT analysis workflows.

## Current release

Version **1.27.8** (2026-11-09)

## Run the tool

### Windows 下載與啟動

請從 [目前主分支](https://github.com/josh622443-prog/echem-plot-studio/tree/main) 選擇 **Code → Download ZIP**，完整解壓縮後，再雙擊 **Start Echem Plot Studio.cmd**。網址含 `/tree/a5d8d3f...` 的頁面是固定的舊版快照，不會隨主分支更新。

資料夾內的多個 `Echem_Plot_Studio_v*.html` 是保留的歷史版本，不需要逐一開啟。啟動器會開啟目前的 **v1.27.8**；`index.html` 與目前版本內容相同。請保留整個解壓縮資料夾，勿只下載 `.cmd` 或混用舊版檔案。

首次啟動需要 Python 3.9 以上與網路，啟動器會將缺少的 NDAX 套件安裝到此資料夾的 `.runtime/python`。2026-11-02 已修正 Windows PowerShell 5.1 在套件檢查遇到 `No module named 'NewareNDA'` 時提前停止、未執行自動安裝的問題。安裝失敗會顯示原因，啟動記錄位於 `%TEMP%\EchemPlotStudio-startup.log`。不用以系統管理員身分開啟。

`node launcher-setup-test.cjs` uses synthetic reader and pip fixtures in an isolated temporary folder to check missing-dependency stderr, first setup, reuse and installation failure in Windows PowerShell. It does not download dependencies or modify the installed Python.

The Windows archive is built from an explicit runtime-file list with `powershell.exe -NoProfile -ExecutionPolicy Bypass -File build_windows_package.ps1`. Rebuild it when changing shipped files. It excludes research data, local dependencies, machine-specific Origin configuration and historical HTML files, while retaining licensing and citation notices.

### Origin-ready X/Y columns and native OPJU (v1.26.0)

**Copy data** defaults to **Origin: separate X/Y pairs**. Every selected cycle has its own adjacent X/Y columns; different-length curves are padded with empty cells. Segment transitions insert empty X/Y cells instead of joining charge/discharge branches. Select **Table rows** to keep the earlier long table, or uncheck **Include headers** to copy numbers only. When pasting plain text into Origin, designate the columns `XY XY`; plain-text clipboard data cannot set Origin's column roles.

**Export OPJU** creates a genuine project using your installed, licensed Origin in a new hidden process. It creates a `Data` worksheet with alternating X/Y designations, a `SourceData` worksheet retaining the original table, and basic editable graphs. Different physical units and Y axes are exported as separate graphs; styling/layout may differ from the browser. No existing Origin session or project is used.

Run through `Start Echem Plot Studio.cmd`. Origin's bundled Python and `originpro` must be available (tested with Origin 2024). No external Origin automation package or COM registration is required: the exporter uses Origin's documented `-hs -rs` / `run -pyf` interface. If auto-detection fails, save the full `Origin64.exe` path in a local `origin_executable.txt`, or set `ECHEM_ORIGIN_EXE`. This machine-specific file is ignored by Git. Export is local; Origin itself is not distributed.

The command-line tool is `python origin_export.py data.json output.opju`; it refuses to overwrite an existing output. Native projects were saved and reopened in Origin to verify separate cycle columns, numeric data and editable graphs.

Validation on 2026-10-29: all four package browser tests, nine local HTTP tests, six Origin payload/grouping tests and the occupied-port/reuse test passed. A browser-generated OPJU was downloaded and reopened in Origin 2024; independent cycle X/Y columns, alternating X/Y designations, numeric values and editable graphs were checked. A full local NDAX import also retained all selected source points in wide clipboard data. Tests used simulated clipboard writes; native project tests used synthetic data, and no research inputs or outputs are distributed.

### Copy data (v1.25.0)

Every page has **Copy data**. Nyquist voltage/time and the three overpotential diagnostic charts have their own buttons. DRT copies the active single/batch tau–gamma spectrum; Battery Info, Instructions, and Changelog copy their corresponding tables/text.

Copy uses tab-separated columns with headers and available units, preserving numeric precision and missing values. Selected curves and current analysis parameters are respected. Curve data is exported before display decimation; axis zoom/cropping does not discard source points. Custom axes include effective units for each battery/Y axis. Paste into Excel or Origin; save the resulting project from Origin if an `.opju` file is needed. Use the new Export OPJU button for native project export when running through the local launcher with Origin installed.

If automatic clipboard access is denied, a dialog selects the table for manual Ctrl+C. An empty analysis reports that data must be loaded/computed first. `data-copy.js` is embedded unchanged in the release HTML, so no separate runtime script is required for this feature.

Validation on 2026-10-29: all four package browser tests and six HTTP API tests passed. Copy-specific checks cover all pages/subcharts, selected and computed data, DRT synthetic analysis, precision, effective units (including same-named batteries), TSV quoting, empty states, localization, and manual fallback. A local NDAX import also verified full-resolution selected-curve copying and the existing palette fix. Clipboard writes were simulated during testing so the user's clipboard was preserved; no research input/output is distributed.

Download `index.html` or `Echem_Plot_Studio_v1.27.8.html` and open it in a modern desktop browser. These files contain the same application. An internet connection is required when the page first loads because third-party browser libraries and fonts are loaded from CDNs.

Supported directly in the browser:

- `.csv`
- `.xlsx`
- `.xls`

For `.ndax` import on Windows, download the whole repository and double-click **`Start Echem Plot Studio.cmd`**. Keep its command window open and use the page it opens at `http://127.0.0.1:8765/`. The optional Python reader (`ndax_reader.py`) uses [NewareNDA](https://github.com/d-cogswell/NewareNDA); Python 3.9+ is required. First setup installs `requirements_ndax.txt` into `.runtime/python`. This reader does not use the legacy compiled executable or NEWARE vendor DLLs. See `README-FIRST.txt`.

Directly opening an HTML file or using static GitHub Pages supports CSV/Excel but cannot run the NDAX parser. The same v1.27.8 interface is used by both entry methods.

Python add-on validation (2026-10-29): six conversion tests and six HTTP bridge tests passed. A locally held NDAX file was also imported through the actual launcher in Edge, retaining all source records and rendering retention and GCD charts without browser errors. The research file is not distributed. Existing Custom Axes and CSV upload browser tests were rerun and passed.

## v1.24.16 palette fix

The Windows launcher also skips occupied local ports automatically, reuses a matching running instance, and verifies the served package before opening the browser. Its default port is 8765; use the URL opened by the launcher if another service already occupies that port. `node launcher-port-test.cjs` checks fallback and reuse without stopping existing services.

Applying a palette updates only checked series and defers chart rendering until all colors have changed. Each affected chart redraws once, avoiding repeated full-data processing and accidental selection of unchecked cycles. Individual swatches remain editable.

`npm test` now includes `palette-test.cjs`, which exercises a 20-cycle synthetic dataset, verifies selection preservation and a single redraw, and checks individual color changes and browser responsiveness.

Validation on 2026-10-29: all three package browser tests and the local API tests passed. A full local NDAX import was also tested on the dQ/dV tab: palette application preserved the selected cycles and caused exactly one redraw. The input data is not distributed.

## v1.24.15 changes and validation

- Parse elapsed durations such as `HH:MM:SS`, fractional seconds, durations over 24 hours, and day-prefixed durations in Custom Axes.
- Refresh column mappings after loading or switching sheets, explicitly show unmapped columns, and report valid data-pair counts.
- Run `npm install`, then `npm test` with Node.js and Microsoft Edge installed. Set `BROWSER_PATH` for a different Chromium executable.
- Both browser test scripts were rerun successfully on 2026-10-29, including synthetic CSV file selection, `[0, 0.5, 1]` hour conversion, unit changes, plot styles, optional Y2, and empty-data diagnostics. No browser page errors were reported.
- Tests use `baseline_v1.24.14.html` and `custom_axes_duration.csv`; generated JSON, SVG, and PNG files are local test outputs. See `REPAIR-NOTES-v1.24.15.md` for historical repair details and limits.

## Data privacy

CSV and Excel processing occurs locally in the browser. These files are not uploaded by this repository. The optional `.ndax` workflow sends the selected file only to the local `/api/ndax` endpoint when the included parser is running.

## Author

**Kuo-Feng King**  
University of Houston  
Yan Yao & Lihong Zhao Laboratories  
Email: [josh622443@gmail.com](mailto:josh622443@gmail.com) · [kking20@cougarnet.uh.edu](mailto:kking20@cougarnet.uh.edu)

## Citation

If you use this software in research, a presentation, or a publication, please cite this repository using GitHub's **Cite this repository** button. A related manuscript is in preparation; citation information will be updated after publication. See [CITATION.md](CITATION.md).

## Known limitations

- `.ndax` needs the local Python launcher; it cannot run on static GitHub Pages. Large files retain all records and need sufficient browser memory.
- The Python add-on is an independent reader. Elapsed time is reconstructed from step durations, and cycle capacities/energies sum active-direction per-step maxima. Consult the `ImportInfo` sheet and compare new instrument/file variants with NEWARE exports.
- `python test_ndax_reader.py` checks units, active mass, step boundaries, partial cycles, missing ratios, and full row retention. `python test_ndax_server.py` checks HTTP integration with synthetic input. These do not establish accuracy for every NDAX format.
- Automated regression tests cover Custom Axes duration parsing, unit conversion, chart controls, and synthetic CSV upload. They do not constitute full application or DRT regression coverage.
- Browser compatibility has not yet been documented systematically.

## License

Licensed under the **PolyForm Noncommercial License 1.0.0**.

Noncommercial academic, educational, research, and personal use is permitted under the license terms. Commercial use requires prior written permission from Kuo-Feng King. Contact [kking20@cougarnet.uh.edu](mailto:kking20@cougarnet.uh.edu) for commercial licensing or other permissions.

Copyright (c) 2026 Kuo-Feng King. See [LICENSE](LICENSE) for the complete terms.

## BioLogic EC-Lab / BT-Lab

- Import tab-separated `.mpt` ASCII exports in the browser or local app. The importer uses the declared header length and accepts decimal commas.
- Open binary `.mpr` with the local Windows or macOS launcher. On first use it installs the optional Galvani reader. If a binary layout is rejected, use EC-Lab to export MPT.
- Check that the plotted columns and axis units match the export. This importer preserves source columns and does not infer cycling statistics. LAND CEX support is limited to the validated 16-byte record layout (05 00 04 00), voltage range E005 and current range C064, with Rest, CC-Rate and DC-Rate steps. Other profiles still require export to a supported tabular format. CEX imports point records only. They preserve the binary clock and use header mass for specific capacity when available.
