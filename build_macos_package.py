"""Build the macOS ZIP with the launcher's executable bit preserved."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent
VERSION = "1.27.0"
HTML = f"Echem_Plot_Studio_v{VERSION}.html"
LAUNCHER = "Start Echem Plot Studio.command"
FILES = (
    "index.html", HTML, "data-copy.js", LAUNCHER, "START-MACOS.txt",
    "ndax_reader.py", "ndax_api_server.py", "requirements_ndax.txt",
    "origin_export.py", "LICENSE", "THIRD-PARTY-NOTICES.md", "CITATION.cff",
)

if __name__ == "__main__":
    if (ROOT / "index.html").read_bytes() != (ROOT / HTML).read_bytes():
        raise SystemExit("Current HTML and index.html differ.")
    output = ROOT / "downloads" / f"Echem-Plot-Studio-v{VERSION}-macOS.zip"
    output.parent.mkdir(exist_ok=True)
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        for name in FILES:
            entry = ZipInfo(f"Echem-Plot-Studio-v{VERSION}-macOS/{name}")
            entry.create_system = 3  # Store Unix permissions on any build host.
            entry.external_attr = (0o100755 if name == LAUNCHER else 0o100644) << 16
            data = (ROOT / name).read_bytes()
            if name == LAUNCHER:
                data = data.replace(b"\r\n", b"\n")
            archive.writestr(entry, data, compress_type=ZIP_DEFLATED)
    print(output)
