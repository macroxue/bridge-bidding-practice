// --- FRAMEWORK ---
function appendHtml(html) {
  const testEl = document.createElement('div');
  testEl.innerHTML = html;
  document.body.appendChild(testEl);
}

function runSuite(suite) {
  appendHtml('<h1>' + suite.test.name + '</h1>');
  const results = suite.cases.map(c => {
    const actual = suite.test(...c.args);
    if (JSON.stringify(actual) === JSON.stringify(c.expected)) return '';
    return 'FAILED<br>' +
      '<pre>' + (suite.format ? suite.format(...c.args) : String(c.args)) + '<br>' +
      '  Expecting: ' + c.expected + '<br>' +
      '     Actual: ' + actual + '<br></pre>';
  });
  const failures = results.filter(r => r !== '');
  appendHtml(`${suite.cases.length - failures.length}/${suite.cases.length} PASSED`);
  failures.forEach(c => appendHtml(c));
}

// --- TESTS ---
function testParScore(ddLines, vulnerable) {
  const [nsContracts, ewContracts] = computeParScore(ddLines, vulnerable);
  if (nsContracts.length == 0 && ewContracts.length == 0) {
    return ['Par: 0'];
  } else {
    return ((nsContracts.length > 0 ? renderParContracts(nsContracts) : '') +
            (ewContracts.length > 0 ? renderParContracts(ewContracts) : ''))
      .replace(/<tr><td>/g, '')
      .replace(/<ss><\/ss>/g, 'S')
      .replace(/<hs><\/hs>/g, 'H')
      .replace(/<ds><\/ds>/g, 'D')
      .replace(/<cs><\/cs>/g, 'C')
      .split('</td></tr>')
      .slice(0, -1);
  }
}

function testParScoreFormat(ddLines, vulnerable) {
  return 'Vulnerable ' + vulnerable + '<br>' + ddLines.join('<br>');
}

const testParScoreSuite = {
  test: testParScore,
  format: testParScoreFormat,
  cases: [
    // Positive scores.
    {args: [['N 1 1 11 11', 'S 2 2 11 11', 'H 0 0 13 13', 'D 5 5 8 8', 'C 0 0 12 12'], 'E-W'],
      expected: ['Par: EW +2210', '7H= by EW']},
    {args: [['N 1 1 10 10', 'S 6 6 7 7', 'H 1 1 11 11', 'D 1 1 11 11', 'C 3 3 9 9'], 'None'],
      expected: ['Par: EW +450', '4H+1 by EW']},
    {args: [['N 3 3 9 9', 'S 3 3 10 9', 'H 2 2 10 9', 'D 7 7 5 5', 'C 5 5 8 8'], 'None'],
      expected: ['Par: EW +420', '4S= by W', '4H= by W']},
    {args: [['N 7 7 6 6', 'S 6 6 6 7', 'H 7 7 6 6', 'D 7 7 6 6', 'C 8 8 5 5'], 'E-W'],
      expected: ['Par: NS +90', '1NT= by NS', '2C= by NS']},
    // Negative scores.
    {args: [['N 5 5 8 7', 'S 3 3 10 10', 'H 6 6 5 7', 'D 8 8 5 5', 'C 2 2 10 10'], 'E-W'],
      expected: ['Par: NS -500', '5DX-3 by NS']},
    {args: [['N 4 4 8 8', 'S 8 8 5 5', 'H 4 4 8 9', 'D 8 8 5 5', 'C 4 4 9 9'], 'None'],
      expected: ['Par: NS -100', '3SX-1 by NS']},
    {args: [['N 5 5 7 7', 'S 4 4 8 8', 'H 8 8 5 5', 'D 3 3 9 9', 'C 8 8 5 5'], 'None'],
      expected: ['Par: NS -100', '3HX-1 by NS']},
    {args: [['N 7 7 6 6', 'S 3 3 10 10', 'H 9 9 4 4', 'D 9 9 4 4', 'C 4 4 9 9'], 'All'],
      expected: ['Par: NS -500', '5HX-2 by NS', '5DX-2 by NS']},
    {args: [['N 5 5 8 8', 'S 9 9 4 4', 'H 9 9 4 4', 'D 3 3 9 9', 'C 3 3 9 9'], 'N-S'],
      expected: ['Par: EW -100', '3NTX-1 by EW', '4DX-1 by EW', '4CX-1 by EW']},
    // Special.
    {args: [['N 5 5 3 3', 'S 5 5 5 5', 'H 4 4 6 6', 'D 6 6 3 3', 'C 6 6 3 3'], 'N-S'],
      expected: ['Par: 0']},
    {args: [['N 7 7 7 7', 'S 6 6 6 6', 'H 6 6 6 6', 'D 6 6 6 6', 'C 6 6 6 6'], 'All'],
      expected: ['Par: NS +90', '1NT= by NS', 'Par: EW +90', '1NT= by EW']},
    {args: [['N 13 0 13 0', 'S 13 12 1 0', 'H 2 1 12 11', 'D 2 1 12 11', 'C 0 0 13 13'], 'N-S'],
      expected: ['Par: NS +2220', '7NT= by S', 'Par: EW +1520', '7NT= by W']}
  ]
};

function testAll() {
  runSuite(testParScoreSuite);
}
