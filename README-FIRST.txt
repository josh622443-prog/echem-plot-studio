ECHEM PLOT STUDIO v1.26.0 - PYTHON NDAX ADD-ON
================================================

Start
-----
Double-click "Start Echem Plot Studio.cmd" and use the page it opens at
http://127.0.0.1:8765/ by default. If that port is occupied by another package
or application, the launcher automatically chooses another available local port
and opens its actual URL. It does not stop existing services. Launching the same
package again reuses its current service. Keep the launcher window open while using NDAX.
Opening the HTML directly still supports CSV/Excel, but not the NDAX API.

Requirements
------------
Python 3.9 or newer. The launcher looks for an installed Python and installs
requirements_ndax.txt into this folder's .runtime/python on first use.
First setup needs internet and a writable package folder. Parsing is local.
No NEWARE BTSDA installation, .NET compiler, or custom EXE is required by
the Python reader. The older C# reader source is retained for reference.

Standalone reader
-----------------
python ndax_reader.py input.ndax output.json --mass-g 0.04563
python ndax_reader.py --check

Install manually if needed:
python -m pip install --target .runtime/python -r requirements_ndax.txt

Data and calculations
---------------------
NewareNDA is an independent parser, not the official NEWARE reader.
All input records are retained; no automatic downsampling is performed.
Large files can take time and memory to import. The ImportInfo sheet records
the mass, row count, time basis, and cycle-statistics assumptions.
Elapsed time sums step-relative time, excluding unrecorded wall-clock pauses.
Cycle statistics sum each step's active-direction capacity/energy maxima.
Check numerical units and cycle totals against a NEWARE export before using
a new instrument/file variant for quantitative conclusions.
Changing active mass requires importing the NDAX file again.

Tests
-----
python test_ndax_reader.py
python test_ndax_server.py
python test_origin_export.py
npm test
node launcher-port-test.cjs (Windows: occupied-port fallback and instance reuse)

No research data, vendor DLLs, or compiled executables are published.

Origin projects and clipboard columns (v1.26.0)
---------------------------------------------
Copy data defaults to one X/Y column pair per cycle, with blank padding and
segment gaps. Select Table rows for the older long table. Include headers can
be unchecked to paste numeric data only. In Origin, designate pasted columns
XY XY. Export OPJU sets the column roles automatically and creates editable
basic graphs plus the original source table.

Native export needs installed/licensed Origin with its bundled Python (tested
with Origin 2024). If it is not found, put the full Origin64.exe path in a local
origin_executable.txt. No registry changes or extra Origin Python packages are
needed. Export uses a new hidden Origin process and does not attach to an
existing project. All parsing and export remain on this computer.
The NewareNDA dependency and its license remain under .runtime/python;
see THIRD-PARTY-NOTICES.md. The project's original LICENSE is unchanged.
