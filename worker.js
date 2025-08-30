Module = {}
Module.onRuntimeInitialized = function() {
  postMessage('Ready');
}

const BIDDER_SEATS = [ 'West', 'North', 'East', 'South' ];

onmessage = function(event) {
  const num = event.data[0];
  const hands = event.data[1];
  const result =
    Module.ccall('solve', // name of C function
                 'string', // return type
                 BIDDER_SEATS.map(seat => 'string'), // argument types
                 BIDDER_SEATS.map(seat => hands[seat])); // arguments
  postMessage([num, result]);
};

importScripts('solver.js');
