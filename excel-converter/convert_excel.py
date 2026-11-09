"""Create a local Echem Plot Studio workbook from battery cycler exports."""
import argparse
from contextlib import closing
from datetime import timedelta
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unicodedata

ROOT = Path(__file__).resolve().parent
ALIASES = {
    "Cycle Index": "Cycle|Cycle Number|Cycle No|循环序号|循环次数|循环号|循环|周次",
    "Step Index": "Step Number|Step No|工步序号|工步号|工步编号",
    "Step Type": "Step Name|Working Mode|工步类型|工步名称|工步状态|状态",
    "Voltage (V)": "Voltage V|Volt V|U V|Ewe V|电压 V",
    "Voltage (mV)": "Voltage mV|Volt mV|U mV|电压 mV",
    "Current (mA)": "Current mA|I mA|电流 mA",
    "Current (A)": "Current A|I A|电流 A",
    "Test Time (s)": "Test Time s|Total Time s|Elapsed Time s|Time s|总时间 s|测试时间 s",
    "Specific Capacity (mAh/g)": "Specific Capacity mAh/g|Spec Cap mAh/g|比容量 mAh/g",
    "Capacity (mAh)": "Capacity mAh|Cap mAh|容量 mAh",
    "Capacity (Ah)": "Capacity Ah|Cap Ah|容量 Ah",
    "Charge Specific Capacity (mAh/g)": "Charge Specific Capacity mAh/g|Chg Spec Cap mAh/g|充电比容量 mAh/g",
    "Discharge Specific Capacity (mAh/g)": "Discharge Specific Capacity mAh/g|DChg Spec Cap mAh/g|放电比容量 mAh/g",
    "Charge Capacity (mAh)": "Charge Capacity mAh|Chg Cap mAh|充电容量 mAh|充电电量 mAh",
    "Discharge Capacity (mAh)": "Discharge Capacity mAh|DChg Cap mAh|放电容量 mAh|放电电量 mAh",
    "Charge Capacity (Ah)": "Charge Capacity Ah|Chg Cap Ah|充电容量 Ah",
    "Discharge Capacity (Ah)": "Discharge Capacity Ah|DChg Cap Ah|放电容量 Ah",
    "Coulombic Efficiency (%)": "Coulombic Efficiency %|CE %|Chg DChg Eff %|库伦效率 %|库仑效率 %|效率 %",
}
TRADITIONAL = str.maketrans("環號數電壓總試時類稱狀態庫倫侖編", "环号数电压总试时类称状态库伦仑编")


def key(value):
    return re.sub(r"[^\w%]+|_", "", unicodedata.normalize("NFKC", str(value)).translate(TRADITIONAL).casefold())


LOOKUP = {
    key(alias): title
    for title, aliases in ALIASES.items()
    for alias in (title, *aliases.split("|"))
}
VOLTAGE = {"Voltage (V)", "Voltage (mV)"}
SUMMARY_CAPACITY = {name for name in ALIASES if name.startswith("Discharge ")}


def dependencies(source):
    if source.suffix.lower() != ".xlsx":
        raise ValueError("Please export the source as .xlsx.")
    runtime = ROOT / ".runtime"
    sys.path.insert(0, str(runtime))
    try:
        import openpyxl
    except ModuleNotFoundError:
        print("Installing the Excel reader. Internet is needed on first use.", flush=True)
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--target", str(runtime), "openpyxl==3.1.5"],
            check=True,
        )
        import importlib
        importlib.invalidate_caches()
        import openpyxl
    return openpyxl


def find_tables(book):
    candidates = {"record": [], "cycle": []}
    for sheet in book.worksheets:
        with closing(sheet.iter_rows(max_row=50, values_only=True)) as rows:
            for number, row in enumerate(rows, 1):
                mapped = [LOOKUP.get(key(value)) for value in row if value is not None]
                known = set(mapped)
                if known & VOLTAGE and "Cycle Index" in known:
                    candidates["record"].append((sheet, number, row))
                    break
                if "Cycle Index" in known and known & SUMMARY_CAPACITY:
                    candidates["cycle"].append((sheet, number, row))
                    break
    return candidates


