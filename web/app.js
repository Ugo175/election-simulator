/* Ballot Lab: all counting is performed by the shared Python engine. */
'use strict';
const $ = (id) => document.getElementById(id);
const colors = ['#bd815d', '#4c7357', '#8495a2', '#9a83a8', '#b19b48', '#678e8b'];
const examples = {
  different: {candidates: ['Ada', 'Grace', 'Linus'], ballots: [
    ...Array.from({length: 3}, () => ['Ada', 'Grace', 'Linus']), ['Ada', 'Linus', 'Grace'],
    ...Array.from({length: 2}, () => ['Grace', 'Ada', 'Linus']), ['Grace', 'Linus', 'Ada'],
    ...Array.from({length: 2}, () => ['Linus', 'Grace', 'Ada'])]},
  majority: {candidates: ['Ada', 'Grace', 'Linus'], ballots: [
    ...Array.from({length: 6}, () => ['Ada', 'Grace']), ['Grace', 'Linus'], ['Grace', 'Ada'], ['Linus', 'Grace']]},
  exhausted: {candidates: ['Ada', 'Grace', 'Linus'], ballots: [
    ...Array.from({length: 4}, () => ['Ada']), ...Array.from({length: 3}, () => ['Grace']),
    ...Array.from({length: 2}, () => ['Linus'])]},
  tie: {candidates: ['Ada', 'Grace', 'Linus'], ballots: [['Ada'], ['Ada'], ['Grace'], ['Linus']]}
};
const state = {candidates: [], ballots: [], result: null, round: 0, version: 0, resultVersion: -1, busy: false};

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function colorFor(name, candidates = state.candidates) {
  return colors[candidates.indexOf(name) % colors.length] || colors[0];
}
function dot(name, candidates) {
  const element = node('span', 'candidate-dot');
  element.style.backgroundColor = colorFor(name, candidates);
  element.setAttribute('aria-hidden', 'true');
  return element;
}
function error(message = '') {
  $('setup-error').textContent = message;
  $('setup-error').hidden = !message;
}
function announce(message) { $('announcement').textContent = message; }
function dirty(custom = true) {
  state.version++;
  if (custom) $('example').value = 'custom';
  error();
  $('stale').hidden = !state.result || state.resultVersion === state.version;
  $('export').disabled = !state.result || state.resultVersion !== state.version;
}
function csvText(ballots = state.ballots) {
  return ballots.map(ballot => ballot.map(name => /[",\r\n]/.test(name) ? '"' + name.replaceAll('"', '""') + '"' : name).join(',')).join('\n');
}
function renderSetup() {
  $('candidates').value = state.candidates.join('\n');
  $('candidate-count').textContent = `${state.candidates.length} candidates`;
  $('candidate-chips').replaceChildren(...state.candidates.map(name => {
    const chip = node('span', 'chip');
    chip.append(dot(name), node('span', '', name));
    return chip;
  }));
  $('rank-fields').replaceChildren(...state.candidates.map((_, index) => {
    const row = node('div', 'rank-field');
    const label = node('label', '', String(index + 1).padStart(2, '0'));
    label.htmlFor = `rank-${index}`;
    const select = node('select');
    select.id = `rank-${index}`;
    select.setAttribute('aria-label', `Rank ${index + 1}`);
    select.append(new Option(index === 0 ? 'Choose first preference' : 'No further preference', ''));
    state.candidates.forEach(name => select.append(new Option(name, name)));
    row.append(label, select);
    return row;
  }));
  renderBallots();
}
function renderBallots() {
  $('ballot-count').textContent = state.ballots.length.toLocaleString();
  $('csv').value = csvText();
  const groups = new Map();
  state.ballots.forEach(ballot => {
    const key = JSON.stringify(ballot);
    const previous = groups.get(key);
    groups.set(key, {ballot, count: previous ? previous.count + 1 : 1});
  });
  $('ballot-list').replaceChildren(...Array.from(groups, ([key, {ballot, count}]) => {
    const row = node('div', 'ballot-group');
    const ranking = node('span', 'ranking');
    ballot.forEach((name, index) => {
      if (index) ranking.append(node('span', 'rank-arrow', '›'));
      ranking.append(document.createTextNode(name));
    });
    const remove = node('button', 'remove-ballot', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${count} ballot${count === 1 ? '' : 's'} ranking ${ballot.join(', ')}`);
    remove.addEventListener('click', () => {
      state.ballots = state.ballots.filter(item => JSON.stringify(item) !== key);
      dirty(); renderBallots();
      announce(`Removed ${count} ballot${count === 1 ? '' : 's'}. ${state.ballots.length} ballot${state.ballots.length === 1 ? ' remains' : 's remain'}.`);
      $('clear-ballots').focus();
    });
    row.append(node('span', 'group-count', `${count}×`), ranking, remove);
    return row;
  }));
  if (!groups.size) $('ballot-list').append(node('p', 'empty-ballots', 'An empty box, a fresh start. Add your first ballot.'));
}
function addBallot() {
  const ranking = Array.from($('rank-fields').querySelectorAll('select'), select => select.value);
  while (ranking.length && !ranking[ranking.length - 1]) ranking.pop();
  const copies = Number($('copies').value);
  if (!ranking.length || ranking.some(name => !name)) return error('Choose a first preference and leave no gaps between ranks.');
  if (new Set(ranking).size !== ranking.length) return error('Each candidate can appear only once on a ballot.');
  if (!Number.isInteger(copies) || copies < 1 || state.ballots.length + copies > 10000) return error('Add a whole number of voters, up to 10,000 total ballots.');
  for (let index = 0; index < copies; index++) state.ballots.push([...ranking]);
  dirty(); renderBallots(); announce(`Added ${copies} ballot${copies === 1 ? '' : 's'}. Compare outcomes to update the count.`);
}
function applyCandidates() {
  const candidates = $('candidates').value.split('\n').map(name => name.trim()).filter(Boolean);
  if (candidates.length < 2 || candidates.length > 20 || new Set(candidates).size !== candidates.length) return error('Enter 2–20 distinct candidate names, one per line.');
  if (candidates.some(name => name.length > 60 || /[\x00-\x1f]/.test(name))) return error('Use printable names of at most 60 characters.');
  if (JSON.stringify(candidates) === JSON.stringify(state.candidates)) return error();
  state.candidates = candidates;
  state.ballots = [];
  dirty(); renderSetup();
  document.querySelector('.candidate-editor').open = false;
  announce('Candidates updated and ballot box cleared. Add ballots for the new election.');
  $('rank-0').focus();
}
function busy(value) {
  state.busy = value;
  for (const id of ['run', 'apply-csv', 'apply-candidates', 'example']) $(id).disabled = value;
  document.querySelector('.results').setAttribute('aria-busy', String(value));
  $('run').replaceChildren(document.createTextNode(value ? 'Counting ballots…' : 'Compare outcomes '));
  if (!value) $('run').append(node('span', '', '↗'));
}
async function request(csv, candidates) {
  const response = await fetch('/api/simulate', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({csv, candidates})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not count these ballots.');
  return data;
}
async function runElection(importCsv = false) {
  if (state.busy) return;
  const version = state.version;
  const candidates = [...state.candidates];
  const text = importCsv ? $('csv').value : csvText();
  error(); busy(true);
  try {
    const result = await request(text, candidates);
    if (version !== state.version) {
      error('The ballot box changed during counting. Compare again to use your latest edits.');
      return;
    }
    if (importCsv) {
      state.ballots = result.ranked_ballots;
      dirty(); renderBallots();
    }
    state.result = result;
    state.resultVersion = state.version;
    state.round = 0;
    $('stale').hidden = true;
    $('export').disabled = false;
    renderResults();
    announce(`Count complete for ${result.ballots} ballots. Plurality: ${result.plurality.winners.join(' and ')}. Instant-runoff: ${result.runoff.winners.join(' and ') || result.runoff.reason}.`);
  } catch (failure) {
    error(failure instanceof TypeError ? 'Cannot reach the counting engine. Start the app with python3 server.py and try again.' : failure.message);
  } finally { busy(false); }
}
function miniBars(id, counts, candidates) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  $(id).replaceChildren(...candidates.filter(name => name in counts).map(name => {
    const segment = node('span', 'mini-segment');
    segment.style.width = `${total ? counts[name] / total * 100 : 0}%`;
    segment.style.backgroundColor = colorFor(name, candidates);
    segment.title = `${name}: ${counts[name]} votes`;
    return segment;
  }));
  $(id).setAttribute('aria-label', Object.entries(counts).map(([name, votes]) => `${name}: ${votes} votes`).join(', '));
}
function winnerStat(id, votes, total, label) {
  $(id).replaceChildren(document.createTextNode(`${total ? Math.round(votes / total * 100) : 0}%`), node('small', '', label));
}
function renderResults() {
  const {plurality, runoff, candidates, ballots} = state.result;
  const final = runoff.rounds[runoff.rounds.length - 1];
  const tiedPlurality = plurality.winners.length > 1;
  $('plurality-label').textContent = tiedPlurality ? 'TIED FIRST CHOICES' : 'WINNING CANDIDATE';
  $('plurality-winner').textContent = plurality.winners.join(' & ');
  const leading = plurality.votes[plurality.winners[0]];
  winnerStat('plurality-stat', leading, ballots, 'first choices');
  $('plurality-foot').textContent = `${leading} of ${ballots} first-choice votes${tiedPlurality ? ' each · tied result' : ' · no transfers'}.`;
  miniBars('plurality-bars', plurality.votes, candidates);
  const unresolved = !runoff.winners.length;
  const tied = runoff.winners.length > 1;
  $('runoff-label').textContent = unresolved ? 'COUNT PAUSED' : tied ? 'TIED RESULT' : 'WINNING CANDIDATE';
  $('runoff-winner').textContent = unresolved ? 'Unresolved' : runoff.winners.join(' & ');
  if (unresolved) {
    $('runoff-stat').replaceChildren(document.createTextNode('—'), node('small', '', 'tie-break needed'));
  } else {
    winnerStat('runoff-stat', final.votes[runoff.winners[0]], ballots - final.exhausted, 'active votes');
  }
  $('runoff-foot').textContent = `${runoff.rounds.length} round${runoff.rounds.length === 1 ? '' : 's'} · ${unresolved ? 'elimination tie' : tied ? 'equal remaining totals' : 'majority reached'}.`;
  miniBars('runoff-bars', final.votes, candidates);
  const different = !unresolved && !tied && !tiedPlurality && plurality.winners[0] !== runoff.winners[0];
  if (different) {
    $('insight-title').textContent = 'A different rule. A different winner.';
    $('insight-copy').textContent = `${plurality.winners[0]} leads on first choices, but ${runoff.winners[0]} wins when later preferences count. Here’s how.`;
  } else if (unresolved) {
    $('insight-title').textContent = 'Sometimes, the honest answer is a pause.';
    $('insight-copy').textContent = `${runoff.tied_for_elimination.join(' and ')} are tied for last place. A declared tie-break rule is needed to continue.`;
  } else if (tied || tiedPlurality) {
    $('insight-title').textContent = 'The rules can reveal a tie, too.';
    $('insight-copy').textContent = 'Equal vote totals are shown explicitly. The lab never picks a winner at random.';
  } else {
    $('insight-title').textContent = 'Two methods. The same winner.';
    $('insight-copy').textContent = final.exhausted ? `${final.exhausted} ballots ran out of ranked choices. The majority is calculated from the ballots still active.` : `${runoff.winners[0]} wins under both methods. Explore the count to see the path to a majority.`;
  }
  renderRound();
}
function renderRound() {
  const {runoff, candidates, ballots} = state.result;
  const record = runoff.rounds[state.round];
  const active = ballots - record.exhausted;
  const majority = Math.floor(active / 2) + 1;
  const previous = state.round ? runoff.rounds[state.round - 1] : null;
  $('round-position').textContent = `ROUND ${state.round + 1} OF ${runoff.rounds.length}`;
  $('round-tabs').replaceChildren(...runoff.rounds.map((item, index) => {
    const button = node('button', 'round-tab', `Round ${item.round}`);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(index === state.round));
    if (index === runoff.rounds.length - 1 && runoff.winners.length === 1) button.append(node('span', 'round-check', '✓'));
    button.addEventListener('click', () => { state.round = index; renderRound(); $('round-tabs').children[index].focus(); });
    return button;
  }));
  $('round-description').textContent = state.round === 0 ? 'First preferences are counted.' : 'Later preferences are now counted.';
  $('majority').textContent = `Majority: ${majority} of ${active}`;
  $('exhausted').textContent = `${record.exhausted} exhausted ballot${record.exhausted === 1 ? '' : 's'}`;
  const chart = $('round-chart');
  chart.replaceChildren();
  // A constant ballot-count scale makes changes comparable between rounds.
  const scale = Math.max(ballots, 1);
  candidates.forEach(name => {
    const eliminatedEarlier = !(name in record.votes);
    const eliminatedNow = record.eliminated.includes(name);
    const count = record.votes[name] || 0;
    const row = node('div', `chart-row${eliminatedEarlier || eliminatedNow ? ' eliminated' : ''}`);
    const label = node('span', 'chart-label');
    label.append(dot(name, candidates), document.createTextNode(name));
    const track = node('div', 'track');
    const bar = node('div', 'bar');
    bar.style.width = `${count / scale * 100}%`;
    bar.style.backgroundColor = colorFor(name, candidates);
    const threshold = node('span', 'threshold');
    threshold.style.left = `${Math.min(majority / scale * 100, 100)}%`;
    threshold.setAttribute('aria-hidden', 'true');
    track.append(bar, threshold);
    const countLabel = node('span', 'vote-count', String(count));
    const change = previous && !eliminatedEarlier ? count - (previous.votes[name] || 0) : 0;
    if (change > 0) countLabel.append(node('span', 'vote-delta', `+${change}`));
    row.append(label, track, countLabel);
    row.setAttribute('aria-label', `${name}: ${count} votes${change > 0 ? `, gained ${change}` : ''}${eliminatedEarlier ? ', already eliminated' : eliminatedNow ? ', eliminated this round' : ''}`);
    chart.append(row);
    if (eliminatedNow || eliminatedEarlier) chart.append(node('div', 'eliminated-label', eliminatedNow ? 'ELIMINATED THIS ROUND' : 'ELIMINATED'));
  });
  const explanation = $('round-explanation');
  explanation.replaceChildren();
  if (record.eliminated.length) {
    const name = record.eliminated[0];
    explanation.append(node('h4', '', `${name} has the fewest votes.`), node('p', '', 'Their ballots move to the next remaining preference. Ballots without one become exhausted.'));
    const transfers = node('div', 'transfer-list');
    if (!(record.transfers || []).length) transfers.append(node('span', 'transfer-chip', 'No ballots to transfer'));
    for (const transfer of record.transfers || []) transfers.append(node('span', 'transfer-chip', `${transfer.from} → ${transfer.to === null ? 'Exhausted' : transfer.to} · ${transfer.ballots}`));
    explanation.append(transfers);
  } else if (runoff.tied_for_elimination) {
    explanation.append(node('h4', '', 'The count pauses on an elimination tie.'), node('p', '', `${runoff.tied_for_elimination.join(' and ')} share the lowest total. Choosing whom to eliminate could change the outcome, so no winner is declared.`));
  } else if (runoff.winners.length > 1) {
    explanation.append(node('h4', '', 'All remaining candidates are tied.'), node('p', '', 'Every active candidate has the same vote total. The result is a tie.'));
  } else if (runoff.winners.length === 1) {
    explanation.append(node('h4', '', `${runoff.winners[0]} reaches a majority.`), node('p', '', `${finalVote(runoff, record)} of ${active} active ballots support ${runoff.winners[0]}. ${record.exhausted ? `${record.exhausted} exhausted ballots are excluded from the majority calculation.` : 'More than half of the active votes is enough to win.'}`));
  } else {
    explanation.append(node('h4', '', 'All ballots are exhausted.'), node('p', '', 'No active preferences remain, so no winner can be declared.'));
  }
  $('previous').disabled = state.round === 0;
  $('next').disabled = state.round === runoff.rounds.length - 1;
}
function finalVote(runoff, record) { return record.votes[runoff.winners[0]] || 0; }
function chooseExample() {
  const example = examples[$('example').value];
  state.candidates = [...example.candidates];
  state.ballots = example.ballots.map(ballot => [...ballot]);
  dirty(false); renderSetup(); runElection();
}
function setTab(csv) {
  for (const [id, selected] of [['guided-tab', !csv], ['csv-tab', csv]]) {
    $(id).setAttribute('aria-selected', String(selected));
    $(id).tabIndex = selected ? 0 : -1;
  }
  $('guided-panel').hidden = csv;
  $('csv-panel').hidden = !csv;
}
$('guided-tab').addEventListener('click', () => setTab(false));
$('csv-tab').addEventListener('click', () => setTab(true));
document.querySelector('.tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const csv = event.key === 'End' || (event.key !== 'Home' && $('csv-tab').getAttribute('aria-selected') !== 'true');
  setTab(csv); $(csv ? 'csv-tab' : 'guided-tab').focus();
});
$('apply-candidates').addEventListener('click', applyCandidates);
$('add-ballot').addEventListener('click', addBallot);
$('clear-ballots').addEventListener('click', () => { state.ballots = []; dirty(); renderBallots(); announce('Ballot box cleared.'); });
$('run').addEventListener('click', () => runElection());
$('apply-csv').addEventListener('click', () => runElection(true));
$('example').addEventListener('change', chooseExample);
$('upload').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024) { error('Use a CSV file smaller than 1 MiB.'); return; }
  try { $('csv').value = await file.text(); error(); announce('CSV loaded. Apply CSV to validate and compare it.'); }
  catch { error('Could not read that CSV file.'); }
  event.target.value = '';
});
$('previous').addEventListener('click', () => { state.round--; renderRound(); announce(`Showing round ${state.round + 1}.`); });
$('next').addEventListener('click', () => { state.round++; renderRound(); announce(`Showing round ${state.round + 1}.`); });
$('export').addEventListener('click', () => {
  if (!state.result || state.resultVersion !== state.version) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(state.result, null, 2) + '\n'], {type: 'application/json'}));
  const link = node('a');
  link.href = url; link.download = 'ballot-lab-results.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('Election results exported as JSON.');
});
chooseExample();
