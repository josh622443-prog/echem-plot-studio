"""Create a native OPJU through a separate Origin automation session."""
import argparse
from collections import OrderedDict
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent


class OriginUnavailable(RuntimeError):
    pass


def find_origin_executable():
    if sys.platform != 'win32':
        raise OriginUnavailable('Native OPJU export requires Windows and an installed, licensed Origin.')
    candidates = [os.environ.get('ECHEM_ORIGIN_EXE', '')]
    settings = ROOT / 'origin_executable.txt'
    if settings.is_file():
        candidates.append(settings.read_text(encoding='utf-8-sig').strip())
    for drive in ['C', 'D', 'E', 'F']:
        for year in [2026, 2025, 2024, 2023, 2022, 2021]:
            for prefix in ['Program Files/OriginLab', 'OriginLab']:
                candidates.append('%s:/%s/Origin%s/Origin64.exe' % (drive, prefix, year))
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate).resolve()
    raise OriginUnavailable('Origin was not found. Put the full Origin64.exe path in origin_executable.txt in this folder.')


def run_origin_script(script, timeout=300):
    executable = find_origin_executable()
    script_path = str(Path(script).resolve()).replace(chr(92), '/')
    if any(char in script_path for char in ['"', '\n', '\r']):
        raise ValueError('Unsupported characters in the Origin script path.')
    startup = subprocess.STARTUPINFO()
    startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startup.wShowWindow = 0
    # Origin consumes the raw remainder after -rs as LabTalk, not one C-quoted
    # argv token. No shell is used and script_path is a generated local path.
    command = '"' + str(executable) + '" -hs -rs run -pyf "' + script_path + '";'
    result = subprocess.run(command, executable=str(executable),
                            cwd=str(ROOT), startupinfo=startup, capture_output=True,
                            text=True, encoding='utf-8', errors='replace', timeout=timeout)
    if result.returncode:
        raise RuntimeError('The separate Origin process exited with code %s.' % result.returncode)


def validate(payload):
    if not isinstance(payload, dict):
        raise ValueError('Expected a JSON object.')
    headers, rows, plots = payload.get('headers'), payload.get('rows'), payload.get('plots', [])
    if not isinstance(headers, list) or not headers or len(headers) > 128 or not all(isinstance(h, str) for h in headers):
        raise ValueError('Expected 1–128 text column headers.')
    if not isinstance(rows, list) or not rows or len(rows) > 1000000:
        raise ValueError('Expected 1–1,000,000 data rows.')
    for row in rows:
        if not isinstance(row, list) or len(row) != len(headers):
            raise ValueError('Every data row must match the column count.')
        for value in row:
            if value is not None and not isinstance(value, (str, int, float, bool)):
                raise ValueError('Cells must be scalar values.')
            if isinstance(value, (int, float)) and not math.isfinite(value):
                raise ValueError('Non-finite numbers must be represented as null.')
    if not isinstance(plots, list) or len(plots) > 8:
        raise ValueError('A page may export at most eight graphs.')
    for plot in plots:
        if not isinstance(plot, dict) or plot.get('kind', 'line') not in ('line', 'scatter'):
            raise ValueError('Invalid graph type.')
        for column in [plot.get('x'), plot.get('y'), *plot.get('group', []), *([plot['segment']] if 'segment' in plot else [])]:
            if type(column) is not int or not 0 <= column < len(headers):
                raise ValueError('Invalid graph column index.')
        for match in plot.get('filter', []):
            column = match.get('column')
            if type(column) is not int or not 0 <= column < len(headers) or not isinstance(match.get('value'), (str, int, float, bool, type(None))):
                raise ValueError('Invalid graph row filter.')
    return headers, rows, plots