def choose(kind, options):
    if len(options) <= 1:
        return options[0] if options else None
    print(f"\nMultiple {kind} tables found. Choose the sheet to export:")
    for index, (sheet, header, _) in enumerate(options, 1):
        print(f"  {index}. {sheet.title} (header row {header})")
    while True:
        answer = input("Number, or 0 to skip: ").strip()
        if answer.isdecimal() and len(answer) <= 5 and int(answer) <= len(options):
            return options[int(answer) - 1] if int(answer) else None


def column_names(row):
    used = set()
    names = []
    for index, value in enumerate(row, 1):
        source = str(value).strip() if value is not None else ""
        name = LOOKUP.get(key(source), source or f"Column {index}")
        if name == "Voltage (mV)":
            name = "Voltage (V)"
        if name.casefold() in used:
            raise ValueError(f"Duplicate column after normalization: {name}. Rename the duplicate in the source.")
        used.add(name.casefold())
        names.append(name)
    return names


def text_cell(sheet, value, make_cell):
    if isinstance(value, str) and value.startswith("="):
        cell = make_cell(sheet, value=value)
        cell.data_type = "s"
        return cell
    return value


def write_table(book, kind, table, make_cell):
    source, header, headings = table
    target = book.create_sheet(kind)
    names = column_names(headings)
    for old, new in zip(headings, names):
        if old is not None and str(old) != new:
            print(f"  {old} -> {new}")
    target.append([text_cell(target, name, make_cell) for name in names])
    from_mv = [LOOKUP.get(key(heading)) == "Voltage (mV)" for heading in headings]
    count = 0
    with closing(source.iter_rows(min_row=header + 1, max_col=len(names), values_only=True)) as rows:
        for row in rows:
            if not any(value is not None for value in row):
                continue
            values = []
            for name, value, scale_voltage in zip(names, row, from_mv):
                if isinstance(value, timedelta) and name == "Test Time (s)":
                    value = value.total_seconds()
                if scale_voltage and value is not None and value != "":
                    value = float(value) / 1000
                values.append(text_cell(target, value, make_cell))
            target.append(values)
            count += 1
    if not count:
        raise ValueError(f"'{source.title}' has a header but no data rows.")
    print(f"  {source.title} -> {kind}: {count:,} rows", flush=True)


def convert(source):
    openpyxl = dependencies(source)
    with closing(openpyxl.load_workbook(source, read_only=True, data_only=True)) as incoming:
        candidates = find_tables(incoming)
        chosen = [(kind, choose(kind, candidates[kind])) for kind in ("cycle", "record")]
        chosen = [(kind, table) for kind, table in chosen if table is not None]
        if not chosen:
            raise ValueError(
                "No recognizable table found. Export individual point records with cycle and voltage (V/mV), "
                "or cycle statistics with cycle and unit-labeled discharge capacity. Header must be in the first 50 rows."
            )
        if len(chosen) == 1:
            print(f"Only '{chosen[0][0]}' will be written. The other table was not found or was skipped.")
        output = openpyxl.Workbook(write_only=True)
        with tempfile.TemporaryDirectory(prefix=".echem-", dir=source.parent) as temp:
            staging = Path(temp) / "workbook.xlsx"
            for kind, table in chosen:
                write_table(output, kind, table, openpyxl.cell.WriteOnlyCell)
            output.save(staging)
            index = 1
            while True:
                suffix = "" if index == 1 else f" ({index})"
                final = source.with_name(f"{source.stem}_Echem{suffix}.xlsx")
                try:
                    # Windows rename is atomic and refuses to replace an existing file.
                    staging.rename(final)
                    return final
                except FileExistsError:
                    index += 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", type=Path)
    args = parser.parse_args()
    source = args.source
    if source is None:
        import tkinter as tk
        from tkinter import filedialog
        window = tk.Tk()
        window.withdraw()
        try:
            filename = filedialog.askopenfilename(title="Choose a Neware or LAND Excel export", filetypes=[("Excel workbook", "*.xlsx")])
        finally:
            window.destroy()
        if not filename:
            return 0
        source = Path(filename)
    try:
        final = convert(source.resolve(strict=True))
        print(f"\nDone. Open this file in Echem Plot Studio:\n{final}")
        return 0
    except Exception as error:
        print(f"\nConversion failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
