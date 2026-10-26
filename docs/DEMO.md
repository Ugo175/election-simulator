# Ballot Lab walkthrough

## Try the built-in story

Run `python3 server.py` from the repository root and open the printed localhost URL.

The default election has nine voters. Ada receives four first-choice votes, Grace receives three, and Linus receives two. Under plurality, Ada wins immediately.

Instant-runoff asks for a majority: five active votes are needed. Linus has the unique lowest total, so Linus is eliminated. Both Linus voters ranked Grace next. In Round 2, Grace has five votes and wins. The same ballots produce different winners because the methods use different information.

![The comparison and final round](desktop.jpg)

## Other examples

| Example | What to inspect |
| --- | --- |
| A clear majority | Ada wins both methods in the first round |
| When ballots run out | Linus’s two ballots exhaust; the majority changes from five of nine to four of seven |
| An elimination tie | Grace and Linus are tied for last; the count pauses without an invented tie-break |

## Reproducible browser checks

1. Load the default example: Ada is the plurality winner, Grace the instant-runoff winner.
2. Go to Round 2: Grace has five votes and a `+2` indicator; Linus is marked eliminated. Previous and next controls stop at the endpoints.
3. Select the exhaustion example and go to Round 2: two exhausted ballots, seven active ballots, majority of four, Ada wins.
4. Select the elimination-tie example: the result is unresolved, with Grace and Linus named as tied for elimination.
5. Enter invalid CSV (`Ada,Ada`) and apply: a repeated-candidate error appears, and existing valid results remain.
6. Change the candidates to Alex and Blair: the ballot box clears. Add three Alex-first ballots: Alex wins both methods with 100% of the active votes.
7. Import valid CSV: the ranking groups and totals update. Try equal first-choice totals: both methods explicitly report a tie.
8. Add or remove a ballot after a count: old results receive a notice and export is disabled until a new count completes.
9. Export the example: the downloaded JSON contains nine ballots and Grace as the runoff winner.
10. Test a narrow mobile viewport: controls stack vertically and the document does not overflow horizontally. Round charts remain usable.
11. Check browser errors: no JavaScript errors during the verified flows.

## Mobile view

[Open the full mobile screenshot](mobile.jpg).

## Automated checks

`python3 -m unittest discover -s tests -v` runs both the counting tests and HTTP integration tests. The CLI and browser endpoint are tested against identical inputs and must return identical JSON, including transfer destinations.

Screenshots show the local app with original sample data, not a mockup. No accounts, remote APIs, or paid services are required to reproduce the demo.
