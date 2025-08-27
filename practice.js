const pairPractice = (new URLSearchParams(window.location.search)).has('p');
const clearStorage = (new URLSearchParams(window.location.search)).has('c');
const doubleDummy = (new URLSearchParams(window.location.search)).has('d');

// --- DOM ELEMENTS ---
const retryBtn = document.getElementById('retry');
const firstBtn = document.getElementById('first');
const lastBtn = document.getElementById('last')
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const boardEl = document.getElementById('board');
const dealerEl = document.getElementById('dealer');
const vulnerableEl = document.getElementById('vulnerable');
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
const noteEl = document.getElementById('note');
const biddingGridEl = document.getElementById('bidding-grid');
const ddResultsEl = document.getElementById('dd-results');

// --- CONSTANTS ---
const MAX_BOARDS = 1000;
const STORAGE_KEY_PREFIX = 'Board #';
const DEALER_SEATS = [ 'North', 'East', 'South', 'West' ];
const VULNERABLES = [ 'None', 'N-S', 'E-W', 'All' ];
const BIDDER_SEATS = [ 'West', 'North', 'East', 'South' ];
const SUITS = { '♠': 'Spades', '♥': 'Hearts', '♦': 'Diamonds', '♣': 'Clubs' };
const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'];
const SUIT_HTMLS = { '♠': '<ss></ss>', '♥': '<hs></hs>', '♦': '<ds></ds>', '♣': '<cs></cs>', 'NT': 'NT' };
const ABBR_SUIT_HTMLS = { 'S': '<ss></ss>', 'H': '<hs></hs>', 'D': '<ds></ds>', 'C': '<cs></cs>', 'N': 'NT' };
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const BID_SUITS = ['♣', '♦', '♥', '♠', 'NT'];

// --- BOARD STATE ---
class Board {
  constructor(num) {
    const round = Math.floor(num / 4);
    this.num = num;
    this.dealer = DEALER_SEATS[num % 4];
    this.vulnerable = VULNERABLES[(num + round) % 4];
    this.hands = dealHands();
    this.note = '';
    this.dd = '';
    this.reset();
  }

  reset() {
    this.player = this.dealer;
    this.auction = [];
  }

  addBid(bid) {
    this.auction.push(bid);
    this.player = nextPlayer(this.player);
  }

  isAuctionOver() {
    const len = this.auction.length;
    return len >= 4 && this.auction[len - 1] === 'Pass' &&
      this.auction[len - 2] === 'Pass' && this.auction[len - 3] === 'Pass';
  }

  isVulnerable(seat) {
    return this.vulnerable === 'All' ||
      (this.vulnerable === 'N-S' && ['North', 'South'].includes(seat)) ||
      (this.vulnerable === 'E-W' && ['East', 'West'].includes(seat));
  }

  load() {
    let saved = localStorage.getItem(STORAGE_KEY_PREFIX + this.num);
    if (saved == null) return false;
    this.#deserializeFrom(JSON.parse(saved));
    return true;
  }

  save() {
    localStorage.setItem(STORAGE_KEY_PREFIX + this.num, JSON.stringify(this));
  }

  #deserializeFrom(object) {
    this.num = object.num;
    this.dealer = object.dealer;
    this.vulnerable = object.vulnerable;
    this.hands = object.hands;
    this.player = object.player;
    this.auction = object.auction;
    this.note = object.note;
    this.dd = object.dd;
  }
}

// --- BOARD HISTORY ---
let currentBoard = -1;
let boards = [];
initialize();

function initialize() {
  retryBtn.addEventListener('click', retryBoard);
  firstBtn.addEventListener('click', firstBoard);
  lastBtn.addEventListener('click', lastBoard);
  prevBtn.addEventListener('click', prevBoard);
  nextBtn.addEventListener('click', nextBoard);
  noteEl.addEventListener('blur', () => {
    boards[currentBoard].note = noteEl.innerHTML;
    boards[currentBoard].save();
  });

  if (clearStorage) localStorage.clear();
  if (doubleDummy) {
    fetchDoubleDummy();
  } else {
    loadBoards();
    pickStartingBoard();
  }
}

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

function loadBoards() {
  for (let num = 0; ; num++) {
    let board = new Board(num);
    if (!board.load()) break;
    boards.push(board);
  }
}

function firstBoard() {
  currentBoard = 0;
  showBoard();
}

function lastBoard() {
  currentBoard = boards.length - 1;
  showBoard();
}

function prevBoard() {
  if (currentBoard == 0) return;
  currentBoard--;
  showBoard();
}

function nextBoard() {
  if (currentBoard == boards.length - 1) {
    boards.push(new Board(boards.length));
    boards[boards.length - 1].save();
  }
  currentBoard++;
  showBoard();
}

function retryBoard() {
  const board = boards[currentBoard];
  board.reset();
  board.save();
  showBoard();
}

