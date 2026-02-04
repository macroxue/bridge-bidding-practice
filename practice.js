const pairPractice = (new URLSearchParams(window.location.search)).has('p');
const clearStorage = (new URLSearchParams(window.location.search)).has('c');
const doubleDummy = (new URLSearchParams(window.location.search)).get('d');
const exportMarkdown = (new URLSearchParams(window.location.search)).has('m');
const hideInvalidBids = !(new URLSearchParams(window.location.search)).has('h');
const smallScreen = window.matchMedia("(max-width: 768px)").matches;

// --- DOM ELEMENTS ---
const filterChk = document.getElementById('filter');
const filterBar = document.getElementById('filter-bar');
const notedChk = document.getElementById('noted');
const endedChk = document.getElementById('ended');
const regexChk = document.getElementById('regex');
const matchEl = document.getElementById('match');
const matchCountEl = document.getElementById('match-count');

const firstBtn = document.getElementById('first');
const lastBtn = document.getElementById('last')
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const boardNumEl = document.getElementById('board-num');
const tableEl = document.getElementById('table');
const handEls = {
  'South': document.getElementById('south-hand'),
  'North': document.getElementById('north-hand'),
  'West': document.getElementById('west-hand'),
  'East': document.getElementById('east-hand'),
};
const nameEls = {
  'South': document.getElementById('south-name'),
  'North': document.getElementById('north-name'),
  'West': document.getElementById('west-name'),
  'East': document.getElementById('east-name'),
};
const bidsEls = {
  'South': document.getElementById('south-bids'),
  'North': document.getElementById('north-bids'),
  'West': document.getElementById('west-bids'),
  'East': document.getElementById('east-bids'),
};
const auctionEl = document.getElementById('auction');
const noteEl = document.getElementById('note');
const biddingGridEl = document.getElementById('bidding-grid');
const contractEl = document.getElementById('contract');
const parScoreEl = document.getElementById('par-score');
const ddResultsEl = document.getElementById('dd-results');
const markdownEl = document.getElementById('markdown');

// --- DOUBLE DUMMY SOLVER ---
const worker = new Worker('worker.js');

worker.onmessage = function(event) {
  const type = event.data[0];
  const num = event.data[1];
  const result = event.data[2];
  const board = boards[num];

  switch (type) {
    case 'abort':
      alert('Errors initializing the double-dummy solver:\n\n' + event.data[1]);
      // Continue to 'ready' anyway.

    case 'ready':
      initialize();
      break;

    case 'solve':
      board.dd = result.split('\n');
      board.save();

      if (board.isAuctionOver() && currentBoard == num) {
        // Delayed rendering.
        renderDoubleDummyResults();
      }
      break;

    case 'solve_leads':
      board.openingLeads = {};
      for (const lead of result.split(' ')) {
        const [card, tricks] = lead.split(':');
        const suit = card[0];
        const rank = card[1] === 'T' ? '10' : card[1];
        board.openingLeads[suit + rank] = tricks;
      }
      board.save();

      if (board.isAuctionOver() && currentBoard == num) {
        // Delayed rendering.
        renderOpeningLeads();
      }
      break;
  }
}

// --- BOARD HISTORY ---
let currentBoard = -1;
let boards = [];

function initialize() {
  filterChk.checked = false;
  notedChk.checked = false;
  endedChk.checked = false;
  regexChk.checked = true;
  filterChk.addEventListener('change', toggleFilterBar);
  notedChk.addEventListener('change', countMatches);
  endedChk.addEventListener('change', countMatches);
  regexChk.addEventListener('change', () => {
    matchEl.disabled = !regexChk.checked;
    countMatches();
  });
  matchEl.addEventListener('change', countMatches);

  firstBtn.addEventListener('click', firstBoard);
  lastBtn.addEventListener('click', lastBoard);
  prevBtn.addEventListener('click', prevBoard);
  nextBtn.addEventListener('click', nextBoard);
  boardNumEl.addEventListener('change', () => {
    const num = Number(boardNumEl.value);
    if (1 <= num && num <= boards.length) {
      currentBoard = num - 1;
      showBoard();
    } else {
      boardNumEl.value = currentBoard + 1;
    }
  });
  noteEl.addEventListener('change', () => {
    boards[currentBoard].note = noteEl.value;
    boards[currentBoard].save();
  });

  if (clearStorage) localStorage.clear();
  loadBoards();
  if (boards.length == 0) fetchDoubleDummy();  // async!
  else pickStartingBoard();
}

