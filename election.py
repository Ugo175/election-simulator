#!/usr/bin/env python3
"""Compare plurality and instant-runoff elections using ranked CSV ballots."""
import argparse
import csv
import json
from pathlib import Path


def read_ballots(path, candidates):
    if len(candidates) < 2 or len(set(candidates)) != len(candidates):
        raise ValueError('Provide at least two distinct candidates.')
    if any(not name.strip() for name in candidates):
        raise ValueError('Candidate names cannot be blank.')
    ballots = []
    with Path(path).open(newline='', encoding='utf-8-sig') as source:
        for number, row in enumerate(csv.reader(source), 1):
            ballot = [name.strip() for name in row]
            while ballot and not ballot[-1]:
                ballot.pop()
            if not ballot:
                continue
            if len(set(ballot)) != len(ballot) or any(name not in candidates for name in ballot):
                raise ValueError(f'Ballot {number}: unknown, blank, or repeated candidate.')
            ballots.append(ballot)
    if not ballots:
        raise ValueError('At least one nonempty ballot is required.')
    return ballots


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
        active = [name for name in active if name not in lowest]
    raise RuntimeError('Election ended without a result.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ballots', type=Path, help='CSV: one ranked ballot per row; no header')
    parser.add_argument('--candidates', nargs='+', required=True)
    parser.add_argument('--output', type=Path, help='Export the full comparison as JSON')
    args = parser.parse_args()
    try:
        ballots = read_ballots(args.ballots, args.candidates)
        results = {'ballots': len(ballots), 'plurality': plurality(ballots, args.candidates),
                   'runoff': runoff(ballots, args.candidates)}
        rendered = json.dumps(results, indent=2)
        if args.output:
            with args.output.open('x', encoding='utf-8') as destination:
                destination.write(rendered + '\n')
        print(rendered)
    except (OSError, ValueError, csv.Error) as error:
        parser.exit(2, f'Error: {error}\n')


if __name__ == '__main__':
    main()