function showBoard() {
  const board = boards[currentBoard];
  firstBtn.disabled = board.num == 0;
  lastBtn.disabled = board.num == boards.length - 1;
  prevBtn.disabled = board.num == 0;
  nextBtn.disabled = board.num == MAX_BOARDS - 1;
  retryBtn.disabled = board.auction.length == 0;

  // Info
  boardEl.innerHTML = board.num + 1;
  dealerEl.innerHTML = board.dealer;
  vulnerableEl.innerHTML = board.vulnerable;

  // Hands
  tableEl.style.minHeight = pairPractice ? '240px' : '320px';
  for (seat of BIDDER_SEATS) {
    renderHand(seat, board.hands[seat], handEls[seat]);
  }
  noteEl.innerHTML = board.note;
  renderDoubleDummyResults();

  // Auction
  for (seat of BIDDER_SEATS) {
    nameEls[seat].className = board.isVulnerable(seat) ? 'red-name' : 'white-name';
    bidsEls[seat].innerHTML = '';
  }
  for (seat of BIDDER_SEATS) {
    if (seat !== board.dealer)
      bidsEls[seat].innerHTML = '<br>';
    else
      break;
  }
  let player = board.dealer;
  for (bid of board.auction) {
    showBid(player, bid);
    player = nextPlayer(player);
  }

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
    handleBid('Pass');
  }
}

function showBid(player, bid) {
  const board = boards[currentBoard];
  const suit = bid[1];
  const suitHtml = '♠♥♦♣'.includes(suit) ? SUIT_HTMLS[suit] : '';
  const bidHtml = suitHtml !== '' ? bid[0] + suitHtml : bid;
  bidsEls[player].innerHTML += bidHtml + '<br>';
}