function loadBoards() {
  for (let num = 0; ; num++) {
    let board = new Board(num);
    if (!board.load()) break;
    if (board.dd == null || board.dd.length == 0) {
      // In case the previous solve was stopped by page refresh.
      board.solve();
    }
    if (board.openingLeads == null || board.openingLeads.length == 0) {
      board.solveLeads();
    }
    boards.push(board);
  }
}

// --- BOARD NAVIGATION ---
function pickStartingBoard() {
  if (boards.length == 0) {
    nextBoard();
    return;
  }

  // Show the first unfinished board or the last board if all finished.
  currentBoard = 0;
  for (let board of boards) {
    if (!board.isAuctionOver()) break;
    if (currentBoard < boards.length - 1) currentBoard++;
  }
  showBoard();
}

function toggleFilterBar() {
  filterBar.style.display = (filterChk.checked ? 'flex' : 'none');
  countMatches();
}

function firstBoard() { forwardSearchBoard(0); }
function lastBoard() { backwardSearchBoard(boards.length - 1); }
function prevBoard() { backwardSearchBoard(currentBoard - 1); }

function nextBoard() {
  if (isFilterOn()) {
    forwardSearchBoard(currentBoard + 1);
  } else {
    if (currentBoard == boards.length - 1) {
      const board = new Board(boards.length);
      board.solve();
      board.save();
      boards.push(board);
    }
    currentBoard++;
    showBoard();
  }
}

function isFilterOn() {
  return filterChk.checked &&
    (notedChk.checked || endedChk.checked ||
      (regexChk.checked && matchEl.value.length > 0));
}

function isBoardInScope(board) {
  if (!filterChk.checked) return true;
  return (!notedChk.checked || board.note.trim() !== '') &&
    (!endedChk.checked || board.isAuctionOver()) &&
    (!regexChk.checked || matchEl.value.length == 0 ||
      board.getAuctionStr().match(matchEl.value.toUpperCase()));
}

function countMatches() {
  if (!filterChk.checked) return;
  const count = boards.filter(board => isBoardInScope(board)).length;
  matchCountEl.innerHTML = count + (count == 1 ? ' match' : ' matches');
}

function backwardSearchBoard(start) {
  if (start == -1) start = currentBoard - 1;
  for (let i = start; i >= 0; i--) {
    if (isBoardInScope(boards[i])){
      currentBoard = i;
      showBoard();
      break;
    }
  }
}

function forwardSearchBoard(start) {
  if (start == -1) start = currentBoard + 1;
  for (let i = start; i < boards.length; i++) {
    if (isBoardInScope(boards[i])){
      currentBoard = i;
      showBoard();
      break;
    }
  }
}

function showBoard() {
  const board = boards[currentBoard];
  prevBtn.disabled = board.num == 0;
  nextBtn.disabled = board.num == MAX_BOARDS - 1;

  // Info
  boardNumEl.value = board.num + 1;

  // Hands
  tableEl.style.minHeight = pairPractice ? '144px' : '288px';
  for (seat of BIDDER_SEATS) {
    renderHand(seat);
  }
  noteEl.value = board.note;
  contractEl.innerHTML = '';
  parScoreEl.innerHTML = '';
  ddResultsEl.innerHTML = '';
  markdownEl.innerHTML = '';

  // Auction
  for (seat of BIDDER_SEATS) {
    nameEls[seat].className = board.isVulnerable(seat) ? 'red-name' : 'white-name';
    bidsEls[seat].innerHTML = '';
  }
  for (seat of BIDDER_SEATS) {
    if (seat !== board.dealer)
      bidsEls[seat].innerHTML = '<div>&nbsp;</div>';
    else
      break;
  }
  let player = board.dealer;
  board.auction.forEach((bid, index) => {
    showBid(player, bid, index);
    player = nextPlayer(player);
  });

  if (board.isAuctionOver()) {
    endAuction();
    return;
  }
  takeTurn();
}

