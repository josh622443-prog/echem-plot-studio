# Echem Plot Studio

Browser-based electrochemical data visualization and analysis tool for CSV and Excel data. The current release includes cycle-life, retention, charge/discharge, dQ/dV, rate-performance, EIS/Nyquist, multi-cell comparison, and integrated DRT analysis workflows.

## Current release

Version **1.24.15** (2026-10-08)

## Run the tool

Download `index.html` or `Echem_Plot_Studio_v1.24.15.html` and open it in a modern desktop browser. These files contain the same application. An internet connection is required when the page first loads because third-party browser libraries and fonts are loaded from CDNs.

Supported directly in the browser:

- `.csv`
- `.xlsx`
- `.xls`

The interface also accepts `.ndax`, but that proprietary binary format requires a separate local parsing server and BTSDA dependency that are **not included in this release**. Consequently, `.ndax` import does not work from a static GitHub Pages deployment. Convert the data to Excel/CSV first unless you have the local parser package.

## v1.24.15 changes and validation

- Parse elapsed durations such as `HH:MM:SS`, fractional seconds, durations over 24 hours, and day-prefixed durations in Custom Axes.
- Refresh column mappings after loading or switching sheets, explicitly show unmapped columns, and report valid data-pair counts.
- Run `npm install`, then `npm test` with Node.js and Microsoft Edge installed. Set `BROWSER_PATH` for a different Chromium executable.
- Both browser test scripts were rerun successfully on 2026-10-29, including synthetic CSV file selection, `[0, 0.5, 1]` hour conversion, unit changes, plot styles, optional Y2, and empty-data diagnostics. No browser page errors were reported.
- Tests use `baseline_v1.24.14.html` and `custom_axes_duration.csv`; generated JSON, SVG, and PNG files are local test outputs. See `REPAIR-NOTES-v1.24.15.md` for historical repair details and limits.

## Data privacy

CSV and Excel processing occurs locally in the browser. These files are not uploaded by this repository. The optional `.ndax` workflow sends the selected file only to a local `/api/ndax` endpoint when that separately supplied parser is running.

## Author

**Kuo-Feng King**  
University of Houston  
Yan Yao & Lihong Zhao Laboratories  
Email: [josh622443@gmail.com](mailto:josh622443@gmail.com) · [kking20@cougarnet.uh.edu](mailto:kking20@cougarnet.uh.edu)

## Citation

If you use this software in research, a presentation, or a publication, please cite this repository using GitHub's **Cite this repository** button. A related manuscript is in preparation; citation information will be updated after publication. See [CITATION.md](CITATION.md).

## Known limitations

- The `.ndax` local parser/server is not included.
- Automated regression tests cover Custom Axes duration parsing, unit conversion, chart controls, and synthetic CSV upload. They do not constitute full application or DRT regression coverage.
- Browser compatibility has not yet been documented systematically.

## License

Licensed under the **PolyForm Noncommercial License 1.0.0**.

Noncommercial academic, educational, research, and personal use is permitted under the license terms. Commercial use requires prior written permission from Kuo-Feng King. Contact [kking20@cougarnet.uh.edu](mailto:kking20@cougarnet.uh.edu) for commercial licensing or other permissions.

Copyright (c) 2026 Kuo-Feng King. See [LICENSE](LICENSE) for the complete terms.