function handleBid(bid) {
  retryBtn.disabled = false;
  const board = boards[currentBoard];
  showBid(board.player, bid);
  board.addBid(bid);
  board.save();
  if (board.isAuctionOver()) {
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
  revealFinalHands();
  renderSingleDummyResults();
}

function revealFinalHands() {
  for (seat of BIDDER_SEATS) {
    handEls[seat].style.display = 'block';
  }
  ddResultsEl.style.display = 'block';
}

// --- RENDERING FUNCTIONS ---

function renderHand(seat, hand, targetEl) {
  const board = boards[currentBoard];
  targetEl.innerHTML = '';

  const nameContainer = document.createElement('div');
  nameContainer.className = 'grey-name';
  nameContainer.innerHTML = seat;
  targetEl.appendChild(nameContainer);

  const suits = { '♠': [], '♥': [], '♦': [], '♣': [] };
  hand.forEach(card => suits[card.suit].push(card.rank));

  for (const suit of SUIT_SYMBOLS) {
    const suitContainer = document.createElement('div');
    suitContainer.className = 'suit';
    suitContainer.innerHTML = SUIT_HTMLS[suit] + ' ' +
      spaceCards(suits[suit].length > 0 ? suits[suit].join(' ') : '-');
    targetEl.appendChild(suitContainer);
  }

  const hcp = calcHandHcp(hand);
  const hcpContainer = document.createElement('div');
  hcpContainer.className = 'hcp';
  hcpContainer.innerHTML = '(' + hcp + ")";
  targetEl.appendChild(hcpContainer);
}

function renderBiddingControls() {
  const board = boards[currentBoard];
  const auction = board.auction;
  biddingGridEl.innerHTML = '';

  const passBtn = document.createElement('button');
  passBtn.textContent = 'Pass';
  passBtn.className = 'green-btn transition-colors duration-200';
  passBtn.onclick = () => handleBid('Pass');
  biddingGridEl.appendChild(passBtn);

  if (!pairPractice) {
    const dblBtn = document.createElement('button');
    dblBtn.textContent = 'Dbl';
    dblBtn.className = 'red-btn transition-colors duration-200';
    dblBtn.onclick = () => handleBid('Dbl');
    biddingGridEl.appendChild(dblBtn);
    const canDbl =
      (auction.length >= 1 && isRealBid(auction[auction.length - 1])) ||
      (auction.length >= 3 && auction[auction.length - 1] === 'Pass' &&
        auction[auction.length - 2] === 'Pass' &&
        isRealBid(auction[auction.length - 3]));
    dblBtn.disabled = !canDbl;

    const rdblBtn = document.createElement('button');
    rdblBtn.textContent = 'Rdbl';
    rdblBtn.className = 'blue-btn transition-colors duration-200';
    rdblBtn.onclick = () => handleBid('Rdbl');
    biddingGridEl.appendChild(rdblBtn);
    const canRdbl =
      (auction.length >= 1 && auction[auction.length - 1] === 'Dbl') ||
      (auction.length >= 3 && auction[auction.length - 1] === 'Pass' &&
        auction[auction.length - 2] === 'Pass' &&
        auction[auction.length - 3] === 'Dbl');
    rdblBtn.disabled = !canRdbl;
  }

  const lastRealBid = [...board.auction].reverse().find(b => isRealBid(b));
  const lastBidValue = lastRealBid ? getBidValue(lastRealBid) : -1;

  for (let level = 1; level <= 7; level++) {
    BID_SUITS.forEach(suit => {
      const bidString = level + suit;
      const bidValue = getBidValue(bidString);
      const button = document.createElement('button');
      button.innerHTML = level + SUIT_HTMLS[suit];
      button.className = 'grey-btn transition-colors duration-200';
      // button.style.display = (bidValue <= lastBidValue ? 'none' : 'block');
      button.disabled = (bidValue <= lastBidValue);
      button.onclick = () => handleBid(bidString);
      biddingGridEl.appendChild(button);
    });
  }
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
  let html = '<tr><td>' + ABBR_SUIT_HTMLS[items[0]] + '</td>';
  for (let i = 1; i < items.length; i += 2) {
    const new_items = mergeNumbers(items[i], items[i + 1], allowDelta);
    if (new_items.length == 1) {
      html += '<td colspan=2 style="min-width:80px">' + new_items[0] + '</td>';
    } else {
      html += '<td>' + items[i] + '</td><td>' + items[i + 1] + '</td>';
    }
  }
  return html + '</tr>';
}

function renderDoubleDummyResults() {
  const board = boards[currentBoard];
  if (board.dd == null || board.dd === '') return;

  let html = '<table class="dd">';
  html += '<tr><td></td><td colspan=2><abbr title="Double-dummy tricks">S - N</abbr></td><td colspan=2><abbr title="Double-dummy tricks">W - E</abbr></td></tr>';
  for (const line of board.dd.slice(0, 5)) {
    html += renderRowOfPairs(line, 5);
  }
  html += '</table>';
  ddResultsEl.innerHTML = html;
  ddResultsEl.style.display = 'none';
}

function renderSingleDummyResults() {
  const board = boards[currentBoard];
  if (board.dd == null || board.dd === '') {
    biddingGridEl.innerHTML = '<p class="col-span-full text-center text-gray-500">Auction has ended.</p>';
    return;
  }

  let html = '<table class="sd col-span-full"><tr><td></td>';
  html += '</tr><tr><td></td><td colspan=2><abbr title="Single-dummy average tricks">S - N</abbr></td>';
  for (let t = 7; t <= 13; t++) {
    const hint = `Percentage of taking ${t} tricks or more`;
    html += `<td colspan=2><abbr title="${hint}">S ${t} N</abbr></td>`;
  }
  html += '</tr>';
  for (const line of board.dd.slice(6, 11)) {
    html += renderRowOfPairs(line, 17, /*allowDelta*/true);
  }
  html += '</tr><tr><td></td><td colspan=2><abbr title="Single-dummy average tricks">W - E</abbr></td>';
  for (let t = 7; t <= 13; t++) {
    const hint = `Percentage of taking ${t} tricks or more`;
    html += `<td colspan=2><abbr title="${hint}">W ${t} E</abbr></td>`;
  }
  html += '</tr>';
  for (const line of board.dd.slice(12, 17)) {
    html += renderRowOfPairs(line, 17, /*allowDelta*/true);
  }
  biddingGridEl.innerHTML = html + '</table>';
}

// --- DOUBLE-DUMMY DATA ---
function fetchDoubleDummy() {
  const url = 'https://raw.githubusercontent.com/macroxue/double-dummy/main/dd.000';
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
  const hand = [];
  for (const i in SUIT_SYMBOLS) {
    const suit = SUIT_SYMBOLS[i];
    const line = lines[i];
    for (let pos = line.indexOf(suit) + 2; pos < line.length; pos++) {
      if (line[pos] === '-' || line[pos] === ' ') break;
      hand.push({suit, rank: line[pos] === 'T' ? '10' : line[pos]});
    }
  }
  return hand;
}

// --- UTILITY FUNCTIONS ---
function dealHands() {
  let deck = [];
  for (const suit of SUIT_SYMBOLS) {
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
  const suitOrder = { '♠': 4, '♥': 3, '♦': 2, '♣': 1 };
  return hand.sort((a, b) => {
    if (a.suit !== b.suit) {
      return suitOrder[b.suit] - suitOrder[a.suit];
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

function getBidValue(bidString) {
  const level = parseInt(bidString[0], 10);
  const suit = bidString.substring(1);
  const suitValue = BID_SUITS.indexOf(suit);
  return (level - 1) * 5 + suitValue;
}

function isRealBid(bid) {
  return ['Pass', 'Dbl', 'Rdbl'].includes(bid) ? false : true;
}

function nextPlayer(player) {
  return (player === 'West' ? 'North' :
          player === 'North' ? 'East' :
          player === 'East' ? 'South' : 'West');
}

function spaceCards(suit) {
    return suit.replace(/' '/g, '&thinsp;')
      .replace(/\bJ\b/g, '&hairsp;&hairsp;J&hairsp;')
      .replace(/\b(T|10)\b/g, '<font style="letter-spacing:-2px">1</font>0');
}
