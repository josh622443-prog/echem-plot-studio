# Optional Python NDAX dependencies

The Python add-on uses [NewareNDA 2026.6.11](https://pypi.org/project/NewareNDA/2026.6.11/) by Daniel Cogswell / SES AI, under the BSD 3-Clause license. Source: https://github.com/d-cogswell/NewareNDA . NewareNDA is independent of NEWARE's official BTSDA software.

Dependencies are installed locally from `requirements_ndax.txt`; they are not copied into this repository. Their original license notices are retained in the installed package metadata under `.runtime/python`. NewareNDA also depends on pandas and xmltodict; their respective licenses apply to those packages.

The original Echem Plot Studio license in `LICENSE` is unchanged. No vendor DLLs, compiled reader executables, or research data are distributed by this add-on.

Native OPJU export uses the user's separately installed, licensed Origin and its built-in Python/originpro API. Origin, its Python runtime and its proprietary libraries are not bundled. The exporter invokes the documented Origin command-line interface in a separate process; no external OriginExt package is required.

## Optional BioLogic MPR parser

The local launcher can install datalab-org-galvani 0.6.0 (GPL-3.0-or-later) from PyPI. It runs in a separate parsing process and is not bundled in the distribution. Source and license: https://github.com/datalab-org/galvani-mirror/tree/v0.6.0.
