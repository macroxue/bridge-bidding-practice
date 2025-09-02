Module = {}
Module.onRuntimeInitialized = function() {
  postMessage(['ready']);
}

const BIDDER_SEATS = [ 'West', 'North', 'East', 'South' ];

onmessage = function(event) {
  const type = event.data[0];
  const num = event.data[1];
  const hands = event.data[2];
  switch (type) {
    case 'solve':
      const result = Module.ccall('solve', 'string',
                                  BIDDER_SEATS.map(seat => 'string'),
                                  BIDDER_SEATS.map(seat => hands[seat]));
      postMessage([type, num, result.trim()]);
      break;

    case 'solve_leads':
      const leads = Module.ccall('solve_leads', 'string',
                                 BIDDER_SEATS.map(seat => 'string')
                                 .concat(['number', 'number', 'number']),
                                 BIDDER_SEATS.map(seat => hands[seat])
                                 .concat(event.data.slice(3,6)));
      postMessage([type, num, leads.trim()]);
      break;
  }
};

importScripts('solver.js');
