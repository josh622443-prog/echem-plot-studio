ECHEM PLOT STUDIO — SOURCE-BASED FOLDER PACKAGE
================================================

Purpose
-------
This package avoids distributing the standalone EchemPlotStudio.exe.
The NDAX reader is compiled locally from the included C# source when the
application is first started.

Requirements
------------
1. Windows 10 or Windows 11
2. NEWARE BTSClient80 / BTSDA installed
3. Python 3.7 or newer (64-bit recommended)
4. Microsoft .NET Framework 4.x

How to start
------------
1. Copy this entire folder to any location.
2. Double-click "Start Echem Plot Studio.cmd".
3. If BTSDA is not detected, select its installation folder. The selected
   folder must contain BTSDALib.dll, Common.dll, CommonCtrl.dll, and Newtonsoft.Json.dll.
4. Your default browser opens to http://127.0.0.1:8765/.
5. Keep the command window open while using the application.
6. Close the command window when finished.

If double-click is blocked
--------------------------
Open PowerShell in this folder and run:

  powershell -ExecutionPolicy Bypass -File .\start_source_package.ps1

Security note
-------------
No prebuilt custom EXE is included in this folder. On first launch, Windows'
own .NET compiler builds NdaxJsonExtractor.exe from NdaxJsonExtractor.cs and
stores it under:

  .runtime (inside this package folder)

This launcher serves Echem_Plot_Studio_v1.24.15.html. Do not open the HTML
directly when importing NDAX files. Vendor DLLs and research data are not bundled.
The package folder must be writable for the first local compilation.

Some institutional security policies may also block locally compiled programs.
In that case, your IT administrator must approve the application or its source.
