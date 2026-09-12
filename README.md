# Echem Plot Studio

Browser-based electrochemical data visualization and analysis tool for CSV and Excel data. The current release includes cycle-life, retention, charge/discharge, dQ/dV, rate-performance, EIS/Nyquist, multi-cell comparison, and integrated DRT analysis workflows.

## Current release

Version **1.24.6** (2026-09-12)

## Run the tool

Download `index.html` and open it in a modern desktop browser. An internet connection is required when the page first loads because third-party browser libraries and fonts are loaded from CDNs.

Supported directly in the browser:

- `.csv`
- `.xlsx`
- `.xls`

The interface also accepts `.ndax`, but that proprietary binary format requires a separate local parsing server and BTSDA dependency that are **not included in this release**. Consequently, `.ndax` import does not work from a static GitHub Pages deployment. Convert the data to Excel/CSV first unless you have the local parser package.

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
- Automated tests and sample datasets are not yet included.
- Browser compatibility has not yet been documented systematically.

## License

MIT License. Copyright (c) 2026 Kuo-Feng King.
