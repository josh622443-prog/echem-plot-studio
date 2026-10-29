import copy
import unittest
from origin_export import validate, grouped_curves


class OriginPayloadTests(unittest.TestCase):
    def setUp(self):
        self.payload = {'headers': ['Cycle', 'Segment', 'X', 'Y'],
                        'rows': [[1, 1, 0, 10], [1, 1, 1, 20], [1, 2, 2, 30], [2, 1, 3, 40]],
                        'plots': [{'x': 2, 'y': 3, 'group': [0], 'segment': 1, 'kind': 'line'}]}

    def test_valid_payload(self):
        self.assertEqual(validate(self.payload)[0], self.payload['headers'])

    def test_cycle_pairs_and_segment_gap(self):
        curves = grouped_curves(self.payload['rows'], self.payload['plots'][0])
        self.assertEqual(list(curves), [(1,), (2,)])
        self.assertEqual(curves[(1,)]['x'], [0, 1, None, 2])
        self.assertEqual(curves[(1,)]['y'], [10, 20, None, 30])
        self.assertEqual(curves[(2,)]['x'], [3])

    def test_filter_keeps_unit_groups_separate(self):
        plot = copy.deepcopy(self.payload['plots'][0])
        plot['filter'] = [{'column': 0, 'value': 2}]
        self.assertEqual(list(grouped_curves(self.payload['rows'], plot)), [(2,)])

    def test_missing_values_and_log_scale(self):
        plot = {'x': 0, 'y': 1, 'group': [], 'kind': 'line', 'logX': True}
        curves = grouped_curves([[1, 2], [2, None], [0, 3]], plot)
        self.assertEqual(curves[()]['x'], [1, 2, None])
        self.assertEqual(curves[()]['y'], [2, None, 3])

    def test_invalid_cells_and_dimensions(self):
        for rows in [[[1, 2]], [[1, 1, 0, float('nan')]], [[1, 1, 0, {'code': 'invalid'}]]]:
            payload = copy.deepcopy(self.payload)
            payload['rows'] = rows
            with self.assertRaises(ValueError):
                validate(payload)

    def test_invalid_plot_columns(self):
        payload = copy.deepcopy(self.payload)
        payload['plots'][0]['x'] = 100
        with self.assertRaises(ValueError):
            validate(payload)


if __name__ == '__main__':
    unittest.main()