// --- BIDDING ACTIONS ---
function takeTurn() {
  const board = boards[currentBoard];
  if (board.isAuctionOver()) return;

  for (seat of BIDDER_SEATS) {
    handEls[seat].style.display = (seat === board.player ? 'block' : 'none');
  }

  renderBiddingControls();

  if (pairPractice && ['North', 'South'].includes(board.player)) {
    handleBid('P');
  }
}

function showBid(player, bid, index) {
  const bidContainer = document.createElement('div');
  bidContainer.className = 'bid';
  bidContainer.innerHTML = '1234567'.includes(bid[0]) ?
    bid[0] + STRAIN_HTMLS[bid[1]] : bid;
  bidContainer.onclick = () => {
    boards[currentBoard].retractBid(index);
    boards[currentBoard].save();
    showBoard();
    countMatches();
  };
  bidsEls[player].appendChild(bidContainer);
  // Scroll to bottom to show the latest bid.
  auctionEl.scrollTop = auctionEl.scrollHeight;
}

function handleBid(bid) {
  const board = boards[currentBoard];
  showBid(board.player, bid, board.auction.length);
  board.addBid(bid);
  board.save();
  countMatches();
  if (board.isAuctionOver()) {
    board.solveLeads();
    endAuction();
    return;
  }
  takeTurn();
}

function endAuction() {
  /* Disable all bid buttons */
  for (button of document.getElementsByClassName('bid-btn')) {
    button.style.display = 'none';
  }
  // Reveal all hands
  for (seat of BIDDER_SEATS) {
    handEls[seat].style.display = 'block';
  }
  renderContract();
  renderOpeningLeads();
  renderParScore();
  renderDoubleDummyResults();
  renderSingleDummyResults();
  if (exportMarkdown) renderMarkdown();
}

// --- RENDERING FUNCTIONS ---
function renderContract() {
  const board = boards[currentBoard];
  const {level, trump, doubled, declarer} = board.getContract();
  contractEl.innerHTML =
    level == 0 ? 'Passed out' : level + STRAIN_HTMLS[trump] +
    doubled + '&nbsp;by ' + declarer;
}

function renderTricks(tricks) {
  if (tricks == 0) return '<span class="tricks equal">=</span>';
  if (tricks >= 1) return '<span class="tricks plus">+' + tricks + '</span>';
  if (tricks <= -1) return '<span class="tricks minus">&ndash;' + -tricks + '</span>';
}

function renderCard(suit, rank, tricks) {
  return '<td>' +
    (rank === '10' ? '<font style="letter-spacing:-3px">1</font>0' :
      rank === 'J' ? '&hairsp;J&hairsp;' : rank) +
    (tricks ? renderTricks(Number(tricks)) : '') + '</td>';
}

function renderSuit(suit, cards, leads) {
  let prev_tricks = '';
  let html = '<table class="suit">' + '<tr><td>' + STRAIN_HTMLS[suit] + '</td>';
  for (rank of cards) {
    if ((suit + rank) in leads) {
      // Show trick info once when it's the same for neighboring cards.
      const new_tricks = leads[suit + rank];
      if (new_tricks != prev_tricks) {
        html += renderCard(suit, rank, new_tricks);
        prev_tricks = new_tricks;
        continue;
      }
    }
    html += renderCard(suit, rank, '');
  }
  if (cards.length == 0) html += '<td>&ndash;</td>';
  return html + '</tr></table>';
}

function renderHand(seat, leads = []) {
  const board = boards[currentBoard];
  const hand = board.hands[seat];
  const targetEl = handEls[seat];
  targetEl.innerHTML = '';

  const nameContainer = document.createElement('div');
  nameContainer.className = 'seat ' +
    (board.isVulnerable(seat) ? 'red-name' : 'white-name');
  nameContainer.innerHTML = seat + ' (' + calcHandHcp(hand) + ')';
  targetEl.appendChild(nameContainer);

  const suits = { 'S': [], 'H': [], 'D': [], 'C': [] };
  hand.forEach(card => suits[card.suit].push(card.rank));

  for (const suit of SUITS) {
    const suitContainer = document.createElement('div');
    suitContainer.innerHTML = renderSuit(suit, suits[suit], leads);
    targetEl.appendChild(suitContainer);
  }
}

