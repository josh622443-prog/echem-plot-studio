"""Select a verified local package directory for the current Python interpreter."""
import argparse
import os
from pathlib import Path
import sys
import sysconfig
import uuid

ROOT = Path(__file__).resolve().parent / ".runtime"
POINTER = ROOT / f"active-{sys.implementation.cache_tag}-{sysconfig.get_platform()}.txt"


def checked_directory(value):
    directory = Path(value).resolve()
    if directory.parent != ROOT.resolve() or not directory.is_dir():
        raise ValueError("The package directory must be an existing folder directly under .runtime.")
    return directory


def package_directory():
    staging = os.environ.get("ECHEM_RUNTIME_PACKAGES")
    if staging:
        return checked_directory(staging)
    if POINTER.exists():
        name = POINTER.read_text(encoding="utf-8").strip()
        if Path(name).name != name:
            raise ValueError("Invalid local package selection.")
        return checked_directory(ROOT / name)
    return ROOT / "python"


def activate_packages():
    directory = package_directory()
    if directory.is_dir():
        sys.path.insert(0, str(directory))
    return directory


def save_selection(directory):
    directory = checked_directory(directory)
    ROOT.mkdir(exist_ok=True)
    temporary = ROOT / f"selection-{uuid.uuid4().hex}.tmp"
    try:
        temporary.write_text(directory.name, encoding="utf-8")
        os.replace(temporary, POINTER)
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--activate", type=Path)
    args = parser.parse_args()
    if args.activate:
        save_selection(args.activate)
    print(package_directory())
