const errors = [];

Module = {
  'onRuntimeInitialized': function() { postMessage(['ready']); },
  'onAbort': function() { postMessage(['abort', errors.join('\n')]); },
  'printErr': function(err) { errors.push('[' + (errors.length + 1) + '] ' + err); },
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

// Some browsers don't support WASM SIMD, e.g. Firefox 147.0.2 on Galaxy Tab A.
// Detect SIMD support here and load the right WASM binary in solver.js.
var simd = true;

fetch('solver.wasm')
  .then(response => response.arrayBuffer())
  .then(bytes => {
    simd = WebAssembly.validate(bytes);
    importScripts('solver.js');
  });
