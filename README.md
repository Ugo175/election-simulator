# Election Simulator

Compare plurality and instant-runoff outcomes from the same ranked ballots. Every runoff round records vote transfers, exhausted ballots, and eliminations.

## Run

```sh
python3 election.py examples/ballots.csv --candidates Ada Grace Linus
python3 election.py examples/ballots.csv --candidates Ada Grace Linus --output result.json
```

The example elects Ada by plurality and Grace by runoff. CSV has **no header**, one voter per row, highest preference first. Candidate names are case-sensitive; omit trailing preferences for incomplete ballots. Blank rows are ignored; unknown candidates, repeated ranks, internal blanks, and empty elections are rejected.

## Counting rules

Plurality counts only first preferences and reports every tied leader. Runoff requires more than half of the active, non-exhausted ballots. A ballot exhausts when none of its ranked candidates remain. A unique last-place candidate is eliminated each round. Equal totals for every remaining candidate produce a tie. A partial tie for elimination stops with an explicit unresolved result instead of choosing an arbitrary elimination order. This rule intentionally differs from the original CS50 exercise, which eliminates all last-place candidates simultaneously.

JSON output is suitable for a future visualization or API. Existing export files are never overwritten. The tool models elections for learning; it does not implement ballot authentication or election administration.

## Next steps

Add a browser visualization, configurable tie-break rules, and pairwise/Condorcet comparisons.

## Verification

```sh
python3 -m unittest discover -s tests -v
```

Requires Python 3.9+; no third-party packages or API keys.

## Origins

Inspired by Ugochukwu Igweagu’s CS50 coursework in [the projects collection](https://github.com/Ugo175/projects). This is a new standalone implementation with additional functionality, not a copy of CS50 starter files. See [ATTRIBUTION.md](ATTRIBUTION.md).
