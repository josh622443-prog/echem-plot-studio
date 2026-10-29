import json
from pathlib import Path
import tempfile
import unittest
from ndax_reader import build_workbook, write_workbook
import pandas as pd


def fixture():
    rows = [
        [1, 1, 1, 'CC_Chg', 0, 3, 1, 0, 0, 0, 0],
        [2, 1, 1, 'CC_Chg', 3600, 4, 1, 2, 0, 7, 0],
        [3, 1, 2, 'CV_Chg', 600, 4, .5, .5, 0, 2, 0],
        [4, 1, 3, 'CC_DChg', 3600, 3, -1, 0, 1.5, 0, 5],
        [5, 1, 4, 'Rest', 60, 3, 0, .5, 1.5, 2, 5],
        [6, 2, 5, 'CC_DChg', 1800, 3, -1, 0, 1, 0, 3],
    ]
    return pd.DataFrame(rows, columns=['Index', 'Cycle', 'Step', 'Status', 'Time', 'Voltage', 'Current(mA)',
                                      'Charge_Capacity(mAh)', 'Discharge_Capacity(mAh)', 'Charge_Energy(mWh)', 'Discharge_Energy(mWh)'])


class ReaderTests(unittest.TestCase):
    def test_units_step_sums_and_rest_exclusion(self):
        sheets = build_workbook(fixture(), .1)
        cycle = sheets['Cycle'].iloc[0]
        self.assertAlmostEqual(cycle['Charge Specific Capacity (mAh/g)'], 25)
        self.assertAlmostEqual(cycle['Discharge Specific Capacity (mAh/g)'], 15)
        self.assertAlmostEqual(cycle['Coulombic Efficiency (%)'], 60)
        self.assertAlmostEqual(cycle['Discharge Capacity (Ah)'], .0015)
        self.assertAlmostEqual(cycle['Charge Energy (Wh)'], .009)
        self.assertAlmostEqual(sheets['Record'].iloc[3]['Current (A)'], -.001)
        self.assertAlmostEqual(sheets['Record'].iloc[4]['Total Time (h)'], 7860/3600)
        self.assertEqual(sheets['Record'].iloc[4]['Specific Capacity (mAh/g)'], 0)

    def test_mass_changes_specific_capacity_only(self):
        small, large = build_workbook(fixture(), .1), build_workbook(fixture(), .2)
        self.assertAlmostEqual(small['Cycle'].iloc[0]['Charge Specific Capacity (mAh/g)'], 2*large['Cycle'].iloc[0]['Charge Specific Capacity (mAh/g)'])
        self.assertEqual(small['Cycle'].iloc[0]['Charge Capacity (Ah)'], large['Cycle'].iloc[0]['Charge Capacity (Ah)'])

    def test_missing_ratios_are_json_null(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'synthetic.json'
            write_workbook(build_workbook(fixture(), .1), output, 'fixture.ndax', .1)
            result = json.loads(output.read_text(encoding='utf-8'))
        self.assertIsNone(result['sheets']['Cycle']['rows'][1]['Coulombic Efficiency (%)'])
        self.assertEqual(len(result['sheets']['Record']['rows']), 6)
        self.assertEqual(result['sourceRecords'], 6)

    def test_no_downsampling(self):
        data = pd.concat([fixture().iloc[[0]]] * 1600, ignore_index=True)
        data['Index'], data['Time'] = range(1600), range(1600)
        self.assertEqual(len(build_workbook(data, .1)['Record']), 1600)

    def test_invalid_inputs_rejected(self):
        for mass in [0, -1, float('nan'), float('inf')]:
            with self.assertRaises(ValueError):
                build_workbook(fixture(), mass)
        data = fixture()
        data.loc[1, 'Voltage'] = float('nan')
        with self.assertRaises(ValueError):
            build_workbook(data, .1)

    def test_time_reset_inside_step_is_rejected(self):
        data = fixture()
        data.loc[0, 'Time'], data.loc[1, 'Time'] = 10, 5
        with self.assertRaises(ValueError):
            build_workbook(data, .1)


if __name__ == '__main__':
    unittest.main()