function renderBiddingControls() {
  const board = boards[currentBoard];
  const auction = board.auction;
  biddingGridEl.innerHTML = '';

  const passBtn = document.createElement('button');
  passBtn.textContent = 'P';
  passBtn.className = 'green-btn';
  passBtn.onclick = () => handleBid('P');
  biddingGridEl.appendChild(passBtn);

  if (!pairPractice) {
    const dblBtn = document.createElement('button');
    dblBtn.textContent = 'X';
    dblBtn.className = 'red-btn';
    dblBtn.onclick = () => handleBid('X');
    biddingGridEl.appendChild(dblBtn);
    const canDbl =
      (auction.length >= 1 && isRealBid(auction[auction.length - 1])) ||
      (auction.length >= 3 && auction[auction.length - 1] === 'P' &&
        auction[auction.length - 2] === 'P' &&
        isRealBid(auction[auction.length - 3]));
    dblBtn.disabled = !canDbl;

    const rdblBtn = document.createElement('button');
    rdblBtn.textContent = 'XX';
    rdblBtn.className = 'blue-btn';
    rdblBtn.onclick = () => handleBid('XX');
    biddingGridEl.appendChild(rdblBtn);
    const canRdbl =
      (auction.length >= 1 && auction[auction.length - 1] === 'X') ||
      (auction.length >= 3 && auction[auction.length - 1] === 'P' &&
        auction[auction.length - 2] === 'P' &&
        auction[auction.length - 3] === 'X');
    rdblBtn.disabled = !canRdbl;
  }

  const lastRealBid = [...board.auction].reverse().find(b => isRealBid(b));
  const lastBidRank = lastRealBid ? getBidRank(lastRealBid) : -1;

  for (let level = 1; level <= 7; level++) {
    [...STRAINS].reverse().forEach(suit => {
      const bidString = level + suit;
      const bidRank = getBidRank(bidString);
      const button = document.createElement('button');
      button.innerHTML = level + STRAIN_HTMLS[suit];
      button.className = 'grey-btn';
      if (hideInvalidBids) {
        button.style.display = (bidRank <= lastBidRank ? 'none' : 'block');
      } else {
        button.disabled = (bidRank <= lastBidRank);
      }
      button.onclick = () => handleBid(bidString);
      biddingGridEl.appendChild(button);
    });
  }
}

function renderOpeningLeads() {
  const board = boards[currentBoard];
  if (board.openingLeads == null || board.openingLeads.length == 0) return;

  const {level, trump, doubled, declarer} = board.getContract();
  if (level == 0) return;

  const lead_seat = BIDDER_SEATS[(SEAT_NUMBERS[declarer] + 1) % 4];
  renderHand(lead_seat, board.openingLeads);
}

function mergeNumbers(x, y, allowDelta) {
  if (allowDelta) {
    if (x.includes('.')) {
      if (Math.abs(Number(x) - Number(y)) <= 0.2)
        return [((Number(x) + Number(y)) / 2).toFixed(1)];
    } else {
      if (Math.abs(Number(x) - Number(y)) <= 4)
        return [(Number(x) + Number(y)) / 2];
    }
  } else {
    if (x == y) return [x];
  }
  return [x, y];
}

function renderRowOfPairs(line, count, allowDelta = false) {
  const items = line.split(/\s+/).slice(0, count);
  let html = '<tr><td>' + STRAIN_HTMLS[items[0]] + '</td>';
  for (let i = 1; i < items.length; i += 2) {
    const new_items = mergeNumbers(items[i], items[i + 1], allowDelta);
    if (new_items.length == 1) {
      html += '<td>' + new_items[0] + '</td>';
    } else {
      html += '<td>' + items[i] + '-' + items[i + 1] + '</td>';
    }
  }
  return html + '</tr>';
}

