#!/usr/bin/env python3
"""Compare plurality and instant-runoff elections using ranked CSV ballots."""
import argparse
import csv
import json
import io
from pathlib import Path


MAX_CANDIDATES = 20
MAX_BALLOTS = 10000


def parse_ballots(text, candidates):
    """Shared CSV validation for the CLI and browser API."""
    if not isinstance(candidates, list) or not 2 <= len(candidates) <= MAX_CANDIDATES:
        raise ValueError(f'Provide 2–{MAX_CANDIDATES} distinct candidates.')
    if any(not isinstance(name, str) or not name.strip() or name != name.strip()
           or len(name) > 60 or any(ord(char) < 32 for char in name) for name in candidates):
        raise ValueError('Candidate names must be trimmed, printable text of 1–60 characters.')
    if len(set(candidates)) != len(candidates):
        raise ValueError('Candidate names must be distinct.')
    if not isinstance(text, str):
        raise ValueError('Ballots must be CSV text.')
    ballots = []
    for number, row in enumerate(csv.reader(io.StringIO(text.lstrip('\ufeff')), strict=True), 1):
        ballot = [name.strip() for name in row]
        while ballot and not ballot[-1]:
            ballot.pop()
        if not ballot:
            continue
        if len(set(ballot)) != len(ballot) or any(name not in candidates for name in ballot):
            raise ValueError(f'Ballot {number}: unknown, blank, or repeated candidate.')
        ballots.append(ballot)
        if len(ballots) > MAX_BALLOTS:
            raise ValueError(f'Use at most {MAX_BALLOTS:,} ballots.')
    if not ballots:
        raise ValueError('At least one nonempty ballot is required.')
    return ballots


def read_ballots(path, candidates):
    return parse_ballots(Path(path).read_text(encoding='utf-8-sig'), candidates)


def tally(ballots, active):
    counts = {name: 0 for name in active}
    exhausted = 0
    for ballot in ballots:
        choice = next((name for name in ballot if name in counts), None)
        if choice is None:
            exhausted += 1
        else:
            counts[choice] += 1
    return counts, exhausted


def plurality(ballots, candidates):
    counts, _ = tally([ballot[:1] for ballot in ballots], candidates)
    highest = max(counts.values())
    return {'winners': [name for name, count in counts.items() if count == highest],
            'votes': counts}


def runoff(ballots, candidates):
    active = list(candidates)
    rounds = []
    while active:
        counts, exhausted = tally(ballots, active)
        cast = sum(counts.values())
        record = {'round': len(rounds) + 1, 'votes': counts, 'exhausted': exhausted,
                  'eliminated': []}
        rounds.append(record)
        if not cast:
            return {'winners': [], 'reason': 'All ballots exhausted', 'rounds': rounds}
        winners = [name for name, count in counts.items() if count > cast / 2]
        if winners:
            return {'winners': winners, 'reason': 'Majority of active ballots', 'rounds': rounds}
        minimum = min(counts.values())
        lowest = [name for name, count in counts.items() if count == minimum]
        if len(lowest) == len(active):
            return {'winners': active, 'reason': 'All remaining candidates tied', 'rounds': rounds}
        if len(lowest) > 1:
            # Do not silently pick an arbitrary winner or eliminate a potentially viable candidate.
            return {'winners': [], 'reason': 'Elimination tie requires a tie-break rule',
                    'tied_for_elimination': lowest, 'rounds': rounds}
        record['eliminated'] = lowest
        next_active = [name for name in active if name not in lowest]
        transfers = {}
        for ballot in ballots:
            previous_choice = next((name for name in ballot if name in active), None)
            if previous_choice in lowest:
                next_choice = next((name for name in ballot if name in next_active), None)
                transfers[next_choice] = transfers.get(next_choice, 0) + 1
        record['transfers'] = [{'from': lowest[0], 'to': name, 'ballots': count}
                               for name, count in transfers.items()]
        active = next_active
    raise RuntimeError('Election ended without a result.')


def simulate(text, candidates):
    ballots = parse_ballots(text, candidates)
    return {'candidates': candidates, 'ballots': len(ballots), 'ranked_ballots': ballots,
            'plurality': plurality(ballots, candidates), 'runoff': runoff(ballots, candidates)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ballots', type=Path, help='CSV: one ranked ballot per row; no header')
    parser.add_argument('--candidates', nargs='+', required=True)
    parser.add_argument('--output', type=Path, help='Export the full comparison as JSON')
    args = parser.parse_args()
    try:
        results = simulate(args.ballots.read_text(encoding='utf-8-sig'), args.candidates)
        rendered = json.dumps(results, indent=2)
        if args.output:
            with args.output.open('x', encoding='utf-8') as destination:
                destination.write(rendered + '\n')
        print(rendered)
    except (OSError, UnicodeError, ValueError, csv.Error) as error:
        parser.exit(2, f'Error: {error}\n')


if __name__ == '__main__':
    main()
