# Echem Plot Studio

Browser-based electrochemical data visualization and analysis tool for CSV and Excel data. The current release includes cycle-life, retention, charge/discharge, dQ/dV, rate-performance, EIS/Nyquist, multi-cell comparison, and integrated DRT analysis workflows.

## Current release

Version **1.26.0** (2026-10-29)

## Run the tool

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

Download `index.html` or `Echem_Plot_Studio_v1.26.0.html` and open it in a modern desktop browser. These files contain the same application. An internet connection is required when the page first loads because third-party browser libraries and fonts are loaded from CDNs.

Supported directly in the browser:

- `.csv`
- `.xlsx`
- `.xls`

For `.ndax` import on Windows, download the whole repository and double-click **`Start Echem Plot Studio.cmd`**. Keep its command window open and use the page it opens at `http://127.0.0.1:8765/`. The optional Python reader (`ndax_reader.py`) uses [NewareNDA](https://github.com/d-cogswell/NewareNDA); Python 3.9+ is required. First setup installs `requirements_ndax.txt` into `.runtime/python`. This reader does not use the legacy compiled executable or NEWARE vendor DLLs. See `README-FIRST.txt`.

Directly opening an HTML file or using static GitHub Pages supports CSV/Excel but cannot run the NDAX parser. The same v1.26.0 interface is used by both entry methods.

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
