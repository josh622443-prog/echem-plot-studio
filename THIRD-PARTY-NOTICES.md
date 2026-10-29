# Optional Python NDAX dependencies

The Python add-on uses [NewareNDA 2026.6.11](https://pypi.org/project/NewareNDA/2026.6.11/) by Daniel Cogswell / SES AI, under the BSD 3-Clause license. Source: https://github.com/d-cogswell/NewareNDA . NewareNDA is independent of NEWARE's official BTSDA software.

Dependencies are installed locally from `requirements_ndax.txt`; they are not copied into this repository. Their original license notices are retained in the installed package metadata under `.runtime/python`. NewareNDA also depends on pandas and xmltodict; their respective licenses apply to those packages.

The original Echem Plot Studio license in `LICENSE` is unchanged. No vendor DLLs, compiled reader executables, or research data are distributed by this add-on.
