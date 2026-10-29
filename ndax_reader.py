#!/usr/bin/env python3
"""Read NDAX with NewareNDA and write the workbook consumed by Echem Studio.

No vendor DLLs, compiled reader, or network requests are used during parsing.
Record rows are retained in full. Time is reconstructed from step-relative
seconds; capacities and energies are summed from per-step counter maxima.
"""
import argparse
import json
import math
from pathlib import Path
import sys
import zipfile

LOCAL_PACKAGES = Path(__file__).resolve().parent / '.runtime' / 'python'
if LOCAL_PACKAGES.is_dir():
    sys.path.insert(0, str(LOCAL_PACKAGES))


def check_dependencies():
    import NewareNDA
    import pandas
    import xmltodict
    return {'reader': 'newarenda-python', 'NewareNDA': NewareNDA.__version__, 'pandas': pandas.__version__}


def build_workbook(data, mass_g):
    import numpy as np
    import pandas as pd
    if not math.isfinite(mass_g) or mass_g <= 0:
        raise ValueError('Active material mass must be finite and positive (g).')
    columns = ['Index', 'Cycle', 'Step', 'Status', 'Time', 'Voltage', 'Current(mA)',
               'Charge_Capacity(mAh)', 'Discharge_Capacity(mAh)',
               'Charge_Energy(mWh)', 'Discharge_Energy(mWh)']
    missing = set(columns) - set(data.columns)
    if missing or data.empty:
        raise ValueError('No usable records, or missing fields: ' + ', '.join(sorted(missing)))
    data = data[columns].copy()
    numeric = [c for c in columns if c != 'Status']
    if not np.isfinite(data[numeric].to_numpy(dtype=float)).all():
        raise ValueError('NDAX contains missing or non-finite required numeric values.')
    if not data['Index'].is_monotonic_increasing:
        raise ValueError('NDAX record indices are not in ascending order.')
    if (data['Time'] < 0).any():
        raise ValueError('Negative step elapsed time in NDAX.')

    # Each contiguous step starts its own elapsed-time counter.
    boundary = data['Step'].ne(data['Step'].shift()) | data['Cycle'].ne(data['Cycle'].shift())
    delta = data['Time'].astype(float).diff().where(~boundary, data['Time'])
    if (delta < -1e-5).any():
        raise ValueError('Step elapsed time decreases within a step.')
    elapsed_h = delta.clip(lower=0).cumsum() / 3600.0
    discharge = data['Current(mA)'] < 0
    charge = data['Current(mA)'] > 0
    capacity = data['Charge_Capacity(mAh)'].where(~discharge, data['Discharge_Capacity(mAh)']).abs()
    capacity = capacity.where(charge | discharge, 0)
    record = pd.DataFrame({
        'Cycle Index': data['Cycle'].astype('int64'),
        'Total Time (h)': elapsed_h,
        'Step Index': data['Step'].astype('int64'),
        'Step Type': data['Status'].astype(str),
        'Voltage (V)': data['Voltage'].astype(float),
        'Current (A)': data['Current(mA)'].astype(float) / 1000,
        'Specific Capacity (mAh/g)': capacity / mass_g,
    })

    # Exclude inactive counters carried through rest or opposite-direction steps.
    counters = data[['Cycle', 'Step']].copy()
    for column, active in [('Charge_Capacity(mAh)', charge), ('Discharge_Capacity(mAh)', discharge),
                           ('Charge_Energy(mWh)', charge), ('Discharge_Energy(mWh)', discharge)]:
        counters[column] = data[column].abs().where(active, 0)
    totals = counters.groupby(['Cycle', 'Step'], sort=False).max().groupby(level=0, sort=False).sum()
    cq, dq = totals['Charge_Capacity(mAh)'], totals['Discharge_Capacity(mAh)']
    first_d = dq[dq > 0].iloc[0] if (dq > 0).any() else float('nan')
    cycle = pd.DataFrame({
        'Cycle Index': totals.index.astype('int64'),
        'Charge Specific Capacity (mAh/g)': cq.to_numpy() / mass_g,
        'Discharge Specific Capacity (mAh/g)': dq.to_numpy() / mass_g,
        'Coulombic Efficiency (%)': (dq / cq.where(cq > 0) * 100).to_numpy(),
        'Capacity Retention (%)': (dq / first_d * 100).to_numpy(),
        'Charge Capacity (Ah)': cq.to_numpy() / 1000,
        'Discharge Capacity (Ah)': dq.to_numpy() / 1000,
        'Charge Energy (Wh)': totals['Charge_Energy(mWh)'].to_numpy() / 1000,
        'Discharge Energy (Wh)': totals['Discharge_Energy(mWh)'].to_numpy() / 1000,
    })
    info = pd.DataFrame([
        {'Setting': 'Parser', 'Value': 'NewareNDA (independent reader; not NEWARE BTSDA)'},
        {'Setting': 'Source records / displayed records', 'Value': '%s / %s (no downsampling)' % (len(data), len(record))},
        {'Setting': 'Active mass (g)', 'Value': str(mass_g)},
        {'Setting': 'Time basis', 'Value': 'Sum step-relative elapsed seconds; excludes unrecorded wall-clock pauses.'},
        {'Setting': 'Cycle statistics', 'Value': 'Sum per-step active-direction capacity/energy counter maxima. Partial cycles are included.'},
        {'Setting': 'Missing ratios', 'Value': 'Unavailable CE or retention is null, not zero.'},
        {'Setting': 'Validation', 'Value': 'Verify units and cycle totals against NEWARE exports for each instrument/file variant.'},
    ])
    return {'Cycle': cycle, 'Record': record, 'ImportInfo': info}


def read_ndax(path, mass_g):
    import NewareNDA
    with zipfile.ZipFile(path) as archive:
        if 'data.ndc' not in archive.namelist():
            raise ValueError('NDAX archive does not contain data.ndc.')
        # Bound expanded input before the third-party reader extracts members.
        if sum(item.file_size for item in archive.infolist()) > 4 * 1024**3:
            raise ValueError('Expanded NDAX is larger than 4 GiB.')
    return build_workbook(NewareNDA.read(str(path)), mass_g)


def write_workbook(sheets, output, filename, mass_g):
    # Write dataframe JSON directly, without a second list of millions of dicts.
    with Path(output).open('w', encoding='utf-8') as stream:
        metadata = {'fileName': filename, 'massG': mass_g, 'reader': 'newarenda-python',
                    'sourceRecords': len(sheets['Record']), 'sheetNames': list(sheets)}
        stream.write(json.dumps(metadata, ensure_ascii=False)[:-1] + ',"sheets":{')
        for index, (name, frame) in enumerate(sheets.items()):
            if index:
                stream.write(',')
            stream.write(json.dumps(name) + ':{"headers":' + json.dumps(list(frame.columns)) + ',"rows":')
            frame.to_json(stream, orient='records', double_precision=10, force_ascii=False)
            stream.write('}')
        stream.write('}}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', nargs='?')
    parser.add_argument('output', nargs='?')
    parser.add_argument('--mass-g', type=float, default=0.04563)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        print(json.dumps(check_dependencies()))
        return
    if not args.input or not args.output:
        parser.error('Provide input.ndax and output.json, or use --check.')
    sheets = read_ndax(Path(args.input), args.mass_g)
    write_workbook(sheets, args.output, Path(args.input).name, args.mass_g)
    print(json.dumps({'records': len(sheets['Record']), 'cycles': len(sheets['Cycle'])}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('%s: %s' % (type(error).__name__, error), file=sys.stderr)
        sys.exit(1)