function renderDoubleDummyResults() {
  const board = boards[currentBoard];
  if (board.dd == null || board.dd.slice(0, 5).length == 0) return;

  let html = `<table class="dd">
  <tr>
    <th></th>
    <th><abbr title="Double-dummy tricks by South or North">S-N</abbr></th>
    <th><abbr title="Double-dummy tricks by West or East">W-E</abbr></th>
  </tr>`;
  for (const line of board.dd.slice(0, 5)) {
    html += renderRowOfPairs(line, 5);
  }
  html += '</table>';
  ddResultsEl.innerHTML = html;
}

function renderSingleDummyResults() {
  const board = boards[currentBoard];
  if (board.dd == null || board.dd.slice(6, 17).length == 0) {
    biddingGridEl.innerHTML = '<p class="col-span-full">Auction has ended.</p>';
    return;
  }

  let html = `<table class="dd col-span-full">
  <tr>
    <th></th>
    <th><abbr title="Average tricks by South or North">S-N</abbr></th>`;
  for (let t = 7; t <= 13; t++) {
    const hint = `Percentage of taking at least ${t} tricks by South or North`;
    html += `<th><abbr title="${hint}">${t}</abbr></th>`;
  }
  html += '</tr>';
  for (const line of board.dd.slice(6, 11)) {
    html += renderRowOfPairs(line, 17, /*allowDelta*/true);
  }
  html += `</tr>
  <tr><td>&nbsp;</td></tr>
  <tr>
    <th></th>
    <th><abbr title="Average tricks by West or East">W-E</abbr></th>`;
  for (let t = 7; t <= 13; t++) {
    const hint = `Percentage of taking at least ${t} tricks by West or East`;
    html += `<th><abbr title="${hint}">${t}</abbr></th>`;
  }
  html += '</tr>';
  for (const line of board.dd.slice(12, 17)) {
    html += renderRowOfPairs(line, 17, /*allowDelta*/true);
  }
  biddingGridEl.innerHTML = html + '</table>';
}

// --- Markdown ---
const CHINESE_VULNERABLE = { 'None': '双方无局', 'N-S': '南北有局', 'E-W': '东西有局', 'All': '双方有局' };
const CHINESE_DEALER = { 'West': '西', 'North': '北', 'East': '东', 'South': '南' };

function renderMarkdown() {
  const board = boards[currentBoard];
  const sep = ' | ', space = ''.padEnd(10), nl = '\n';
  const vulnerable = CHINESE_VULNERABLE[board.vulnerable].padEnd(6);
  const dealer = (CHINESE_DEALER[board.dealer] + '发牌').padEnd(7);

  // Hands
  let text = vulnerable + sep + board.getSuit('North', 'S') + sep + nl;
  text += dealer + sep + board.getSuit('North', 'H') + sep + nl;
  text += space + sep + board.getSuit('North', 'D') + sep + nl;
  text += space + sep + board.getSuit('North', 'C') + sep + nl;
  text += board.getSuit('West', 'S') + sep + space + sep + board.getSuit('East', 'S') + nl;
  text += board.getSuit('West', 'H') + sep + space + sep + board.getSuit('East', 'H') + nl;
  text += board.getSuit('West', 'D') + sep + space + sep + board.getSuit('East', 'D') + nl;
  text += board.getSuit('West', 'C') + sep + space + sep + board.getSuit('East', 'C') + nl;
  text += space + sep + board.getSuit('South', 'S') + sep + nl;
  text += space + sep + board.getSuit('South', 'H') + sep + nl;
  text += space + sep + board.getSuit('South', 'D') + sep + nl;
  text += space + sep + board.getSuit('South', 'C') + sep + nl;

  // Auction
  text += Object.values(CHINESE_DEALER).join(sep) + nl;
  for (let seat of BIDDER_SEATS) {
    if (seat !== board.dealer) text += ''.padEnd(2) + sep;
    else break;
  }
  let seat = board.dealer;
  board.auction.forEach((bid, index) => {
    text += bid.padEnd(2);
    seat = nextPlayer(seat);
    if (seat !== 'West') text += sep;
    else text += ' \n';

  });
  if (seat !== 'West')
    text += '\n';

  // Replace strains
  text = text.replace(/N /g, 'NT')
    .replace(/S/g, '♠').replace(/H/g, '♥').replace(/D/g, '♦').replace(/C/g, '♣');

  markdownEl.innerHTML = '<pre>' + text + '</pre>';
}

