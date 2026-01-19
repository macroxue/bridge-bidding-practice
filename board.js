// --- CONSTANTS ---
const MAX_BOARDS = 1000;
const STORAGE_KEY_PREFIX = 'Board #';
const DEALER_SEATS = [ 'North', 'East', 'South', 'West' ];
const VULNERABLES = [ 'None', 'N-S', 'E-W', 'All' ];
const BIDDER_SEATS = [ 'West', 'North', 'East', 'South' ];
const SEAT_NUMBERS = { 'West': 0, 'North': 1, 'East': 2, 'South': 3 };
const CALL_CONVERSIONS = {
  'P': 'P', 'X': 'X', 'XX': 'XX',
  'Pass': 'P', 'Dbl': 'X', 'Rdbl': 'XX', '': ''};
const SUITS = ['S', 'H', 'D', 'C'];
const SUIT_CONVERSIONS = {
  'N': 'N', 'S': 'S', 'H': 'H', 'D': 'D', 'C': 'C',
  'NT': 'N', '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
const STRAINS = ['N', 'S', 'H', 'D', 'C'];
const STRAIN_RANKS = { 'N': 4, 'S': 3, 'H': 2, 'D': 1, 'C': 0 };
const STRAIN_HTMLS = { 'N': 'NT', 'S': '<ss></ss>', 'H': '<hs></hs>', 'D': '<ds></ds>', 'C': '<cs></cs>' };
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

// --- BOARD STATE ---
class Board {
  constructor(num) {
    const round = Math.floor(num / 4);
    this.num = num;
    this.dealer = DEALER_SEATS[num % 4];
    this.vulnerable = VULNERABLES[(num + round) % 4];
    this.hands = dealHands();
    this.note = '';
    this.dd = [];
    this.reset();
  }

  reset() {
    this.player = this.dealer;
    this.auction = [];
    this.openingLeads = {};
  }

  isVulnerable(seat) {
    return isVulnerable(seat, this.vulnerable);
  }

  addBid(bid) {
    this.auction.push(bid);
    this.player = nextPlayer(this.player);
  }

  retractBid(index) {
    this.auction.length = index;
    this.player = BIDDER_SEATS[(SEAT_NUMBERS[this.dealer] + index) % 4]
  }

  isAuctionOver() {
    const len = this.auction.length;
    return len >= 4 && this.auction[len - 1] === 'P' &&
      this.auction[len - 2] === 'P' && this.auction[len - 3] === 'P';
  }

  getAuctionStr() {
    return this.auction.map(call => (call === 'XX' ? 'R' : call)).join('');
  }

  getContract() {
    if (!this.isAuctionOver()) return {level: 0};

    // Find the contract.
    const pos = this.auction.length - 1 -
      [...this.auction].reverse().findIndex(bid => isRealBid(bid));
    if (pos == this.auction.length) return {level: 0};
    const contract = this.auction[pos];
    const level = Number(contract.slice(0, 1));
    const trump = contract.slice(1);
    const doubled = [...this.auction.slice(pos + 1)].reverse()
      .find(bid => ['X', 'XX'].includes(bid)) ?? '';

    // Identify the declarer at the same side who first bid the trump suit.
    const first = this.auction.findIndex((bid, i) => i % 2 == pos % 2 &&
                                         bid.slice(1) === trump);
    const declarer = BIDDER_SEATS[(SEAT_NUMBERS[this.dealer] + first) % 4];
    return {level, trump, doubled, declarer};
  }

  getSuit(seat, suit) {
    let ranks = '';
    this.hands[seat].forEach(card => {
      if (card.suit == suit) ranks += card.rank == '10' ? 'T' : card.rank;
    });
    return (suit + ' ' + ranks).padEnd(10);
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
    this.hands = this.#convertHands(object.hands);
    this.player = object.player;
    this.auction = this.#convertAuction(object.auction);
    this.note = object.note;
    this.dd = object.dd;
    this.openingLeads = object.openingLeads;
    this.openingLeads = this.#convertLeads(object.openingLeads);
  }

  #convertHands(hands) {
    return {
      'South': this.#convertHand(hands['South']),
      'North': this.#convertHand(hands['North']),
      'West': this.#convertHand(hands['West']),
      'East': this.#convertHand(hands['East'])
    };
  }

  #convertHand(hand) {
    return hand.map(c => ({suit: SUIT_CONVERSIONS[c.suit], rank: c.rank}));
  }

  #convertAuction(auction) {
    return auction.map(b => '1234567'.includes(b[0]) ?
                       b[0] + SUIT_CONVERSIONS[b[1]] : CALL_CONVERSIONS[b]);
  }

  #convertLeads(leads) {
    const newLeads = {};
    for (const card in leads) {
      const newCard = SUIT_CONVERSIONS[card[0]] + card.slice(1);
      newLeads[newCard] = leads[card];
    }
    return newLeads;
  }

  #toHandStrings() {
    const handStrings = {};
    for (let seat of BIDDER_SEATS) {
      const suits = { 'S': [], 'H': [], 'D': [], 'C': [] };
      this.hands[seat].forEach(card => suits[card.suit].push(card.rank));
      handStrings[seat] = '';
      for (const suit of SUITS) {
        const joinedSuit = suits[suit].join('');
        handStrings[seat] += (joinedSuit === '' ? '-' : joinedSuit) + ' ';
      }
    }
    return handStrings;
  }

  solve() {
    worker.postMessage(['solve', this.num, this.#toHandStrings()]);
  }

  solveLeads() {
    this.openingLeads = {};
    const {level, trump, doubled, declarer} = this.getContract();
    if (level == 0) return;

    const lead_seat = (SEAT_NUMBERS[declarer] + 1) % 4;
    worker.postMessage(['solve_leads', this.num, this.#toHandStrings(),
      level, Board.SUIT_NUMBERS[trump], lead_seat]);
  }

  static SUIT_NUMBERS = { 'N': 4, 'S': 0, 'H': 1, 'D': 2, 'C': 3 };
};

function isVulnerable(seat, vulnerable) {
  return vulnerable === 'All' ||
    (vulnerable === 'N-S' && ['N', 'S'].includes(seat[0])) ||
    (vulnerable === 'E-W' && ['E', 'W'].includes(seat[0]));
}