def numeric(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def grouped_curves(rows, plot):
    curves = OrderedDict()
    for row in rows:
        if any(row[match['column']] != match['value'] for match in plot.get('filter', [])):
            continue
        x, y = row[plot['x']], row[plot['y']]
        if not numeric(x) and not numeric(y):
            continue
        x = x if numeric(x) and (not plot.get('logX') or x > 0) else None
        y = y if numeric(y) and (not plot.get('logY') or y > 0) else None
        key = tuple(row[column] for column in plot.get('group', []))
        curve = curves.setdefault(key, {'x': [], 'y': [], 'label': ' / '.join(str(v) for v in key) or 'Data', 'segment': None, 'valid': False})
        if 'segment' in plot and curve['segment'] is not None and curve['segment'] != row[plot['segment']]:
            curve['x'].append(None)
            curve['y'].append(None)
        if 'segment' in plot:
            curve['segment'] = row[plot['segment']]
        curve['x'].append(x)
        curve['y'].append(y)
        curve['valid'] = curve['valid'] or (x is not None and y is not None)
    return OrderedDict((key, curve) for key, curve in curves.items() if curve['valid'])


def write_project(payload, output, op):
    headers, rows, plots = validate(payload)
    output = Path(output).resolve()
    if output.suffix.lower() != '.opju':
        raise ValueError('The native project filename must end in .opju.')
    if output.exists():
        raise ValueError('Refusing to overwrite an existing project file.')
    graph_count = 0
    try:
        # This runs only inside the new command-line Origin process.
        op.new()
        book = op.new_book('w', lname=str(payload.get('title', 'Echem data'))[:120])
        if book is None:
            raise RuntimeError('Origin could not create the workbook.')
        sheet = book[0]
        sheet.name = 'SourceData'
        sheet.cols = len(headers)
        for column, header in enumerate(headers):
            values = [row[column] for row in rows]
            if all(value is None or numeric(value) for value in values):
                values = [float('nan') if value is None else value for value in values]
            else:
                values = ['' if value is None else value for value in values]
            sheet.from_list(column, values, lname=header, axis='N')
        data_sheet = None
        next_column = 0
        for index, plot in enumerate(plots):
            curves = grouped_curves(rows, plot)
            if not curves:
                continue
            if data_sheet is None:
                data_sheet = book.add_sheet('Data')
            data_sheet.cols = next_column + len(curves) * 2
            graph = op.new_graph(lname=str(plot.get('title', payload.get('title', 'Graph')))[:120])
            if graph is None:
                raise RuntimeError('Origin could not create the editable graph.')
            layer = graph[0]
            for curve_index, (key, curve) in enumerate(curves.items()):
                xcol, ycol = next_column, next_column + 1
                next_column += 2
                xs = [float('nan') if x is None else x for x in curve['x']]
                ys = [float('nan') if y is None else y for y in curve['y']]
                label = ' / '.join(headers[column] + ' ' + str(key[i]) for i, column in enumerate(plot.get('group', []))) or str(plot.get('title', 'Data'))
                data_sheet.from_list(xcol, xs, lname=label + ' | X: ' + (plot.get('xLabel') or headers[plot['x']]), axis='X')
                data_sheet.from_list(ycol, ys, lname=label + ' | Y: ' + (plot.get('yLabel') or headers[plot['y']]), axis='Y')
                origin_plot = layer.add_plot(data_sheet, coly=ycol, colx=xcol, type='s' if plot.get('kind') == 'scatter' else 'l')
                color = (plot.get('colors') or {}).get(str(key[0])) if key else None
                if isinstance(color, str) and re.fullmatch(r'#[0-9a-fA-F]{6}', color):
                    origin_plot.color = color
            layer.axis('x').title = plot.get('xLabel') or headers[plot['x']]
            layer.axis('y').title = plot.get('yLabel') or headers[plot['y']]
            if plot.get('logX'):
                layer.xscale = 'log10'
            if plot.get('logY'):
                layer.yscale = 'log10'
            layer.rescale()
            graph_count += 1
        if not op.save(str(output)) or not output.is_file() or output.stat().st_size == 0:
            raise RuntimeError('Origin did not create a project file.')
        return {'rows': len(rows), 'columns': len(headers), 'graphs': graph_count}
    except Exception as error:
        raise RuntimeError('Origin export failed. Confirm Origin is installed, licensed, and able to start. ' + str(error)) from error


def export_native(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    validate(json.loads(source.read_text(encoding='utf-8')))
    if output.exists() or output.suffix.lower() != '.opju':
        raise ValueError('Choose a new .opju output filename.')
    with tempfile.TemporaryDirectory(prefix='echem-origin-run-') as directory:
        script, report = Path(directory) / 'export.py', Path(directory) / 'result.json'
        script.write_text('''import json, sys, traceback
from pathlib import Path
import originpro as op
sys.path.insert(0, %r)
try:
    from origin_export import write_project
    payload = json.loads(Path(%r).read_text(encoding='utf-8'))
    result = write_project(payload, %r, op)
    Path(%r).write_text(json.dumps({'ok': True, 'result': result}), encoding='utf-8')
except Exception as error:
    Path(%r).write_text(json.dumps({'ok': False, 'error': str(error), 'traceback': traceback.format_exc()}), encoding='utf-8')
finally:
    op.lt_exec('doc -s; exit;')
''' % (str(ROOT), str(source), str(output), str(report), str(report)), encoding='utf-8')
        run_origin_script(script)
        if not report.is_file():
            raise RuntimeError('Origin did not run the export script. Confirm its built-in Python is installed and Origin can start normally.')
        result = json.loads(report.read_text(encoding='utf-8'))
        if not result.get('ok'):
            raise RuntimeError(result.get('error', 'Origin export failed.'))
        if not output.is_file() or output.stat().st_size == 0:
            raise RuntimeError('Origin did not create a project file.')
        return result['result']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', nargs='?')
    parser.add_argument('output', nargs='?')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        executable = find_origin_executable()
        print(json.dumps({'available': True, 'backend': 'Origin command-line / embedded Python', 'executable': str(executable)}))
        return
    if not args.input or not args.output:
        parser.error('Provide input.json and output.opju.')
    print(json.dumps(export_native(args.input, args.output)))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
