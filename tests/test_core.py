import tempfile
import unittest
from pathlib import Path
from election import read_ballots, plurality, runoff

class ElectionTests(unittest.TestCase):
    def test_different_winners(self):
        candidates = ['Ada', 'Grace', 'Linus']
        ballots = read_ballots(Path('examples/ballots.csv'), candidates)
        self.assertEqual(plurality(ballots, candidates)['winners'], ['Ada'])
        result = runoff(ballots, candidates)
        self.assertEqual(result['winners'], ['Grace'])
        self.assertEqual(result['rounds'][0]['eliminated'], ['Linus'])
        self.assertEqual(result['rounds'][1]['votes'], {'Ada': 4, 'Grace': 5})

    def test_exhausted_ballots_change_majority_denominator(self):
        ballots = [['A']] * 4 + [['B']] * 3 + [['C']] * 2
        result = runoff(ballots, ['A', 'B', 'C'])
        self.assertEqual(result['winners'], ['A'])
        self.assertEqual(result['rounds'][-1]['exhausted'], 2)

    def test_partial_elimination_tie_is_unresolved(self):
        result = runoff([['A'], ['A'], ['B'], ['C']], ['A', 'B', 'C'])
        self.assertEqual(result['winners'], [])
        self.assertEqual(result['tied_for_elimination'], ['B', 'C'])

    def test_all_tied(self):
        self.assertEqual(runoff([['A'], ['B']], ['A', 'B'])['winners'], ['A', 'B'])

    def test_invalid_ballots(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'votes.csv'
            for text in ['A,A', 'A,X', 'A,,B', '']:
                with self.subTest(text=text):
                    path.write_text(text)
                    with self.assertRaises(ValueError):
                        read_ballots(path, ['A', 'B'])
            path.write_text('A,B')
            with self.assertRaises(ValueError):
                read_ballots(path, ['A', 'A'])

    def test_incomplete_ballot_and_trailing_cells(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'votes.csv'
            path.write_text(' A , B ,\nB,,\n\n')
            self.assertEqual(read_ballots(path, ['A', 'B']), [['A', 'B'], ['B']])
