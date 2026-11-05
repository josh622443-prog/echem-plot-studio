#!/bin/bash
set -e

cd -- "$(dirname -- "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
venv_python="$PWD/.runtime/macos-venv/bin/python"

if [ ! -x "$venv_python" ]; then
  python_bin="${ECHEM_PYTHON:-python3}"
  if ! "$python_bin" -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
    printf '%s\n' 'Install Python 3.10 or newer from https://www.python.org/downloads/macos/ and reopen this launcher.' >&2
    exit 1
  fi
  "$python_bin" -m venv "$PWD/.runtime/macos-venv"
fi

if ! "$venv_python" ndax_reader.py --check >/dev/null 2>&1; then
  printf '%s\n' 'Installing local NDAX dependencies. First setup requires internet access.'
  "$venv_python" -m pip install --only-binary=:all: --disable-pip-version-check -r requirements_ndax.txt
  "$venv_python" ndax_reader.py --check
fi

exec "$venv_python" ndax_api_server.py --port 0 --open
