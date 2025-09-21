function renderParContracts(contracts) {
  let html = contracts[0].renderParScore();
  contracts.forEach(c => html += c.renderContract());
  return html;
}

function computeParScore(ddLines, vulnerable) {
  const seats = ['S', 'N', 'W', 'E'];
  const ddTricks = { 'S': {}, 'N': {}, 'W': {}, 'E': {} };
  for (const line of ddLines) {
    const items = line.split(/\s+/).slice(0, 5);
    const strain = items[0];
    for (let pos = 0; pos < 4; pos++) {
      const declarer = seats[pos];
      const tricks = Number(items[pos + 1]);
      ddTricks[declarer][strain] = tricks;
    }
  }

  const nsContracts = [], ewContracts = [];
  for (const strain of ['N', 'S', 'H', 'D', 'C']) {
    nsContracts.push(...scanLevels(strain, ['N', 'S'], ddTricks, vulnerable));
    ewContracts.push(...scanLevels(strain, ['E', 'W'], ddTricks, vulnerable));
  }

  // Highest scores first. For the same score,
  // 1) prefer the highest contract, if it's sacrificed;
  // 2) prefer the lowest contract, otherwise.
  const order = (a, b) => {
    if (a.scoreWithSacrifices != b.scoreWithSacrifices)
      return b.scoreWithSacrifices - a.scoreWithSacrifices;
    return (a.sacrifices.length ? b.rank - a.rank : a.rank - b.rank);
  }
  return [filterParContracts(nsContracts.sort(order)),
          filterParContracts(ewContracts.sort(order))];
}

function filterParContracts(contracts) {
  if (contracts.length == 0) return [];

  const parScore = contracts[0].scoreWithSacrifices;
  const parContractRank = contracts[0].rank;

  // Par contracts must have par score (the highest score) and
  // must be the highest contract if sacrificed.
  const pars = contracts.filter(c => c.scoreWithSacrifices == parScore &&
                                (!c.sacrifices.length || c.rank == parContractRank));

  // Flatten embedded sacrifices.
  const flatPars = [];
  if (pars[0].sacrifices.length) {
    pars.forEach(c => c.sacrifices.forEach(s => {
      if (-s.score == parScore) flatPars.push(s);
    }));
  } else {
    pars.forEach(c => flatPars.push(c));
  }

  // Remove duplicates by keeping only one contract for each strain.
  const uniquePars = [];
  for (const strain of ['N', 'S', 'H', 'D', 'C']) {
    uniquePars.push(...flatPars.filter(c => c.strain == strain).slice(0, 1));
  }
  return uniquePars;
}

function scanLevels(strain, declarers, ddTricks, vulnerable) {
  const maxTricks = Math.max(...declarers.map(d => ddTricks[d][strain]));
  const trickDeclarers = declarers.filter(d => ddTricks[d][strain] == maxTricks);
  const contracts = [];
  for (let tricks = 7; tricks <= maxTricks; tricks++) {
    const contract = new Contract(tricks, strain, maxTricks, trickDeclarers,
                                  isVulnerable(declarers[0], vulnerable));
    const side = ['N', 'S'].includes(declarers[0]) ? ['N', 'S'] : ['E', 'W'];
    const other_side = ['N', 'S'].includes(declarers[0]) ? ['E', 'W'] : ['N', 'S'];
    const competitions = competeWith(contract, ddTricks, other_side,
                                     isVulnerable(other_side[0], vulnerable));
    if (competitions.length == 0) {  // No competition
      contracts.push(contract);
    } else if (competitions[0].score > 0) {  // A higher and makable contract
    } else {  // Sacrifice
      contract.addSacrifices(competitions);
      contracts.push(contract);
    }
  }
  return contracts;
}

function competeWith(oppContract, ddTricks, seats, vulnerable) {
  const contracts = [];
  for (const strain of ['N', 'S', 'H', 'D', 'C']) {
    const tricks = STRAIN_RANKS[strain] > STRAIN_RANKS[oppContract.strain] ?
      oppContract.tricks : oppContract.tricks + 1;
    if (tricks > 13) continue;

    let contract2 = null;
    for (const declarer of seats) {
      const contract1 = new Contract(tricks, strain, ddTricks[declarer][strain],
                                     [declarer], vulnerable);
      if (contract1.score > 0 ||  // A higher and makable contract
          contract1.score > -oppContract.score) {  // Sacrifice
        if (contract2 == null || contract1.score > contract2.score) {
          contract2 = contract1;
        } else if (contract1.score == contract2.score) {
          contract2.addDeclarer(declarer);
        }
      }
    }
    if (contract2 != null) {
      if (contract2.score > 0) return [contract2];
      contracts.push(contract2);
    }
  }
  return contracts.sort((a, b) => b.score - a.score);
}

class Contract {
  constructor(tricks, strain, actual_tricks, declarers, vulnerable) {
    this.tricks = tricks;
    this.strain = strain;
    this.actual_tricks = actual_tricks;
    this.declarers = declarers;
    this.vulnerable = vulnerable;
    this.rank = this.#rank();
    this.score = this.#score();
    this.sacrifices = [];
    this.scoreWithSacrifices = this.score;
  }

  addDeclarer(newDeclarer) { this.declarers.push(newDeclarer); }

  addSacrifices(sacrifices) {
    this.sacrifices = sacrifices;
    if (this.sacrifices.length)
      this.scoreWithSacrifices = -this.sacrifices[0].score;
  }

  renderParScore() {
    return '<tr><td>Par: ' +
      (['N', 'S'].includes(this.declarers[0]) ? 'NS' : 'EW') + ' ' +
      this.#signed(this.score) + '</td></tr>';
  }

  renderContract() {
    const diffTricks = this.actual_tricks - this.tricks;
    return '<tr><td>' + (this.tricks - 6) + STRAIN_HTMLS[this.strain] +
      (this.score < 0 ? 'X' : '') +
      (diffTricks == 0 ? '=' : this.#signed(diffTricks)) +
      ' by ' + this.declarers.join('') + '</td></tr>';
  }

  #signed(number) {
    return (number < 0 ? '' : '+') + number;
  }

  #rank() { return STRAIN_RANKS[this.strain] + this.tricks * 5; }

  #score() {
    const down_tricks = this.tricks - this.actual_tricks;
    if (down_tricks > 0) {
      if (this.vulnerable) {
        return -(200 + (down_tricks - 1) * 300);
      } else if (down_tricks <= 2) {
        return -(100 + (down_tricks - 1) * 200);
      } else {
        return -(500 + (down_tricks - 3) * 300);
      }
    } else {
      let score = this.#trickScore();
      if (score < 100) score += 50;  // Part score
      else score += this.vulnerable ? 500 : 300;  // Game
      if (this.tricks == 12) score += this.vulnerable ?  750 :  500;  // Slam
      if (this.tricks == 13) score += this.vulnerable ? 1500 : 1000;  // Grand
      return score + this.#overtrickScore();
    }
  }

  #trickScore() {
    switch (this.strain) {
      case 'N': return (this.tricks - 6) * 30 + 10;
      case 'S':
      case 'H': return (this.tricks - 6) * 30;
      case 'D':
      case 'C': return (this.tricks - 6) * 20;
    }
  }

  #overtrickScore() {
    switch (this.strain) {
      case 'N':
      case 'S':
      case 'H': return (this.actual_tricks - this.tricks) * 30;
      case 'D':
      case 'C': return (this.actual_tricks - this.tricks) * 20;
    }
  }
};