// --- PAR SCORE ---
function renderParScore() {
  const board = boards[currentBoard];
  if (board.dd == null || board.dd.slice(0, 5).length != 5) return;

  const [nsContracts, ewContracts] = computeParScore(board.dd.slice(0, 5),
                                                     board.vulnerable);

  if (nsContracts.length == 0 && ewContracts.length == 0) {
    parScoreEl.innerHTML = 'Par: 0';
  } else {
    parScoreEl.innerHTML = '<table>' +
      (nsContracts.length > 0 ? renderParContracts(nsContracts) : '') +
      (ewContracts.length > 0 ? renderParContracts(ewContracts) : '') +
      '</table>';
  }
}

// --- DOUBLE-DUMMY DATA ---
function fetchDoubleDummy() {
  const batchNum = doubleDummy ? doubleDummy :
    String(Math.floor(Math.random() * 512)).padStart(4, '0');
  const url = 'https://raw.githubusercontent.com/macroxue/double-dummy/main/dd.' +
    batchNum;
  console.log(url);
  fetch(url).then(r => r.text()).then(text => {
    const lines = text.split('\n');
    for (let num = 0; num < MAX_BOARDS; num++) {
      const board = new Board(num);
      board.hands = parseBoard(lines.slice(num * 30, num * 30 + 13));
      board.dd = lines.slice(num * 30 + 13, num * 30 + 30);
      board.save();
      boards.push(board);
    }
    pickStartingBoard();
  });
}

function parseBoard(lines) {
  return {
    'South': parseHand(lines.slice(9, 13)),
    'North': parseHand(lines.slice(1, 5)),
    'West': parseHand(lines.slice(5, 9).map(line => line.substring(0, 40))),
    'East': parseHand(lines.slice(5, 9).map(line => line.substring(40, 80))),
  };
}

function parseHand(lines) {
  const SUIT_SYMBOLS = '♠♥♦♣';
  const hand = [];
  for (const i in SUIT_SYMBOLS) {
    const suit = SUIT_SYMBOLS[i];
    const line = lines[i];
    for (let pos = line.indexOf(suit) + 2; pos < line.length; pos++) {
      if (line[pos] === '-' || line[pos] === ' ') break;
      hand.push({suit: SUIT_CONVERSIONS[suit],
                 rank: line[pos] === 'T' ? '10' : line[pos]});
    }
  }
  return hand;
}

// --- UTILITY FUNCTIONS ---
function dealHands() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  let hands = {
    'South': sortHand(deck.slice(0, 13)),
    'North': sortHand(deck.slice(13, 26)),
    'West': sortHand(deck.slice(26, 39)),
    'East': sortHand(deck.slice(39, 52))
  };
  if (pairPractice &&
      calcHandHcp(hands['West']) + calcHandHcp(hands['East']) < 18) {
    hands = {
      'West': sortHand(deck.slice(0, 13)),
      'East': sortHand(deck.slice(13, 26)),
      'South': sortHand(deck.slice(26, 39)),
      'North': sortHand(deck.slice(39, 52))
    };
  }
  return hands;
}

function sortHand(hand) {
  return hand.sort((a, b) => {
    if (a.suit !== b.suit) {
      return STRAIN_RANKS[b.suit] - STRAIN_RANKS[a.suit];
    }
    return RANK_VALUES[b.rank] - RANK_VALUES[a.rank];
  });
}

function calcHandHcp(hand) {
  return hand.reduce((acc, card) => acc + calcRankHcp(card.rank), 0);
}

function calcRankHcp(rank) {
  return RANK_VALUES[rank] > 10 ? RANK_VALUES[rank] - 10 : 0;
}

function getBidRank(bid) {
  const level = Number(bid[0]);
  const strainRank = STRAIN_RANKS[bid[1]];
  return (level - 1) * 5 + strainRank;
}

function isRealBid(bid) {
  return ['P', 'X', 'XX'].includes(bid) ? false : true;
}

function nextPlayer(player) {
  return (player === 'West' ? 'North' :
          player === 'North' ? 'East' :
          player === 'East' ? 'South' : 'West');
}
