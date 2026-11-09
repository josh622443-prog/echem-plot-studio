"""Adapter for the separately installed Galvani EC-Lab reader."""
import json
import math
import sys


def read_mpr(source, destination):
    from galvani.BioLogic import MPRfile

    with open(source, "rb") as stream:
        data = MPRfile(stream).data
    headers = list(data.dtype.names or ())
    if not headers or not len(data):
        raise ValueError("No MPR measurement rows found.")
    with open(destination, "w", encoding="utf-8") as output:
        output.write('{"headers":')
        json.dump(headers, output, ensure_ascii=False)
        output.write(',"rows":[')
        for index, row in enumerate(data):
            if index:
                output.write(",")
            values = {}
            for header in headers:
                value = row[header].item()
                values[header] = None if isinstance(value, float) and not math.isfinite(value) else value
            json.dump(values, output, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        output.write("]}")


if __name__ == "__main__":
    try:
        read_mpr(*sys.argv[1:])
    except ImportError:
        sys.exit("MPR reader is unavailable. Reopen the local launcher while connected to the internet.")
    except Exception as error:
        sys.exit(f"{error}. If this MPR layout is unsupported, export an MPT in EC-Lab.")
